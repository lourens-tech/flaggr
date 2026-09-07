import { sql } from './db';
import { sendPushToUser } from './pushNotifications';

export interface GiftFlagrrCashParams {
  userId: string;
  amount: number; // integer; positive = gift, negative = deduction/correction
  reason: string;
}

export interface GiftFlagrrCashResult {
  newBalance: number;
}

// Lets a super_admin manually credit or deduct a member's Flagrr Cash
// balance, with a required reason that becomes part of the member's
// notification. Recorded as a normal 'earn'/'redeem' activity row (not a
// separate ledger) so it shows up in the member's own Activity feed and
// counts toward tier progress exactly like a receipt or reward redemption
// would — a gift is still Flagrr Cash, not a side-channel adjustment
// invisible everywhere else. Balance is floored at zero either way.
export async function giftFlagrrCash(params: GiftFlagrrCashParams): Promise<GiftFlagrrCashResult> {
  const { userId, amount, reason } = params;

  const rows = (await sql`
    update points_accounts
    set balance = greatest(balance + ${amount}, 0),
        total_earned = case when ${amount} > 0 then total_earned + ${amount} else total_earned end,
        total_redeemed = case when ${amount} < 0 then total_redeemed + ${-amount} else total_redeemed end
    where user_id = ${userId}
    returning balance
  `) as Array<{ balance: number }>;
  if (rows.length === 0) throw new Error('Member not found');

  const isGift = amount > 0;
  const now = new Date();
  await sql`
    insert into activity (user_id, type, title, subtitle, amount)
    values (${userId}, ${isGift ? 'earn' : 'redeem'}, ${isGift ? 'Flagrr Cash gifted' : 'Flagrr Cash adjusted'}, ${reason}, ${amount})
  `;
  // Keeps the per-member monthly bar chart (SuperAdminMemberStatsScreen /
  // AdminMemberStatsScreen) consistent with everywhere else a gift now
  // shows up.
  await sql`
    insert into monthly_points (user_id, year, month, value)
    values (${userId}, ${now.getFullYear()}, ${now.getMonth() + 1}, ${amount})
    on conflict (user_id, year, month) do update set value = monthly_points.value + excluded.value
  `;

  const title = isGift ? 'Flagrr Cash gifted to you' : 'Flagrr Cash adjusted';
  const body = isGift
    ? `You've been gifted ${amount} Flagrr Cash: ${reason}`
    : `${Math.abs(amount)} Flagrr Cash was deducted from your balance: ${reason}`;
  await sql`insert into notifications (user_id, title, body) values (${userId}, ${title}, ${body})`;
  await sendPushToUser(userId, { title, body }, 'accountActivity');

  return { newBalance: rows[0].balance };
}
