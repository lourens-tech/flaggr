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
// course-admin dashboard — only a super_admin sees how an ad is performing
// across clubs (see getAdPerformanceReport below).
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

export type CourseReportKind = 'redemptions' | 'receipts' | 'members';

export interface RedemptionReportRow {
  code: string;
  memberName: string;
  memberEmail: string;
  rewardTitle: string;
  variantLabel: string;
  cost: number;
  status: string;
  issuedAt: string;
  redeemedAt: string | null;
}

// Shared by the Overview screen's "Flagrr Cash Redeemed" detail table and
// its Excel download (exportReport, 'redemptions') — one query, so the two
// can never drift apart.
export async function listRedemptionsReport(courseId: string, period: StatsPeriod): Promise<RedemptionReportRow[]> {
  const { currentStart } = periodWindow(period);
  const rows = (await sql`
    select v.code, u.first_name, u.last_name, u.email, r.title, v.variant_label, v.cost, v.status, v.issued_at, v.redeemed_at
    from vouchers v
    join rewards r on r.id = v.reward_id
    join users u on u.id = v.user_id
    where r.course_id = ${courseId} and v.issued_at >= ${currentStart}
    order by v.issued_at desc
  `) as Array<{
    code: string;
    first_name: string;
    last_name: string;
    email: string;
    title: string;
    variant_label: string;
    cost: number;
    status: string;
    issued_at: string;
    redeemed_at: string | null;
  }>;
  return rows.map((r) => ({
    code: r.code,
    memberName: `${r.first_name} ${r.last_name}`,
    memberEmail: r.email,
    rewardTitle: r.title,
    variantLabel: r.variant_label,
    cost: r.cost,
    status: r.status,
    issuedAt: r.issued_at,
    redeemedAt: r.redeemed_at,
  }));
}

export interface ReceiptReportRow {
  receiptNumber: string | null;
  memberName: string;
  memberEmail: string;
  whereScanned: string;
  total: number;
  pointsAwarded: number | null;
  status: string;
  submittedAt: string;
}

// Shared by the "Flagrr Cash Earned"/"Receipts Scanned" detail table (both
// point at the same underlying receipts) and its Excel download.
export async function listReceiptsReport(courseId: string, period: StatsPeriod): Promise<ReceiptReportRow[]> {
  const { currentStart } = periodWindow(period);
  const rows = (await sql`
    select r.receipt_number, u.first_name, u.last_name, u.email, r.course_name, r.total, r.points_awarded, r.status, r.submitted_at
    from receipts r
    join users u on u.id = r.user_id
    where r.course_id = ${courseId} and r.submitted_at >= ${currentStart}
    order by r.submitted_at desc
  `) as Array<{
    receipt_number: string | null;
    first_name: string;
    last_name: string;
    email: string;
    course_name: string;
    total: number;
    points_awarded: number | null;
    status: string;
    submitted_at: string;
  }>;
  return rows.map((r) => ({
    receiptNumber: r.receipt_number,
    memberName: `${r.first_name} ${r.last_name}`,
    memberEmail: r.email,
    whereScanned: r.course_name,
    total: Number(r.total),
    pointsAwarded: r.points_awarded,
    status: r.status,
    submittedAt: r.submitted_at,
  }));
}

export interface MemberReportRow {
  firstName: string;
  lastName: string;
  email: string;
  tier: string;
  memberSince: string;
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
}

// Shared by the "Members"/"New Members" detail table and its Excel
// download. period='all' matches "Members" (every member); any other
// period filters to members who joined within that window, matching
// "New Members" — the same currentStart floor used everywhere else.
export async function listMembersReport(courseId: string, period: StatsPeriod): Promise<MemberReportRow[]> {
  const { currentStart } = periodWindow(period);
  const rows = (await sql`
    select u.first_name, u.last_name, u.email, u.tier, u.member_since, p.balance, p.total_earned, p.total_redeemed
    from users u join points_accounts p on p.user_id = u.id
    where u.course_id = ${courseId} and (${period}::text = 'all' or u.member_since >= ${currentStart})
    order by u.member_since desc
  `) as Array<{
    first_name: string;
    last_name: string;
    email: string;
    tier: string;
    member_since: string;
    balance: number;
    total_earned: number;
    total_redeemed: number;
  }>;
  return rows.map((r) => ({
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    tier: r.tier,
    memberSince: r.member_since,
    balance: r.balance,
    totalEarned: r.total_earned,
    totalRedeemed: r.total_redeemed,
  }));
}

export interface SuperAdminMemberReportRow extends MemberReportRow {
  courseName: string;
}

// Cross-club counterpart of listMembersReport, for super_admin's Tier
// Distribution detail page (every member, every club, annotated with which
// club they belong to).
export async function listSuperAdminMembersReport(period: StatsPeriod): Promise<SuperAdminMemberReportRow[]> {
  const { currentStart } = periodWindow(period);
  const rows = (await sql`
    select u.first_name, u.last_name, u.email, u.tier, u.member_since, p.balance, p.total_earned, p.total_redeemed, c.name as course_name
    from users u
    join points_accounts p on p.user_id = u.id
    join courses c on c.id = u.course_id
    where u.member_since >= ${currentStart}
    order by u.member_since desc
  `) as Array<{
    first_name: string;
    last_name: string;
    email: string;
    tier: string;
    member_since: string;
    balance: number;
    total_earned: number;
    total_redeemed: number;
    course_name: string;
  }>;
  return rows.map((r) => ({
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    tier: r.tier,
    memberSince: r.member_since,
    balance: r.balance,
    totalEarned: r.total_earned,
    totalRedeemed: r.total_redeemed,
    courseName: r.course_name,
  }));
}

export interface SuperAdminRedemptionReportRow extends RedemptionReportRow {
  courseName: string;
}

// Cross-club counterpart of listRedemptionsReport, for super_admin's Top
// Redeemed Rewards detail page (every redemption, every club).
export async function listSuperAdminRedemptionsReport(period: StatsPeriod): Promise<SuperAdminRedemptionReportRow[]> {
  const { currentStart } = periodWindow(period);
  const rows = (await sql`
    select v.code, u.first_name, u.last_name, u.email, r.title, v.variant_label, v.cost, v.status, v.issued_at, v.redeemed_at, c.name as course_name
    from vouchers v
    join rewards r on r.id = v.reward_id
    join users u on u.id = v.user_id
    join courses c on c.id = r.course_id
    where v.issued_at >= ${currentStart}
    order by v.issued_at desc
  `) as Array<{
    code: string;
    first_name: string;
    last_name: string;
    email: string;
    title: string;
    variant_label: string;
    cost: number;
    status: string;
    issued_at: string;
    redeemed_at: string | null;
    course_name: string;
  }>;
  return rows.map((r) => ({
    code: r.code,
    memberName: `${r.first_name} ${r.last_name}`,
    memberEmail: r.email,
    rewardTitle: r.title,
    variantLabel: r.variant_label,
    cost: r.cost,
    status: r.status,
    issuedAt: r.issued_at,
    redeemedAt: r.redeemed_at,
    courseName: r.course_name,
  }));
}

export interface SuperAdminDashboardReport extends DashboardReport {
  totals: DashboardReport['totals'] & { clubs: number };
}

// Same shape as getDashboardReport, minus the course_id scoping — a
// super_admin sees numbers across every club instead of just their own.
export async function getSuperAdminDashboardReport(period: StatsPeriod): Promise<SuperAdminDashboardReport> {
  const { currentStart, previousStart, previousEnd, hasComparison } = periodWindow(period);

  const [clubRows, memberRows, bucksRows, receiptRows, tierRows, topRewardRows, signupRows] = await Promise.all([
    sql`select count(*)::int as total from courses`,
    sql`
      select
        count(*)::int as total,
        count(*) filter (where member_since >= ${currentStart})::int as new_current
      from users
    `,
    sql`
      select
        coalesce(sum(a.amount) filter (where a.type = 'earn' and a.date >= ${currentStart}), 0)::int as earned_current,
        coalesce(sum(a.amount) filter (where a.type = 'earn' and a.date >= ${previousStart} and a.date < ${previousEnd}), 0)::int as earned_previous,
        coalesce(sum(-a.amount) filter (where a.type = 'redeem' and a.date >= ${currentStart}), 0)::int as redeemed_current,
        coalesce(sum(-a.amount) filter (where a.type = 'redeem' and a.date >= ${previousStart} and a.date < ${previousEnd}), 0)::int as redeemed_previous
      from activity a
    `,
    sql`
      select
        count(*) filter (where submitted_at >= ${currentStart})::int as current,
        count(*) filter (where submitted_at >= ${previousStart} and submitted_at < ${previousEnd})::int as previous
      from receipts
    `,
    sql`select tier, count(*)::int as count from users group by tier`,
    sql`
      select r.id as reward_id, r.title, count(v.id)::int as redemptions, coalesce(sum(v.cost), 0)::int as fc_spent
      from vouchers v
      join rewards r on r.id = v.reward_id
      where v.issued_at >= ${currentStart}
      group by r.id, r.title
      order by redemptions desc
      limit 10
    `,
    sql`
      select extract(month from member_since)::int as month, count(*)::int as count
      from users
      where extract(year from member_since) = extract(year from now())
      group by month
    `,
  ]);

  const clubs = (clubRows as Array<{ total: number }>)[0].total;
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
      clubs,
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

// Ad performance reporting lives in api/_lib/adAnalytics.ts (its own file —
// a genuinely separate feature area: impressions/clicks/CTR, trend
// buckets, and a per-ad click log, not just another dashboard total).

export type StatBreakdownMetric = 'members' | 'newMembers' | 'fcEarned' | 'fcRedeemed' | 'receiptsScanned';

export interface StatBreakdownRow {
  courseId: string;
  courseName: string;
  value: number;
}

// Per-club breakdown for a single stat card on the super-admin Reports
// screen — every club is listed (0 if it has no activity in the period),
// sorted highest first, so a super_admin can see which clubs are driving
// (or dragging down) the aggregate number shown on that card.
export async function getSuperAdminStatBreakdown(
  period: StatsPeriod,
  metric: StatBreakdownMetric,
): Promise<StatBreakdownRow[]> {
  const { currentStart } = periodWindow(period);

  let rows: Array<{ course_id: string; course_name: string; value: number }>;
  if (metric === 'members') {
    rows = (await sql`
      select c.id as course_id, c.name as course_name, count(u.id)::int as value
      from courses c
      left join users u on u.course_id = c.id
      group by c.id, c.name
    `) as typeof rows;
  } else if (metric === 'newMembers') {
    rows = (await sql`
      select c.id as course_id, c.name as course_name, count(u.id)::int as value
      from courses c
      left join users u on u.course_id = c.id and u.member_since >= ${currentStart}
      group by c.id, c.name
    `) as typeof rows;
  } else if (metric === 'fcEarned') {
    rows = (await sql`
      select c.id as course_id, c.name as course_name,
        coalesce(sum(a.amount) filter (where a.type = 'earn' and a.date >= ${currentStart}), 0)::int as value
      from courses c
      left join users u on u.course_id = c.id
      left join activity a on a.user_id = u.id
      group by c.id, c.name
    `) as typeof rows;
  } else if (metric === 'fcRedeemed') {
    rows = (await sql`
      select c.id as course_id, c.name as course_name,
        coalesce(sum(-a.amount) filter (where a.type = 'redeem' and a.date >= ${currentStart}), 0)::int as value
      from courses c
      left join users u on u.course_id = c.id
      left join activity a on a.user_id = u.id
      group by c.id, c.name
    `) as typeof rows;
  } else {
    rows = (await sql`
      select c.id as course_id, c.name as course_name,
        count(r.id) filter (where r.submitted_at >= ${currentStart})::int as value
      from courses c
      left join receipts r on r.course_id = c.id
      group by c.id, c.name
    `) as typeof rows;
  }

  return rows
    .map((r) => ({ courseId: r.course_id, courseName: r.course_name, value: Number(r.value) }))
    .sort((a, b) => b.value - a.value);
}
