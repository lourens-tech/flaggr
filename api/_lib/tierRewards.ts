import crypto from 'node:crypto';
import { sql } from './db';
import {
  computeQuarterlyTierInfo,
  TIER_MULTIPLIERS,
  TIER_BIRTHDAY_REWARD,
  TIER_BAR_VOUCHER_RAND,
  type TierInfo,
  type TierName,
} from './tiers';
import { quarterWindow } from './quarter';

export interface TierStatus extends TierInfo {
  multiplier: number;
}

// Single source of truth for "what tier is this user in right now" — used
// both to display tier/progress and to decide the earning multiplier for a
// receipt about to be scanned. Always reflects points earned so far this
// quarter, so a receipt's own multiplier is never influenced by itself.
export async function getCurrentTierStatus(userId: string): Promise<TierStatus> {
  const qw = quarterWindow();
  const rows = (await sql`
    select
      coalesce(sum(amount) filter (where type = 'earn' and date >= ${qw.currentStart} and date < ${qw.currentEnd}), 0)::int as current_quarter_earned,
      coalesce(sum(amount) filter (where type = 'earn' and date >= ${qw.previousStart} and date < ${qw.previousEnd}), 0)::int as previous_quarter_earned
    from activity
    where user_id = ${userId}
  `) as Array<{ current_quarter_earned: number; previous_quarter_earned: number }>;
  const { current_quarter_earned, previous_quarter_earned } = rows[0];
  const info = computeQuarterlyTierInfo(current_quarter_earned, previous_quarter_earned);
  return { ...info, multiplier: TIER_MULTIPLIERS[info.tier] };
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const part = () => Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  return `FLGR-${part()}-${part()}`;
}

// Grants the once-a-year birthday bonus and the once-a-quarter Gold/Platinum
// bar voucher, if this user hasn't already received either for the current
// period. Idempotent via unique (user_id, year) / (user_id, year, quarter)
// keys, so it's safe to call on every GET /api/me — the first call after the
// qualifying day/quarter grants it, every call after that is a no-op. There's
// no cron job in this app, so "the app gets opened" is the trigger.
export async function grantDueTierRewards(
  userId: string,
  courseId: string,
  tier: TierName,
  dateOfBirth: string | null,
): Promise<void> {
  const now = new Date();
  const year = now.getUTCFullYear();

  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    if (dob.getUTCMonth() === now.getUTCMonth() && dob.getUTCDate() === now.getUTCDate()) {
      const amount = TIER_BIRTHDAY_REWARD[tier];
      const claimed = (await sql`
        insert into birthday_rewards_granted (user_id, year, amount)
        values (${userId}, ${year}, ${amount})
        on conflict (user_id, year) do nothing
        returning user_id
      `) as Array<{ user_id: string }>;

      if (claimed.length > 0) {
        await sql.transaction([
          sql`
            update points_accounts
            set balance = balance + ${amount}, total_earned = total_earned + ${amount}
            where user_id = ${userId}
          `,
          sql`
            insert into activity (user_id, type, title, subtitle, amount)
            values (${userId}, 'earn', 'Birthday reward', ${`${tier} tier birthday bonus`}, ${amount})
          `,
          sql`
            insert into notifications (user_id, title, body)
            values (${userId}, 'Happy Birthday!', ${`We've added ${amount} Flagrr Cash to your wallet as your birthday reward.`})
          `,
        ]);
      }
    }
  }

  const barVoucherRand = TIER_BAR_VOUCHER_RAND[tier];
  if (!barVoucherRand) return;

  const qw = quarterWindow();
  const quarter = Math.floor(qw.currentStart.getUTCMonth() / 3) + 1;
  const quarterYear = qw.currentStart.getUTCFullYear();

  const claimedQuarter = (await sql`
    insert into quarterly_tier_vouchers_granted (user_id, year, quarter, tier)
    values (${userId}, ${quarterYear}, ${quarter}, ${tier})
    on conflict (user_id, year, quarter) do nothing
    returning user_id
  `) as Array<{ user_id: string }>;
  if (claimedQuarter.length === 0) return;

  const variantLabel = `R${barVoucherRand}`;
  const variantRows = (await sql`
    select r.id as reward_id, v.id as variant_id
    from reward_variants v
    join rewards r on r.id = v.reward_id
    where r.title = 'Bar Voucher' and v.label = ${variantLabel}
      and r.course_id = ${courseId} and r.active = true and v.active = true
  `) as Array<{ reward_id: string; variant_id: string }>;
  if (variantRows.length === 0) return; // course doesn't have this variant configured — skip rather than crash /api/me

  const { reward_id: rewardId, variant_id: variantId } = variantRows[0];
  const code = generateVoucherCode();
  const voucherId = crypto.randomUUID();

  await sql.transaction([
    sql`
      insert into vouchers (id, user_id, reward_id, reward_variant_id, variant_label, cost, code, qr_value)
      values (${voucherId}, ${userId}, ${rewardId}, ${variantId}, ${variantLabel}, 0, ${code}, ${`flagrr://voucher/${code}`})
    `,
    sql`
      insert into activity (user_id, type, title, subtitle, amount, voucher_id)
      values (${userId}, 'redeem', ${`${tier} Tier Bar Voucher (${variantLabel})`}, 'Free with your tier', 0, ${voucherId})
    `,
    sql`
      insert into notifications (user_id, title, body)
      values (${userId}, ${`${tier} tier bonus`}, ${`Your ${variantLabel} bar voucher is ready — show its QR code at the club to claim it.`})
    `,
  ]);
}
