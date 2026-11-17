// Golf on the admin dashboards: a club's numbers worked out from the rounds
// its members play on its course (and share with the club). Built on the same
// computeGolfStats a member sees in My Golf, so a member's row here always
// matches their own screen. Pure TypeScript, run by the API
// (api/_lib/golfClub.ts) and unit tested in api/_lib/golfScoring.test.ts.

import { computeGolfStats, type CompletedRound, type GolfStats, type RoundSummary } from './stats';

export type GolfPeriod = 'month' | 'year' | 'all';

export interface ClubRound extends CompletedRound {
  userId: string;
}

export interface ClubMember {
  userId: string;
  firstName: string;
  lastName: string;
  handicapIndex: number | null;
}

export interface GolfMemberRow {
  userId: string;
  firstName: string;
  lastName: string;
  handicapIndex: number | null;
  rounds: number;
  basis: 18 | 9 | null;
  pointsAverage: number | null;
  bestPoints: number | null;
  scoringAverage: number | null;
  lastPlayedAt: string;
  // Points in their last (up to) eight rounds of the basis length, oldest first.
  trend: number[];
}

export interface GolfLatestRound extends RoundSummary {
  userId: string;
  memberName: string;
}

export interface GolfSeriesPoint {
  month: string; // the bar's label (a day, a month initial or a year); named to fit BarChart
  value: number;
}

export interface GolfClubSummary {
  rounds: number;
  membersPlaying: number;
  basis: 18 | 9 | null;
  pointsAverage: number | null;
  playedToHandicapPct: number | null;
  puttsPer18: number | null;
  puttsMembers: number; // members with putts entered on at least one hole
  mixPer18: GolfStats['mixPer18'];
  toughestHoles: GolfStats['toughestHoles'];
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Every number a club's Golf page shows for one period. */
export function clubSummary(rounds: ClubRound[], golfCourseId: string | null): { summary: GolfClubSummary; stats: GolfStats } {
  const stats = computeGolfStats(rounds, golfCourseId);
  const members = new Set(rounds.map((r) => r.userId));
  const putters = new Set(rounds.filter((r) => r.entries.some((e) => e?.putts != null)).map((r) => r.userId));
  return {
    stats,
    summary: {
      rounds: stats.rounds,
      membersPlaying: members.size,
      basis: stats.basis,
      pointsAverage: stats.pointsAverage,
      playedToHandicapPct: stats.basisRounds ? (stats.playedToHandicap / stats.basisRounds) * 100 : null,
      puttsPer18: stats.putting?.puttsPer18 ?? null,
      puttsMembers: putters.size,
      mixPer18: stats.mixPer18,
      toughestHoles: stats.toughestHoles,
    },
  };
}

/** One row per member who played in the period, best Stableford average first. */
export function memberRows(rounds: ClubRound[], members: ClubMember[], golfCourseId: string | null): GolfMemberRow[] {
  const byUser = new Map<string, ClubRound[]>();
  for (const r of rounds) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const info = new Map(members.map((m) => [m.userId, m]));
  const rows: GolfMemberRow[] = [];
  for (const [userId, rs] of byUser) {
    const m = info.get(userId);
    if (!m) continue;
    const s = computeGolfStats(rs, golfCourseId);
    rows.push({
      userId,
      firstName: m.firstName,
      lastName: m.lastName,
      handicapIndex: m.handicapIndex,
      rounds: s.rounds,
      basis: s.basis,
      pointsAverage: s.pointsAverage,
      bestPoints: s.bestPoints?.points ?? null,
      scoringAverage: s.scoringAverage,
      lastPlayedAt: rs.reduce((a, r) => (r.completedAt > a ? r.completedAt : a), rs[0].completedAt),
      trend: s.pointsTrend.slice(-8).map((p) => p.points),
    });
  }
  // 18-hole averages before 9-hole ones (they aren't comparable), then highest first.
  const rank = (r: GolfMemberRow) => (r.basis === 18 ? 0 : 1);
  return rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.pointsAverage ?? -1) - (a.pointsAverage ?? -1) ||
      b.rounds - a.rounds ||
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
  );
}

/** The newest rounds, each with the member who played it. */
export function latestRounds(stats: GolfStats, rounds: ClubRound[], members: ClubMember[], limit = 8): GolfLatestRound[] {
  const owner = new Map(rounds.map((r) => [r.id, r.userId]));
  const info = new Map(members.map((m) => [m.userId, m]));
  return stats.recent.slice(0, limit).map((r) => {
    const userId = owner.get(r.id) ?? '';
    const m = info.get(userId);
    return { ...r, userId, memberName: m ? `${m.firstName} ${m.lastName}`.trim() : 'Member' };
  });
}

/** Rounds per day (this month), per month (this year) or per year (all time),
 * counted from completion dates in UTC, the same calendar the period uses. */
export function roundSeries(completedAt: string[], period: GolfPeriod, now: Date = new Date()): GolfSeriesPoint[] {
  const dates = completedAt.map((d) => new Date(d));
  if (period === 'month') {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const days = now.getUTCDate();
    const counts = new Array(days).fill(0);
    for (const d of dates) if (d.getUTCFullYear() === y && d.getUTCMonth() === m) counts[d.getUTCDate() - 1]++;
    return counts.map((value, i) => ({ month: String(i + 1), value }));
  }
  if (period === 'year') {
    const y = now.getUTCFullYear();
    const counts = new Array(now.getUTCMonth() + 1).fill(0);
    for (const d of dates) if (d.getUTCFullYear() === y) counts[d.getUTCMonth()]++;
    return counts.map((value, i) => ({ month: MONTH_INITIALS[i], value }));
  }
  const last = now.getUTCFullYear();
  const first = dates.length ? Math.min(last, ...dates.map((d) => d.getUTCFullYear())) : last;
  const out: GolfSeriesPoint[] = [];
  for (let yr = first; yr <= last; yr++) out.push({ month: String(yr), value: dates.filter((d) => d.getUTCFullYear() === yr).length });
  return out;
}

