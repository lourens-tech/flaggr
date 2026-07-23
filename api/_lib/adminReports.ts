import { sql } from './db';
import { deltaPct, periodWindow, type StatsPeriod } from './periods';
import { MONTH_LETTERS } from './monthly';

export interface DashboardReport {
  period: StatsPeriod;
  totals: {
    members: number;
    newMembers: number;
    fcEarned: number;
    fcEarnedDeltaPct: number;
    fcRedeemed: number;
    fcRedeemedDeltaPct: number;
    receiptsScanned: number;
    receiptsScannedDeltaPct: number;
  };
  tierDistribution: Array<{ tier: string; count: number }>;
  topRewards: Array<{ rewardId: string; title: string; redemptions: number; fcSpent: number }>;
  signupsByMonth: Array<{ month: string; value: number }>;
}

// Ad performance (ads/ad_clicks) is deliberately excluded from the
// course-admin dashboard — only a super_admin should see how an ad they
// manage is performing across clubs. Revisit when the super-admin side
// is built.
export async function getDashboardReport(courseId: string, period: StatsPeriod): Promise<DashboardReport> {
  const { currentStart, previousStart, previousEnd, hasComparison } = periodWindow(period);

  const [memberRows, bucksRows, receiptRows, tierRows, topRewardRows, signupRows] = await Promise.all([
    sql`
      select
        count(*)::int as total,
        count(*) filter (where member_since >= ${currentStart})::int as new_current
      from users where course_id = ${courseId}
    `,
    sql`
      select
        coalesce(sum(a.amount) filter (where a.type = 'earn' and a.date >= ${currentStart}), 0)::int as earned_current,
        coalesce(sum(a.amount) filter (where a.type = 'earn' and a.date >= ${previousStart} and a.date < ${previousEnd}), 0)::int as earned_previous,
        coalesce(sum(-a.amount) filter (where a.type = 'redeem' and a.date >= ${currentStart}), 0)::int as redeemed_current,
        coalesce(sum(-a.amount) filter (where a.type = 'redeem' and a.date >= ${previousStart} and a.date < ${previousEnd}), 0)::int as redeemed_previous
      from activity a
      join users u on u.id = a.user_id
      where u.course_id = ${courseId}
    `,
    sql`
      select
        count(*) filter (where submitted_at >= ${currentStart})::int as current,
        count(*) filter (where submitted_at >= ${previousStart} and submitted_at < ${previousEnd})::int as previous
      from receipts where course_id = ${courseId}
    `,
    sql`
      select tier, count(*)::int as count from users where course_id = ${courseId} group by tier
    `,
    sql`
      select r.id as reward_id, r.title, count(v.id)::int as redemptions, coalesce(sum(v.cost), 0)::int as fc_spent
      from vouchers v
      join rewards r on r.id = v.reward_id
      where r.course_id = ${courseId} and v.issued_at >= ${currentStart}
      group by r.id, r.title
      order by redemptions desc
      limit 10
    `,
    sql`
      select extract(month from member_since)::int as month, count(*)::int as count
      from users
      where course_id = ${courseId} and extract(year from member_since) = extract(year from now())
      group by month
    `,
  ]);

  const member = (memberRows as Array<{ total: number; new_current: number }>)[0];
  const bucks = (bucksRows as Array<{
    earned_current: number;
    earned_previous: number;
    redeemed_current: number;
    redeemed_previous: number;
  }>)[0];
  const receipts = (receiptRows as Array<{ current: number; previous: number }>)[0];

  const signupsByMonthCounts = new Map<number, number>();
  for (const row of signupRows as Array<{ month: number; count: number }>) {
    signupsByMonthCounts.set(row.month, row.count);
  }
  const signupsByMonth = MONTH_LETTERS.map((letter, i) => ({
    month: letter,
    value: signupsByMonthCounts.get(i + 1) ?? 0,
  }));

  return {
    period,
    totals: {
      members: member.total,
      newMembers: member.new_current,
      fcEarned: bucks.earned_current,
      fcEarnedDeltaPct: deltaPct(bucks.earned_current, bucks.earned_previous, hasComparison),
      fcRedeemed: bucks.redeemed_current,
      fcRedeemedDeltaPct: deltaPct(bucks.redeemed_current, bucks.redeemed_previous, hasComparison),
      receiptsScanned: receipts.current,
      receiptsScannedDeltaPct: deltaPct(receipts.current, receipts.previous, hasComparison),
    },
    tierDistribution: tierRows as Array<{ tier: string; count: number }>,
    topRewards: (topRewardRows as Array<{ reward_id: string; title: string; redemptions: number; fc_spent: number }>).map(
      (r) => ({ rewardId: r.reward_id, title: r.title, redemptions: r.redemptions, fcSpent: r.fc_spent }),
    ),
    signupsByMonth,
  };
}
