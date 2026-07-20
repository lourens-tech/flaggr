import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_lib/db';
import { requireAuthedUser } from './_lib/auth';
import { withErrorHandling } from './_lib/http';
import { computeTierInfo } from './_lib/tiers';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authed = await requireAuthedUser(req);

  const rows = (await sql`
    select
      u.id, u.first_name, u.last_name, u.email, u.phone, u.member_since, u.avatar_url,
      c.name as course_name,
      p.balance, p.total_earned, p.total_redeemed,
      s.weeks, s.active_since, s.weeks_played,
      st.rounds_played_9, st.rounds_played_9_delta_pct,
      st.rounds_played_18, st.rounds_played_18_delta_pct,
      st.bucks_earned, st.bucks_earned_delta_pct,
      st.bucks_redeemed, st.bucks_redeemed_delta_pct
    from users u
    join courses c on c.id = u.course_id
    join points_accounts p on p.user_id = u.id
    join streaks s on s.user_id = u.id
    join user_stats st on st.user_id = u.id
    where u.id = ${authed.id}
  `) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    member_since: string;
    avatar_url: string | null;
    course_name: string;
    balance: number;
    total_earned: number;
    total_redeemed: number;
    weeks: number;
    active_since: string;
    weeks_played: boolean[];
    rounds_played_9: number;
    rounds_played_9_delta_pct: string;
    rounds_played_18: number;
    rounds_played_18_delta_pct: string;
    bucks_earned: number;
    bucks_earned_delta_pct: string;
    bucks_redeemed: number;
    bucks_redeemed_delta_pct: string;
  }>;

  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const r = rows[0];

  const monthlyRows = (await sql`
    select month, value from monthly_points where user_id = ${authed.id}
  `) as Array<{ month: string; value: number }>;

  const tierInfo = computeTierInfo(r.balance);

  res.status(200).json({
    user: {
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
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
      weeks: r.weeks,
      activeSince: r.active_since,
      weeksPlayed: r.weeks_played,
    },
    stats: {
      roundsPlayed9: r.rounds_played_9,
      roundsPlayed9DeltaPct: Number(r.rounds_played_9_delta_pct),
      roundsPlayed18: r.rounds_played_18,
      roundsPlayed18DeltaPct: Number(r.rounds_played_18_delta_pct),
      bucksEarned: r.bucks_earned,
      bucksEarnedDeltaPct: Number(r.bucks_earned_delta_pct),
      bucksRedeemed: r.bucks_redeemed,
      bucksRedeemedDeltaPct: Number(r.bucks_redeemed_delta_pct),
      monthly: monthlyRows,
    },
  });
});
