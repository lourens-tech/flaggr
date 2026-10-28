// Member-side Course Guide and My Golf actions, dispatched from
// api/courses/index.ts (?action=golf*) to stay within the 12-function cap.
// Scoring and stats come from the shared modules in mobile/src/golf/, so the
// totals stored here always match what the member saw on the score bar.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './db';
import { HttpError } from './http';
import { requireAuthedUser, type AuthedUser } from './auth';
import { isStatsPeriod, periodWindow } from './periods';
import {
  GENDERS,
  layoutHoleIndexes,
  ratingFor,
  type CourseMapFile,
  type Gender,
  type Layout,
} from '../../mobile/src/golf/courseMap';
import {
  computeHandicaps,
  entryProblem,
  MAX_INDEX,
  MIN_INDEX,
  roundTotals,
  type Format,
  type HoleEntry,
  type RoundHole,
  type RoundSetup,
} from '../../mobile/src/golf/scoring';
import { computeGolfStats, type CompletedRound } from '../../mobile/src/golf/stats';
import type { Club } from '../../mobile/src/golf/holeGeometry';
import type { GolfCourseSummaryDto, GolfProfileDto, RoundDto } from '../../mobile/src/golf/dto';

const LAYOUTS: Layout[] = ['full', 'front9', 'back9'];
const MAX_BAG_CLUBS = 14;

interface GolfProfileRow {
  handicap_index: string | null;
  rating_gender: Gender;
  format: Format;
  allowance: string;
  bag: Club[] | null;
  track_stats: boolean;
}


async function loadProfile(userId: string): Promise<GolfProfileDto> {
  const rows = (await sql`
    select handicap_index, rating_gender, format, allowance, bag, track_stats from golf_profiles where user_id = ${userId}
  `) as GolfProfileRow[];
  const r = rows[0];
  if (!r) return { handicapIndex: null, ratingGender: 'men', format: 'stableford', allowance: 0.95, bag: null, trackStats: false };
  return {
    handicapIndex: r.handicap_index == null ? null : Number(r.handicap_index),
    ratingGender: r.rating_gender,
    format: r.format,
    allowance: Number(r.allowance) === 1 ? 1 : 0.95,
    bag: r.bag,
    trackStats: r.track_stats,
  };
}

function parseBag(v: unknown): Club[] | null {
  if (v == null) return null;
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_BAG_CLUBS) throw new HttpError(400, `The bag must have 1–${MAX_BAG_CLUBS} clubs.`);
  return v.map((c) => {
    const name = typeof c?.name === 'string' ? c.name.trim() : '';
    const carry = c?.carry;
    if (!name || name.length > 20) throw new HttpError(400, 'Each club needs a name of up to 20 characters.');
    if (!Number.isInteger(carry) || carry < 0 || carry > 350) throw new HttpError(400, `${name}: carry must be 0–350 m.`);
    return { name, carry };
  });
}

async function saveProfile(userId: string, body: Partial<GolfProfileDto>): Promise<GolfProfileDto> {
  const cur = await loadProfile(userId);
  const next: GolfProfileDto = { ...cur };
  if ('handicapIndex' in body) {
    const v = body.handicapIndex;
    if (v !== null && !(typeof v === 'number' && v >= MIN_INDEX && v <= MAX_INDEX && Math.round(v * 10) === v * 10)) {
      throw new HttpError(400, 'Handicap Index must be from +10.0 to 54.0, to one decimal.');
    }
    next.handicapIndex = v ?? null;
  }
  if (body.ratingGender !== undefined) {
    if (!GENDERS.includes(body.ratingGender)) throw new HttpError(400, 'Rating must be men or ladies.');
    next.ratingGender = body.ratingGender;
  }
  if (body.format !== undefined) {
    if (body.format !== 'stableford' && body.format !== 'stroke') throw new HttpError(400, 'Format must be stableford or stroke.');
    next.format = body.format;
  }
  if (body.allowance !== undefined) {
    if (body.allowance !== 0.95 && body.allowance !== 1) throw new HttpError(400, 'Allowance must be 95% or 100%.');
    next.allowance = body.allowance;
  }
  if ('bag' in body) next.bag = parseBag(body.bag);
  if (body.trackStats !== undefined) next.trackStats = body.trackStats === true;

  await sql`
    insert into golf_profiles (user_id, handicap_index, rating_gender, format, allowance, bag, track_stats, updated_at)
    values (${userId}, ${next.handicapIndex}, ${next.ratingGender}, ${next.format}, ${next.allowance},
      ${next.bag ? JSON.stringify(next.bag) : null}::jsonb, ${next.trackStats}, now())
    on conflict (user_id) do update set handicap_index = excluded.handicap_index, rating_gender = excluded.rating_gender,
      format = excluded.format, allowance = excluded.allowance, bag = excluded.bag, track_stats = excluded.track_stats,
      updated_at = now()
  `;
  return next;
}

interface CourseSummaryRow {
  id: string;
  name: string;
  location: string;
  hole_count: number;
  club_id: string | null;
  logo_url: string | null;
}


const courseSummary = (r: CourseSummaryRow, homeClubId: string): GolfCourseSummaryDto => ({
  id: r.id,
  name: r.name,
  location: r.location,
  holeCount: r.hole_count,
  isHome: r.club_id === homeClubId,
  logoUrl: r.logo_url,
});

interface RoundRow {
  id: string;
  golf_course_id: string | null;
  course_name: string;
  tee_id: string;
  tee_name: string;
  tee_color: string;
  rating_gender: Gender;
  layout: Layout;
  format: Format;
  allowance: string;
  handicap_index: string | null;
  course_rating: string;
  slope: number;
  par: number;
  course_handicap: number | null;
  playing_handicap: number | null;
  holes: RoundHole[];
  entries: HoleEntry[];
  track_stats: boolean;
  status: 'in_progress' | 'completed';
  started_at: string;
  completed_at: string | null;
}


const roundDto = (r: RoundRow): RoundDto => ({
  id: r.id,
  golfCourseId: r.golf_course_id,
  courseName: r.course_name,
  teeId: r.tee_id,
  teeName: r.tee_name,
  teeColor: r.tee_color,
  ratingGender: r.rating_gender,
  layout: r.layout,
  format: r.format,
  allowance: Number(r.allowance),
  handicapIndex: r.handicap_index == null ? null : Number(r.handicap_index),
  courseRating: Number(r.course_rating),
  slope: r.slope,
  par: r.par,
  courseHandicap: r.course_handicap,
  playingHandicap: r.playing_handicap,
  holes: r.holes,
  entries: r.entries,
  trackStats: r.track_stats,
  status: r.status,
  startedAt: r.started_at,
  completedAt: r.completed_at,
});

const setupOf = (r: Pick<RoundRow, 'holes' | 'course_handicap' | 'playing_handicap'>): RoundSetup => ({
  holes: r.holes,
  handicaps: r.course_handicap == null || r.playing_handicap == null ? null : { course: r.course_handicap, playing: r.playing_handicap },
});

async function ownRound(user: AuthedUser, id: unknown): Promise<RoundRow> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'A round id is required.');
  const rows = (await sql`select * from golf_rounds where id = ${id} and user_id = ${user.id}`) as RoundRow[];
  if (!rows[0]) throw new HttpError(404, 'Round not found.');
  return rows[0];
}

function parseEntries(holes: RoundHole[], v: unknown, trackStats: boolean): HoleEntry[] {
  if (!Array.isArray(v) || v.length !== holes.length) throw new HttpError(400, `Send one entry for each of the ${holes.length} holes.`);
  return v.map((raw, i) => {
    const e: HoleEntry = {
      s: raw?.s ?? null,
      putts: trackStats ? raw?.putts ?? null : null,
      fw: trackStats ? raw?.fw ?? null : null,
    };
    const problem = entryProblem(holes[i], e);
    if (problem) throw new HttpError(400, problem);
    return e;
  });
}

async function writeEntries(round: RoundRow, entries: HoleEntry[], complete: boolean): Promise<RoundRow> {
  const t = roundTotals(setupOf(round), entries);
  if (complete && t.holesPlayed !== round.holes.length) {
    throw new HttpError(400, `Enter a score (or a pick-up) on every hole before finishing. ${round.holes.length - t.holesPlayed} to go.`);
  }
  const rows = (await sql`
    update golf_rounds set entries = ${JSON.stringify(entries)}::jsonb, total_points = ${t.points}, total_gross = ${t.gross},
      total_adjusted = ${t.adjusted}, holes_played = ${t.holesPlayed}, updated_at = now(),
      status = case when ${complete} then 'completed' else status end,
      completed_at = case when ${complete} and completed_at is null then now() else completed_at end
    where id = ${round.id}
    returning *
  `) as RoundRow[];
  return rows[0];
}

async function homeStatus(user: AuthedUser) {
  const rows = (await sql`
    select c.name, c.is_placeholder, g.id as golf_course_id, g.status
    from courses c left join golf_courses g on g.club_id = c.id
    where c.id = ${user.courseId}
  `) as Array<{ name: string; is_placeholder: boolean; golf_course_id: string | null; status: string | null }>;
  const r = rows[0];
  return {
    clubName: r?.name ?? '',
    isPlaceholderClub: r?.is_placeholder ?? false,
    homeGolfCourseId: r?.status === 'live' ? r.golf_course_id : null,
  };
}

export async function handleGolfAction(action: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!action.startsWith('golf')) return false;
  const user = await requireAuthedUser(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const isPost = req.method === 'POST';

  if (action === 'golfHome' && !isPost) {
    const [home, courseRows, inProgress, profile, recentRows] = await Promise.all([
      homeStatus(user),
      sql`
        select g.id, g.name, g.location, g.hole_count, g.club_id, c.logo_url
        from golf_courses g left join courses c on c.id = g.club_id
        where g.status = 'live' order by g.name
      ` as unknown as Promise<CourseSummaryRow[]>,
      sql`select * from golf_rounds where user_id = ${user.id} and status = 'in_progress'` as unknown as Promise<RoundRow[]>,
      loadProfile(user.id),
      sql`
        select golf_course_id, max(started_at) as last from golf_rounds
        where user_id = ${user.id} and golf_course_id is not null group by golf_course_id order by last desc limit 5
      ` as unknown as Promise<Array<{ golf_course_id: string }>>,
    ]);
    res.status(200).json({
      clubName: home.clubName,
      isPlaceholderClub: home.isPlaceholderClub,
      homeCourse: courseRows.filter((c) => c.id === home.homeGolfCourseId).map((c) => courseSummary(c, user.courseId))[0] ?? null,
      courses: courseRows.map((c) => courseSummary(c, user.courseId)),
      recentCourseIds: recentRows.map((r) => r.golf_course_id),
      inProgress: inProgress[0] ? roundDto(inProgress[0]) : null,
      profile,
    });
    return true;
  }

  if (action === 'golfCourse' && !isPost) {
    const id = req.query.id;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'A course id is required.');
    const rows = (await sql`
      select g.id, g.name, g.location, g.hole_count, g.club_id, g.map, c.logo_url
      from golf_courses g left join courses c on c.id = g.club_id
      where g.id = ${id} and (g.status = 'live' or exists (
        select 1 from golf_rounds r where r.golf_course_id = g.id and r.user_id = ${user.id}
      ))
    `) as Array<CourseSummaryRow & { map: CourseMapFile }>;
    if (!rows[0]) throw new HttpError(404, 'That course map is not available.');
    res.status(200).json({ ...courseSummary(rows[0], user.courseId), map: rows[0].map });
    return true;
  }

  if (action === 'golfProfile') {
    res.status(200).json(isPost ? await saveProfile(user.id, body as Partial<GolfProfileDto>) : await loadProfile(user.id));
    return true;
  }

  if (action === 'golfRoundStart' && isPost) {
    const { golfCourseId, teeId, gender, layout } = body as { golfCourseId?: string; teeId?: string; gender?: Gender; layout?: Layout };
    if (typeof golfCourseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(golfCourseId)) throw new HttpError(400, 'Choose a course.');
    if (!gender || !GENDERS.includes(gender)) throw new HttpError(400, 'Choose men’s or ladies’ ratings.');
    if (!layout || !LAYOUTS.includes(layout)) throw new HttpError(400, 'Choose which holes you are playing.');
    const rows = (await sql`select id, name, map from golf_courses where id = ${golfCourseId} and status = 'live'`) as Array<{
      id: string;
      name: string;
      map: CourseMapFile;
    }>;
    const course = rows[0];
    if (!course) throw new HttpError(404, 'That course map is not available.');
    const map = course.map;
    const tee = map.tees.find((t) => t.id === teeId);
    const card = map.card[gender];
    const rating = tee ? ratingFor(map, tee.id, gender, layout) : null;
    if (!tee || !card || !rating) throw new HttpError(400, 'Those tees are not rated for that choice yet.');

    const idx = layoutHoleIndexes(map.holeCount, layout);
    const holes: RoundHole[] = idx.map((i) => ({ n: i + 1, par: card.par[i], si: card.si[i] as number, length: tee.lengths[i] as number }));
    const par = holes.reduce((s, h) => s + h.par, 0);
    const profile = await saveProfile(user.id, {
      ratingGender: gender,
      ...(body.format !== undefined ? { format: body.format as Format } : {}),
      ...(body.allowance !== undefined ? { allowance: body.allowance as 0.95 | 1 } : {}),
    });
    const hc = profile.handicapIndex == null ? null : computeHandicaps(profile.handicapIndex, rating, par, holes.length, profile.allowance);
    const entries: HoleEntry[] = holes.map(() => ({ s: null, putts: null, fw: null }));
    try {
      const inserted = (await sql`
        insert into golf_rounds (user_id, golf_course_id, course_name, tee_id, tee_name, tee_color, rating_gender, layout, format,
          allowance, handicap_index, course_rating, slope, par, course_handicap, playing_handicap, holes, entries, track_stats)
        values (${user.id}, ${course.id}, ${course.name}, ${tee.id}, ${tee.name}, ${tee.color}, ${gender}, ${layout}, ${profile.format},
          ${profile.allowance}, ${profile.handicapIndex}, ${rating.cr}, ${rating.slope}, ${par}, ${hc?.course ?? null}, ${hc?.playing ?? null},
          ${JSON.stringify(holes)}::jsonb, ${JSON.stringify(entries)}::jsonb, ${profile.trackStats})
        returning *
      `) as RoundRow[];
      res.status(200).json(roundDto(inserted[0]));
    } catch (err) {
      if (err instanceof Error && /golf_rounds_one_in_progress_idx/.test(err.message)) {
        throw new HttpError(409, 'You already have a round in progress. Finish or discard it first.');
      }
      throw err;
    }
    return true;
  }

  if (action === 'golfRound' && !isPost) {
    res.status(200).json(roundDto(await ownRound(user, req.query.id)));
    return true;
  }

  if ((action === 'golfRoundSave' || action === 'golfRoundFinish') && isPost) {
    const round = await ownRound(user, body.id);
    const entries = parseEntries(round.holes, body.entries, round.track_stats);
    const complete = action === 'golfRoundFinish' || round.status === 'completed';
    res.status(200).json(roundDto(await writeEntries(round, entries, complete)));
    return true;
  }

  if (action === 'golfRoundDelete' && isPost) {
    const round = await ownRound(user, body.id);
    await sql`delete from golf_rounds where id = ${round.id}`;
    res.status(200).json({ ok: true });
    return true;
  }

  if (action === 'golfStats' && !isPost) {
    const period = isStatsPeriod(req.query.period) ? req.query.period : 'year';
    const { currentStart } = periodWindow(period);
    const [home, rows, roundCount, profile] = await Promise.all([
      homeStatus(user),
      sql`
        select id, completed_at, golf_course_id, course_name, tee_name, tee_color, holes, entries, course_handicap, playing_handicap
        from golf_rounds where user_id = ${user.id} and status = 'completed' and completed_at >= ${currentStart.toISOString()}
        order by completed_at
      ` as unknown as Promise<Array<RoundRow & { completed_at: string }>>,
      sql`select count(*)::int as n from golf_rounds where user_id = ${user.id} and status = 'completed'` as unknown as Promise<Array<{ n: number }>>,
      loadProfile(user.id),
    ]);
    const rounds: CompletedRound[] = rows.map((r) => ({
      id: r.id,
      completedAt: new Date(r.completed_at).toISOString(),
      golfCourseId: r.golf_course_id,
      courseName: r.course_name,
      teeName: r.tee_name,
      teeColor: r.tee_color,
      holes: r.holes,
      entries: r.entries,
      handicaps: setupOf(r).handicaps,
    }));
    const anyLive = (await sql`select exists (select 1 from golf_courses where status = 'live') as live`) as Array<{ live: boolean }>;
    res.status(200).json({
      period,
      clubName: home.clubName,
      homeMapLive: home.homeGolfCourseId != null,
      anyCourseLive: anyLive[0]?.live ?? false,
      totalRounds: roundCount[0]?.n ?? 0,
      handicapIndex: profile.handicapIndex,
      trackStats: profile.trackStats,
      stats: computeGolfStats(rounds, home.homeGolfCourseId),
    });
    return true;
  }

  throw new HttpError(404, 'Unknown action');
}
