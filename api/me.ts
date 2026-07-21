import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_lib/db';
import { requireAuthedUser } from './_lib/auth';
import { withErrorHandling } from './_lib/http';
import { computeQuarterlyTierInfo } from './_lib/tiers';
import { deltaPct, isStatsPeriod, periodWindow, type StatsPeriod } from './_lib/periods';
import { computeStreak } from './_lib/streak';
import { quarterWindow } from './_lib/quarter';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authed = await requireAuthedUser(req);
  const period: StatsPeriod = isStatsPeriod(req.query.period) ? req.query.period : 'year';
  const { currentStart, previousStart, previousEnd, hasComparison } = periodWindow(period);
  const qw = quarterWindow();

  const rows = (await sql`
    select
      u.id, u.first_name, u.last_name, u.email, u.phone, u.date_of_birth, u.member_since, u.avatar_url,
      c.name as course_name,
      p.balance, p.total_earned, p.total_redeemed
    from users u
    join courses c on c.id = u.course_id
    join points_accounts p on p.user_id = u.id
    where u.id = ${authed.id}
  `) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    date_of_birth: string | null;
    member_since: string;
    avatar_url: string | null;
    course_name: string;
    balance: number;
    total_earned: number;
    total_redeemed: number;
  }>;

  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const r = rows[0];

  const [bucksResult, roundsResult, monthlyResult, quarterTierResult, streak] = await Promise.all([
    sql`
      select
        coalesce(sum(amount) filter (where type = 'earn' and date >= ${currentStart}), 0)::int as earned_current,
        coalesce(sum(amount) filter (where type = 'earn' and date >= ${previousStart} and date < ${previousEnd}), 0)::int as earned_previous,
        coalesce(sum(-amount) filter (where type = 'redeem' and date >= ${currentStart}), 0)::int as redeemed_current,
        coalesce(sum(-amount) filter (where type = 'redeem' and date >= ${previousStart} and date < ${previousEnd}), 0)::int as redeemed_previous
      from activity
      where user_id = ${authed.id}
    `,
    sql`
      select
        coalesce(sum(ri.quantity) filter (where ga.name = '9 Hole Round' and r.submitted_at >= ${currentStart}), 0)::int as r9_current,
        coalesce(sum(ri.quantity) filter (where ga.name = '9 Hole Round' and r.submitted_at >= ${previousStart} and r.submitted_at < ${previousEnd}), 0)::int as r9_previous,
        coalesce(sum(ri.quantity) filter (where ga.name = '18 Hole Round' and r.submitted_at >= ${currentStart}), 0)::int as r18_current,
        coalesce(sum(ri.quantity) filter (where ga.name = '18 Hole Round' and r.submitted_at >= ${previousStart} and r.submitted_at < ${previousEnd}), 0)::int as r18_previous
      from receipts r
      join receipt_items ri on ri.receipt_id = r.id
      join golf_activities ga on ga.id = ri.matched_activity_id
      where r.user_id = ${authed.id}
    `,
    sql`
      select month, value from monthly_points
      where user_id = ${authed.id} and year = extract(year from now())::int
    `,
    sql`
      select
        coalesce(sum(amount) filter (where type = 'earn' and date >= ${qw.currentStart} and date < ${qw.currentEnd}), 0)::int as current_quarter_earned,
        coalesce(sum(amount) filter (where type = 'earn' and date >= ${qw.previousStart} and date < ${qw.previousEnd}), 0)::int as previous_quarter_earned
      from activity
      where user_id = ${authed.id}
    `,
    computeStreak(authed.id),
  ]);

  const bucks = (bucksResult as Array<{
    earned_current: number;
    earned_previous: number;
    redeemed_current: number;
    redeemed_previous: number;
  }>)[0];
  const rounds = (roundsResult as Array<{
    r9_current: number;
    r9_previous: number;
    r18_current: number;
    r18_previous: number;
  }>)[0];
  const monthlyRows = monthlyResult as Array<{ month: string; value: number }>;
  const quarterEarned = (quarterTierResult as Array<{
    current_quarter_earned: number;
    previous_quarter_earned: number;
  }>)[0];
  const tierInfo = computeQuarterlyTierInfo(quarterEarned.current_quarter_earned, quarterEarned.previous_quarter_earned);

  res.status(200).json({
    user: {
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      dateOfBirth: r.date_of_birth,
      homeClub: r.course_name,
      tier: tierInfo.tier,
      memberSince: r.member_since,
      avatarUrl: r.avatar_url,
    },
    points: {
      balance: r.balance,
      totalEarned: r.total_earned,
      totalRedeemed: r.total_redeemed,
      pointsToNextTier: tierInfo.pointsToNextTier,
      nextTier: tierInfo.nextTier,
      tierProgress: tierInfo.tierProgress,
    },
    streak: {
      weeks: streak.weeks,
      activeSince: streak.activeSince,
      weeksPlayed: streak.weeksPlayed,
    },
    stats: {
      period,
      roundsPlayed9: rounds.r9_current,
      roundsPlayed9DeltaPct: deltaPct(rounds.r9_current, rounds.r9_previous, hasComparison),
      roundsPlayed18: rounds.r18_current,
      roundsPlayed18DeltaPct: deltaPct(rounds.r18_current, rounds.r18_previous, hasComparison),
      bucksEarned: bucks.earned_current,
      bucksEarnedDeltaPct: deltaPct(bucks.earned_current, bucks.earned_previous, hasComparison),
      bucksRedeemed: bucks.redeemed_current,
      bucksRedeemedDeltaPct: deltaPct(bucks.redeemed_current, bucks.redeemed_previous, hasComparison),
      monthly: monthlyRows,
    },
  });
});
