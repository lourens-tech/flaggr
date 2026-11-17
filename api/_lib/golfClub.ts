// Golf on the admin dashboards, dispatched from api/admin/index.ts: a club
// sees the rounds its own members play on its own course, the stats from
// them and each round's scorecard; a super_admin sees every club side by side
// and can open any club's view. Read-only: only the member changes a round.
//
// Which rounds count (owner's decisions, 2026-11-17):
// - completed rounds on the club's own course map (golf_courses.club_id),
// - played by members of that club (users.course_id),
// - whose golf profile shares rounds with the club (on by default; a member
//   with no golf profile yet counts as sharing).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './db';
import { HttpError } from './http';
import { deltaPct, isStatsPeriod, periodWindow, type StatsPeriod } from './periods';
import { roundDto, setupOf, type RoundRow } from './golf';
import { computeGolfStats } from '../../mobile/src/golf/stats';
import { clubSummary, latestRounds, memberRows, roundSeries, type ClubMember, type ClubRound } from '../../mobile/src/golf/clubStats';
import type {
  GolfClubOverviewDto,
  GolfMapStatus,
  GolfMemberDetailDto,
  GolfScorecardDto,
  SuperAdminGolfDto,
} from '../../mobile/src/golf/adminDto';

export const COURSE_ADMIN_GOLF_CLUB_ACTIONS = ['golfOverview', 'golfMember', 'golfScorecard'];
export const SUPER_ADMIN_GOLF_CLUB_ACTIONS = ['superAdminGolf', 'superAdminGolfClub', 'superAdminGolfMember', 'superAdminGolfScorecard'];

const UUID = /^[0-9a-f-]{36}$/i;

function requireId(v: unknown, what: string): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new HttpError(400, `${what} is required.`);
  return v;
}

const periodOf = (v: unknown): StatsPeriod => (isStatsPeriod(v) ? v : 'year');

interface ClubContext {
  clubName: string;
  golfCourseId: string | null;
  courseName: string | null;
  mapStatus: GolfMapStatus;
}

async function clubContext(courseId: string): Promise<ClubContext> {
  const rows = (await sql`
    select c.name, g.id as golf_course_id, g.name as course_name, g.status
    from courses c left join golf_courses g on g.club_id = c.id
    where c.id = ${courseId}
  `) as Array<{ name: string; golf_course_id: string | null; course_name: string | null; status: 'live' | 'draft' | null }>;
  const r = rows[0];
  if (!r) throw new HttpError(404, 'Club not found.');
  return { clubName: r.name, golfCourseId: r.golf_course_id, courseName: r.course_name, mapStatus: r.status ?? null };
}

type ClubRoundRow = Pick<
  RoundRow,
  'id' | 'golf_course_id' | 'course_name' | 'tee_name' | 'tee_color' | 'holes' | 'entries' | 'course_handicap' | 'playing_handicap'
> & { user_id: string; completed_at: string; first_name: string; last_name: string; handicap_index: string | null };

/** The club's shared rounds on its course since `since`, optionally for one member. */
async function clubRounds(courseId: string, golfCourseId: string, since: Date, userId: string | null = null) {
  const rows = (await sql`
    select r.id, r.user_id, r.completed_at, r.golf_course_id, r.course_name, r.tee_name, r.tee_color, r.holes, r.entries,
      r.course_handicap, r.playing_handicap, u.first_name, u.last_name, p.handicap_index
    from golf_rounds r
    join users u on u.id = r.user_id
    left join golf_profiles p on p.user_id = r.user_id
    where r.status = 'completed' and r.golf_course_id = ${golfCourseId} and u.course_id = ${courseId}
      and coalesce(p.share_with_club, true) and r.completed_at >= ${since.toISOString()}
      and (${userId}::uuid is null or r.user_id = ${userId}::uuid)
    order by r.completed_at
  `) as ClubRoundRow[];
  const rounds: ClubRound[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    completedAt: new Date(r.completed_at).toISOString(),
    golfCourseId: r.golf_course_id,
    courseName: r.course_name,
    teeName: r.tee_name,
    teeColor: r.tee_color,
    holes: r.holes,
    entries: r.entries,
    handicaps: setupOf(r).handicaps,
  }));
  const members = new Map<string, ClubMember>();
  for (const r of rows) {
    members.set(r.user_id, {
      userId: r.user_id,
      firstName: r.first_name,
      lastName: r.last_name,
      handicapIndex: r.handicap_index == null ? null : Number(r.handicap_index),
    });
  }
  return { rounds, members: [...members.values()] };
}

async function clubOverview(courseId: string, period: StatsPeriod): Promise<GolfClubOverviewDto> {
  const ctx = await clubContext(courseId);
  const base = { period, clubId: courseId, clubName: ctx.clubName, golfCourseId: ctx.golfCourseId, courseName: ctx.courseName, mapStatus: ctx.mapStatus };
  const window = periodWindow(period);
  if (!ctx.golfCourseId) {
    const empty = clubSummary([], null);
    return { ...base, summary: empty.summary, roundsDeltaPct: 0, series: roundSeries([], period), members: [], latest: [] };
  }
  const [{ rounds, members }, prev] = await Promise.all([
    clubRounds(courseId, ctx.golfCourseId, window.currentStart),
    window.hasComparison
      ? (sql`
          select count(*)::int as n from golf_rounds r
          join users u on u.id = r.user_id left join golf_profiles p on p.user_id = r.user_id
          where r.status = 'completed' and r.golf_course_id = ${ctx.golfCourseId} and u.course_id = ${courseId}
            and coalesce(p.share_with_club, true)
            and r.completed_at >= ${window.previousStart.toISOString()} and r.completed_at < ${window.previousEnd.toISOString()}
        ` as unknown as Promise<Array<{ n: number }>>)
      : Promise.resolve([{ n: 0 }]),
  ]);
  const { summary, stats } = clubSummary(rounds, ctx.golfCourseId);
  return {
    ...base,
    summary,
    roundsDeltaPct: deltaPct(summary.rounds, prev[0]?.n ?? 0, window.hasComparison),
    series: roundSeries(rounds.map((r) => r.completedAt), period),
    members: memberRows(rounds, members, ctx.golfCourseId),
    latest: latestRounds(stats, rounds, members),
  };
}

interface MemberRow {
  id: string;
  course_id: string;
  first_name: string;
  last_name: string;
  tier: string;
  handicap_index: string | null;
  format: 'stableford' | 'stroke' | null;
  allowance: string | null;
  track_stats: boolean | null;
  share_with_club: boolean | null;
}

async function memberOf(userId: string, courseId: string | null): Promise<MemberRow> {
  const rows = (await sql`
    select u.id, u.course_id, u.first_name, u.last_name, u.tier, p.handicap_index, p.format, p.allowance, p.track_stats, p.share_with_club
    from users u left join golf_profiles p on p.user_id = u.id
    where u.id = ${userId}
  `) as MemberRow[];
  const m = rows[0];
  if (!m || (courseId && m.course_id !== courseId)) throw new HttpError(404, 'Member not found.');
  if (m.share_with_club === false) throw new HttpError(403, 'This member keeps their rounds private.');
  return m;
}

async function memberDetail(courseId: string | null, userId: string, period: StatsPeriod): Promise<GolfMemberDetailDto> {
  const m = await memberOf(userId, courseId);
  const ctx = await clubContext(m.course_id);
  const { rounds } = ctx.golfCourseId
    ? await clubRounds(m.course_id, ctx.golfCourseId, periodWindow(period).currentStart, m.id)
    : { rounds: [] as ClubRound[] };
  return {
    period,
    clubName: ctx.clubName,
    courseName: ctx.courseName,
    member: {
      id: m.id,
      firstName: m.first_name,
      lastName: m.last_name,
      tier: m.tier,
      handicapIndex: m.handicap_index == null ? null : Number(m.handicap_index),
      format: m.format ?? 'stableford',
      allowance: m.allowance == null ? 0.95 : Number(m.allowance),
      trackStats: m.track_stats ?? false,
    },
    stats: computeGolfStats(rounds, ctx.golfCourseId),
  };
}

async function scorecard(courseId: string | null, roundId: string): Promise<GolfScorecardDto> {
  const rows = (await sql`
    select r.*, u.course_id, u.first_name, u.last_name, c.name as club_name
    from golf_rounds r
    join users u on u.id = r.user_id
    join courses c on c.id = u.course_id
    join golf_courses g on g.id = r.golf_course_id and g.club_id = u.course_id
    left join golf_profiles p on p.user_id = r.user_id
    where r.id = ${roundId} and r.status = 'completed' and coalesce(p.share_with_club, true)
  `) as Array<RoundRow & { user_id: string; course_id: string; first_name: string; last_name: string; club_name: string }>;
  const r = rows[0];
  if (!r || (courseId && r.course_id !== courseId)) throw new HttpError(404, 'Round not found.');
  const siblings = (await sql`
    select id from golf_rounds
    where user_id = ${r.user_id} and golf_course_id = ${r.golf_course_id} and status = 'completed'
    order by completed_at desc, id
  `) as Array<{ id: string }>;
  const i = siblings.findIndex((s) => s.id === r.id);
  return {
    clubName: r.club_name,
    member: { id: r.user_id, firstName: r.first_name, lastName: r.last_name },
    round: roundDto(r),
    nextRoundId: i > 0 ? siblings[i - 1].id : null,
    previousRoundId: i >= 0 && i < siblings.length - 1 ? siblings[i + 1].id : null,
  };
}

async function superAdminGolf(period: StatsPeriod): Promise<SuperAdminGolfDto> {
  const window = periodWindow(period);
  const since = window.currentStart.toISOString();
  // One row per active club, with its map status and its shared rounds in the period.
  const clubRows = (await sql`
    select c.id, c.name, c.logo_url, g.status as map_status,
      count(r.id)::int as rounds,
      count(distinct r.user_id)::int as members,
      count(r.id) filter (where r.n = 18)::int as n18,
      coalesce(sum(r.total_points) filter (where r.n = 18), 0)::int as pts18,
      count(r.id) filter (where r.n = 18 and r.total_points >= 36)::int as hcp18,
      count(r.id) filter (where r.n = 9)::int as n9,
      coalesce(sum(r.total_points) filter (where r.n = 9), 0)::int as pts9,
      count(r.id) filter (where r.n = 9 and r.total_points >= 18)::int as hcp9,
      max(r.completed_at) as last
    from courses c
    left join golf_courses g on g.club_id = c.id
    left join lateral (
      select r.id, r.user_id, r.total_points, r.completed_at, jsonb_array_length(r.holes) as n
      from golf_rounds r
      join users u on u.id = r.user_id
      left join golf_profiles p on p.user_id = r.user_id
      where r.golf_course_id = g.id and u.course_id = c.id and r.status = 'completed'
        and coalesce(p.share_with_club, true) and r.completed_at >= ${since}
    ) r on true
    where c.archived_at is null and not c.is_placeholder
    group by c.id, c.name, c.logo_url, g.status
  `) as Array<{
    id: string;
    name: string;
    logo_url: string | null;
    map_status: 'live' | 'draft' | null;
    rounds: number;
    members: number;
    n18: number;
    pts18: number;
    hcp18: number;
    n9: number;
    pts9: number;
    hcp9: number;
    last: string | null;
  }>;

  const clubs = clubRows
    .map((c) => {
      const basis: 18 | 9 | null = c.n18 ? 18 : c.n9 ? 9 : null;
      const n = basis === 18 ? c.n18 : c.n9;
      return {
        courseId: c.id,
        name: c.name,
        logoUrl: c.logo_url,
        mapStatus: c.map_status ?? null,
        membersPlaying: c.members,
        rounds: c.rounds,
        basis,
        pointsAverage: basis ? (basis === 18 ? c.pts18 : c.pts9) / n : null,
        playedToHandicapPct: basis ? ((basis === 18 ? c.hcp18 : c.hcp9) / n) * 100 : null,
        lastPlayedAt: c.last ? new Date(c.last).toISOString() : null,
      };
    })
    .sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name));

  const qualifying = (from: string, to: string | null) => sql`
    select r.id, r.user_id, r.total_points, r.completed_at, r.tee_name, r.tee_color, jsonb_array_length(r.holes) as n,
      u.first_name, u.last_name, u.course_id, c.name as club_name
    from golf_rounds r
    join users u on u.id = r.user_id
    join courses c on c.id = u.course_id
    join golf_courses g on g.id = r.golf_course_id and g.club_id = u.course_id
    left join golf_profiles p on p.user_id = r.user_id
    where r.status = 'completed' and coalesce(p.share_with_club, true) and c.archived_at is null and not c.is_placeholder
      and r.completed_at >= ${from} and (${to}::timestamptz is null or r.completed_at < ${to}::timestamptz)
  `;
  const [current, previous] = (await Promise.all([
    qualifying(since, null),
    window.hasComparison ? qualifying(window.previousStart.toISOString(), window.previousEnd.toISOString()) : Promise.resolve([]),
  ])) as Array<
    Array<{
      id: string;
      user_id: string;
      total_points: number;
      completed_at: string;
      tee_name: string;
      tee_color: string;
      n: number;
      first_name: string;
      last_name: string;
      course_id: string;
      club_name: string;
    }>
  >;

  const eighteens = current.filter((r) => r.n === 18);
  const best = eighteens
    .slice()
    .sort((a, b) => b.total_points - a.total_points || String(b.completed_at).localeCompare(String(a.completed_at)))
    .slice(0, 5)
    .map((r) => ({
      roundId: r.id,
      userId: r.user_id,
      memberName: `${r.first_name} ${r.last_name}`.trim(),
      courseId: r.course_id,
      clubName: r.club_name,
      teeName: r.tee_name,
      teeColor: r.tee_color,
      points: r.total_points,
      completedAt: new Date(r.completed_at).toISOString(),
    }));

  return {
    period,
    totals: {
      rounds: current.length,
      roundsDeltaPct: deltaPct(current.length, previous.length, window.hasComparison),
      membersPlaying: new Set(current.map((r) => r.user_id)).size,
      clubs: clubs.length,
      liveMaps: clubs.filter((c) => c.mapStatus === 'live').length,
      pointsAverage: eighteens.length ? eighteens.reduce((s, r) => s + r.total_points, 0) / eighteens.length : null,
    },
    clubs,
    best,
    series: roundSeries(current.map((r) => new Date(r.completed_at).toISOString()), period),
  };
}

/** course_admin: their own club only. */
export async function handleCourseAdminGolfClubAction(action: string, courseId: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!COURSE_ADMIN_GOLF_CLUB_ACTIONS.includes(action) || req.method !== 'GET') return false;
  if (action === 'golfOverview') {
    res.status(200).json(await clubOverview(courseId, periodOf(req.query.period)));
  } else if (action === 'golfMember') {
    res.status(200).json(await memberDetail(courseId, requireId(req.query.userId, 'A member'), periodOf(req.query.period)));
  } else {
    res.status(200).json(await scorecard(courseId, requireId(req.query.id, 'A round')));
  }
  return true;
}

/** super_admin: every club, or any one club's view. */
export async function handleSuperAdminGolfClubAction(action: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!SUPER_ADMIN_GOLF_CLUB_ACTIONS.includes(action) || req.method !== 'GET') return false;
  const period = periodOf(req.query.period);
  if (action === 'superAdminGolf') res.status(200).json(await superAdminGolf(period));
  else if (action === 'superAdminGolfClub') res.status(200).json(await clubOverview(requireId(req.query.courseId, 'A club'), period));
  else if (action === 'superAdminGolfMember') res.status(200).json(await memberDetail(null, requireId(req.query.userId, 'A member'), period));
  else res.status(200).json(await scorecard(null, requireId(req.query.id, 'A round')));
  return true;
}
