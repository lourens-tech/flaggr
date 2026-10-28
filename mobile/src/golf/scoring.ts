// Handicap and scoring for a round, following the World Handicap System that
// GolfRSA uses. Shared by the app (live on the score bar) and the API (which
// recomputes and stores the totals when a round is saved), so the two can
// never disagree. Pure TypeScript, no React Native imports.

import type { Rating } from './courseMap';

export type Format = 'stableford' | 'stroke';
export type FairwayResult = 'hit' | 'left' | 'right';

/** A hole as played: the card's par and stroke index for the member's gender
 * and the length from their tee, copied into the round when it starts. */
export interface RoundHole {
  n: number;
  par: number;
  si: number;
  length: number;
}

/** What the member entered on a hole. s is the strokes taken, 'P' a pick-up,
 * null not played yet. Putts and fairway are optional extras. */
export interface HoleEntry {
  s: number | 'P' | null;
  putts?: number | null;
  fw?: FairwayResult | null;
}

export const MIN_INDEX = -10; // a +10.0 index
export const MAX_INDEX = 54;
export const MAX_STROKES = 20;
export const MAX_PUTTS = 10;

// WHS rounds to the nearest whole number (or tenth) with .5 rounded upwards.
// The epsilon absorbs float error such as 4.35 * 10 = 43.499999...
export const roundHalfUp = (x: number) => Math.floor(x + 0.5 + 1e-9);
export const roundTenth = (x: number) => Math.floor(x * 10 + 0.5 + 1e-9) / 10;

export interface Handicaps {
  idx: number; // the index used (halved, to the nearest tenth, for nine holes)
  raw: number; // unrounded Course Handicap
  course: number; // Course Handicap
  playing: number; // Playing Handicap
}

/** Course Handicap (Rule 6.1): Index × Slope ÷ 113 + (Course Rating − Par).
 * A 9-hole round uses Index ÷ 2 to the nearest tenth with the 9-hole ratings
 * and par. Playing Handicap (Rule 6.2): the unrounded Course Handicap × the
 * format's allowance (95% for individual stroke play and Stableford), then
 * rounded. */
export function computeHandicaps(index: number, rating: Rating, par: number, holeCount: number, allowance: number): Handicaps {
  const idx = holeCount === 18 ? index : roundTenth(index / 2);
  const raw = idx * (rating.slope / 113) + (rating.cr - par);
  return { idx, raw, course: roundHalfUp(raw), playing: roundHalfUp(raw * allowance) };
}

/** Each hole's difficulty rank within the holes being played (1 = hardest).
 * On a nine played from an 18-hole card, the nine stroke indexes are ranked
 * among themselves, so strokes still go to that nine's hardest holes first. */
export function strokeRanks(holes: RoundHole[]): number[] {
  const order = holes.map((_, i) => i).sort((a, b) => holes[a].si - holes[b].si);
  const ranks: number[] = [];
  order.forEach((holeIdx, k) => {
    ranks[holeIdx] = k + 1;
  });
  return ranks;
}

/** Strokes received on a hole (Appendix E). They go out in stroke index order;
 * a plus handicap gives strokes back starting from the easiest hole. */
export function strokesOn(rank: number, holeCount: number, handicap: number): number {
  if (handicap >= 0) return Math.floor(handicap / holeCount) + (rank <= handicap % holeCount ? 1 : 0);
  const g = -handicap;
  return -(Math.floor(g / holeCount) + (rank > holeCount - (g % holeCount) ? 1 : 0));
}

export interface HoleResult {
  played: boolean;
  pickup: boolean;
  strokesReceived: number;
  maxScore: number; // net double bogey, the most a hole counts for handicap purposes
  gross: number | null;
  net: number | null;
  points: number;
  adjusted: number | null; // the score capped at maxScore (a pick-up counts as maxScore)
  gir: boolean | null; // green in regulation, when putts were entered
}

export interface RoundSetup {
  holes: RoundHole[];
  // Null when the member has no Handicap Index: they play off scratch, and the
  // most a hole can count for is par + 5 (Rule 3.1b).
  handicaps: Pick<Handicaps, 'course' | 'playing'> | null;
}

export function holeResult(setup: RoundSetup, i: number, entry: HoleEntry | undefined): HoleResult {
  const h = setup.holes[i];
  const n = setup.holes.length;
  const rank = strokeRanks(setup.holes)[i];
  const st = setup.handicaps ? strokesOn(rank, n, setup.handicaps.playing) : 0;
  // Rule 3.1b: net double bogey uses the full Course Handicap's strokes.
  const maxScore = setup.handicaps ? h.par + 2 + strokesOn(rank, n, setup.handicaps.course) : h.par + 5;
  const s = entry?.s ?? null;
  if (s == null) {
    return { played: false, pickup: false, strokesReceived: st, maxScore, gross: null, net: null, points: 0, adjusted: null, gir: null };
  }
  if (s === 'P') {
    return { played: true, pickup: true, strokesReceived: st, maxScore, gross: null, net: null, points: 0, adjusted: maxScore, gir: null };
  }
  const putts = entry?.putts;
  return {
    played: true,
    pickup: false,
    strokesReceived: st,
    maxScore,
    gross: s,
    net: s - st,
    // Rule 21.1b: net double bogey or worse 0, net bogey 1, net par 2, net birdie 3 ...
    points: Math.max(0, 2 + h.par + st - s),
    adjusted: Math.min(s, maxScore),
    // On the green in par minus two strokes or fewer.
    gir: putts == null ? null : s - putts <= h.par - 2,
  };
}

export interface RoundTotals {
  holesPlayed: number;
  pickups: number;
  par: number; // par of the holes played
  gross: number | null; // null once any hole is a pick-up (no return in stroke play)
  net: number | null;
  points: number;
  adjusted: number;
  strokesReceived: number; // across every hole of the round, played or not
}

export function roundTotals(setup: RoundSetup, entries: Array<HoleEntry | undefined>, from = 0, to = setup.holes.length): RoundTotals {
  let holesPlayed = 0;
  let pickups = 0;
  let par = 0;
  let gross = 0;
  let net = 0;
  let points = 0;
  let adjusted = 0;
  let strokesReceived = 0;
  for (let i = from; i < to; i++) {
    const r = holeResult(setup, i, entries[i]);
    strokesReceived += r.strokesReceived;
    if (!r.played) continue;
    holesPlayed++;
    par += setup.holes[i].par;
    points += r.points;
    adjusted += r.adjusted ?? 0;
    if (r.pickup) pickups++;
    else {
      gross += r.gross ?? 0;
      net += r.net ?? 0;
    }
  }
  return {
    holesPlayed,
    pickups,
    par,
    gross: pickups ? null : gross,
    net: pickups ? null : net,
    points,
    adjusted,
    strokesReceived,
  };
}

/** Validates one hole's entry the same way on the app and the API. */
export function entryProblem(hole: RoundHole, e: HoleEntry): string | null {
  if (e.s !== null && e.s !== 'P' && !(Number.isInteger(e.s) && e.s >= 1 && e.s <= MAX_STROKES)) {
    return `Hole ${hole.n}: score must be 1–${MAX_STROKES}.`;
  }
  if (e.putts != null) {
    if (!Number.isInteger(e.putts) || e.putts < 0 || e.putts > MAX_PUTTS) return `Hole ${hole.n}: putts must be 0–${MAX_PUTTS}.`;
    if (typeof e.s !== 'number') return `Hole ${hole.n}: putts need a score.`;
    if (e.putts >= e.s) return `Hole ${hole.n}: putts must be fewer than the score.`;
  }
  if (e.fw != null) {
    if (!['hit', 'left', 'right'].includes(e.fw)) return `Hole ${hole.n}: fairway must be hit, left or right.`;
    if (hole.par < 4) return `Hole ${hole.n}: there's no fairway to hit on a par 3.`;
    if (e.s == null) return `Hole ${hole.n}: the fairway needs a score.`;
  }
  return null;
}

export function parseIndexText(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  if (!/^\+?\d{1,2}(\.\d)?$/.test(t)) return undefined;
  const v = parseFloat(t.replace('+', '')) * (t.startsWith('+') ? -1 : 1);
  return v >= MIN_INDEX && v <= MAX_INDEX ? v + 0 : undefined;
}

export const formatIndex = (v: number) => (v < 0 ? `+${(-v).toFixed(1)}` : v.toFixed(1));
export const formatWhole = (n: number) => (n < 0 ? `+${-n}` : `${n}`);
export const toParText = (d: number) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `−${-d}`);

export function resultName(score: number, par: number): string {
  if (score === 1) return 'Hole in one';
  const d = score - par;
  const names: Record<string, string> = { '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Double bogey', '3': 'Triple bogey' };
  return names[String(d)] ?? (d > 0 ? `+${d}` : `${d}`);
}
