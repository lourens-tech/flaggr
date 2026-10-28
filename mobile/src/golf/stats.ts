// My Golf statistics, worked out from a member's completed rounds. Run by the
// API (api/courses?action=golfStats) so every device shows the same numbers;
// pure TypeScript so it can be unit tested alongside the scoring rules.

import { holeResult, roundTotals, type HoleEntry, type RoundHole, type RoundSetup } from './scoring';

export interface CompletedRound {
  id: string;
  completedAt: string; // ISO
  golfCourseId: string | null;
  courseName: string;
  teeName: string;
  teeColor: string;
  holes: RoundHole[];
  entries: HoleEntry[];
  handicaps: RoundSetup['handicaps'];
}

export interface RoundSummary {
  id: string;
  completedAt: string;
  courseName: string;
  teeName: string;
  teeColor: string;
  holeCount: number;
  firstHole: number;
  points: number;
  gross: number | null; // null when a hole was picked up
  adjusted: number;
  par: number;
  playingHandicap: number | null;
  isBest: boolean;
}

export interface GolfStats {
  rounds: number;
  // Round-level numbers use rounds of the most common length in the period:
  // 18-hole rounds when there are any, otherwise 9-hole rounds.
  basis: 18 | 9 | null;
  basisRounds: number;
  pointsAverage: number | null;
  playedToHandicap: number; // rounds with 36+ points (18+ on nine holes)
  bestPoints: { points: number; completedAt: string } | null;
  scoringAverage: number | null; // adjusted gross
  bestGross: { gross: number; completedAt: string } | null;
  pointsTrend: Array<{ id: string; completedAt: string; courseName: string; points: number; gross: number | null }>;
  // Hole-level numbers use every hole of every completed round. A picked-up
  // hole counts as net double bogey, the score WHS would record for it.
  holesPlayed: number;
  parAverages: Array<{ par: 3 | 4 | 5; average: number; holes: number; overParPerRound: number }>;
  mixPer18: { birdieOrBetter: number; par: number; bogey: number; doubleOrWorse: number } | null;
  doubleCostPer18: number | null;
  toughestHoles: { courseName: string; rounds: number; holes: Array<{ n: number; par: number; si: number; overPar: number; points: number }> } | null;
  nines: { front: number; back: number } | null; // adjusted, 18-hole rounds only
  putting: {
    holes: number;
    puttsPer18: number;
    threePuttsPer18: number;
    girPct: number;
    fairwayHoles: number;
    fairwayPct: number | null;
    missLeftPct: number | null;
    missRightPct: number | null;
  } | null;
  recent: RoundSummary[];
}

const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function summarise(r: CompletedRound) {
  const setup: RoundSetup = { holes: r.holes, handicaps: r.handicaps };
  const totals = roundTotals(setup, r.entries);
  const results = r.holes.map((_, i) => holeResult(setup, i, r.entries[i]));
  return { r, totals, results };
}

/** 36 Stableford points is playing to handicap over 18 holes; 18 over nine. */
export const handicapPoints = (holeCount: number) => holeCount * 2;

export function computeGolfStats(rounds: CompletedRound[], homeGolfCourseId: string | null): GolfStats {
  const all = rounds
    .slice()
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map(summarise);

  const eighteens = all.filter((x) => x.r.holes.length === 18);
  const basis: 18 | 9 | null = eighteens.length ? 18 : all.length ? 9 : null;
  const basisSet = basis === 18 ? eighteens : all.filter((x) => x.r.holes.length === 9);

  const best = basisSet.reduce<(typeof basisSet)[number] | null>((b, x) => (!b || x.totals.points > b.totals.points ? x : b), null);
  const noPickups = basisSet.filter((x) => x.totals.gross != null);
  const bestGross = noPickups.reduce<(typeof noPickups)[number] | null>((b, x) => (!b || (x.totals.gross ?? 0) < (b.totals.gross ?? 0) ? x : b), null);

  // Hole-level aggregates.
  type HoleRow = { par: number; score: number; putts: number | null | undefined; fw: HoleEntry['fw']; gir: boolean | null };
  const holeRows: HoleRow[] = [];
  for (const x of all) {
    x.r.holes.forEach((h, i) => {
      const res = x.results[i];
      if (!res.played || res.adjusted == null) return;
      const e = x.r.entries[i];
      holeRows.push({ par: h.par, score: res.adjusted, putts: res.pickup ? null : e?.putts, fw: e?.fw ?? null, gir: res.gir });
    });
  }
  const holesPlayed = holeRows.length;

  const parAverages = ([3, 4, 5] as const)
    .map((par) => {
      const rows = holeRows.filter((h) => h.par === par);
      const perRound = basisSet.length ? avg(basisSet.map((x) => x.r.holes.filter((h) => h.par === par).length)) : 0;
      const average = avg(rows.map((h) => h.score));
      return { par, average, holes: rows.length, overParPerRound: (average - par) * perRound };
    })
    .filter((p) => p.holes > 0);

  const per18 = (count: number) => (holesPlayed ? (count / holesPlayed) * 18 : 0);
  const diffs = holeRows.map((h) => h.score - h.par);
  const mixPer18 = holesPlayed
    ? {
        birdieOrBetter: per18(diffs.filter((d) => d <= -1).length),
        par: per18(diffs.filter((d) => d === 0).length),
        bogey: per18(diffs.filter((d) => d === 1).length),
        doubleOrWorse: per18(diffs.filter((d) => d >= 2).length),
      }
    : null;
  const doubleCostPer18 = holesPlayed ? per18(diffs.filter((d) => d >= 2).reduce((s, d) => s + d - 1, 0)) : null;

  // Toughest holes: at the home course when it's been played twice, otherwise
  // the course played most often (at least twice).
  let toughestHoles: GolfStats['toughestHoles'] = null;
  const byCourse = new Map<string, typeof all>();
  for (const x of all) {
    if (!x.r.golfCourseId) continue;
    byCourse.set(x.r.golfCourseId, [...(byCourse.get(x.r.golfCourseId) ?? []), x]);
  }
  let pick: string | null = homeGolfCourseId && (byCourse.get(homeGolfCourseId)?.length ?? 0) >= 2 ? homeGolfCourseId : null;
  if (!pick) {
    let most = 1;
    for (const [k, v] of byCourse) {
      if (v.length > most) {
        most = v.length;
        pick = k;
      }
    }
  }
  const played = pick ? byCourse.get(pick) : undefined;
  if (played) {
    const holeStats = new Map<number, { par: number; si: number; over: number[]; pts: number[] }>();
    for (const x of played) {
      x.r.holes.forEach((h, i) => {
        const res = x.results[i];
        if (!res.played || res.adjusted == null) return;
        const row = holeStats.get(h.n) ?? { par: h.par, si: h.si, over: [], pts: [] };
        row.over.push(res.adjusted - h.par);
        row.pts.push(res.points);
        holeStats.set(h.n, row);
      });
    }
    const holes = [...holeStats.entries()]
      .filter(([, v]) => v.over.length >= 2)
      .map(([n, v]) => ({ n, par: v.par, si: v.si, overPar: avg(v.over), points: avg(v.pts) }))
      .sort((a, b) => b.overPar - a.overPar || a.si - b.si)
      .slice(0, 3);
    if (holes.length) toughestHoles = { courseName: played[played.length - 1].r.courseName, rounds: played.length, holes };
  }

  const nines = eighteens.length
    ? {
        front: avg(eighteens.map((x) => x.results.slice(0, 9).reduce((s, r) => s + (r.adjusted ?? 0), 0))),
        back: avg(eighteens.map((x) => x.results.slice(9).reduce((s, r) => s + (r.adjusted ?? 0), 0))),
      }
    : null;

  const puttRows = holeRows.filter((h) => h.putts != null);
  const fwRows = holeRows.filter((h) => h.par >= 4 && h.fw != null);
  const putting = puttRows.length
    ? {
        holes: puttRows.length,
        puttsPer18: (avg(puttRows.map((h) => h.putts as number)) * 18),
        threePuttsPer18: (puttRows.filter((h) => (h.putts as number) >= 3).length / puttRows.length) * 18,
        girPct: (puttRows.filter((h) => h.gir).length / puttRows.length) * 100,
        fairwayHoles: fwRows.length,
        fairwayPct: fwRows.length ? (fwRows.filter((h) => h.fw === 'hit').length / fwRows.length) * 100 : null,
        missLeftPct: fwRows.length ? (fwRows.filter((h) => h.fw === 'left').length / fwRows.length) * 100 : null,
        missRightPct: fwRows.length ? (fwRows.filter((h) => h.fw === 'right').length / fwRows.length) * 100 : null,
      }
    : null;

  const bestId = best?.r.id ?? null;
  const recent: RoundSummary[] = all
    .slice()
    .reverse()
    .map((x) => ({
      id: x.r.id,
      completedAt: x.r.completedAt,
      courseName: x.r.courseName,
      teeName: x.r.teeName,
      teeColor: x.r.teeColor,
      holeCount: x.r.holes.length,
      firstHole: x.r.holes[0]?.n ?? 1,
      points: x.totals.points,
      gross: x.totals.gross,
      adjusted: x.totals.adjusted,
      par: x.totals.par,
      playingHandicap: x.r.handicaps?.playing ?? null,
      isBest: x.r.id === bestId,
    }));

  return {
    rounds: all.length,
    basis,
    basisRounds: basisSet.length,
    pointsAverage: basisSet.length ? avg(basisSet.map((x) => x.totals.points)) : null,
    playedToHandicap: basisSet.filter((x) => x.totals.points >= handicapPoints(x.r.holes.length)).length,
    bestPoints: best ? { points: best.totals.points, completedAt: best.r.completedAt } : null,
    scoringAverage: basisSet.length ? avg(basisSet.map((x) => x.totals.adjusted)) : null,
    bestGross: bestGross ? { gross: bestGross.totals.gross as number, completedAt: bestGross.r.completedAt } : null,
    pointsTrend: basisSet.slice(-20).map((x) => ({
      id: x.r.id,
      completedAt: x.r.completedAt,
      courseName: x.r.courseName,
      points: x.totals.points,
      gross: x.totals.gross,
    })),
    holesPlayed,
    parAverages,
    mixPer18,
    doubleCostPer18,
    toughestHoles,
    nines,
    putting,
    recent,
  };
}
