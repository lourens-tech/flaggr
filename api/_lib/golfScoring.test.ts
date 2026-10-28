import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHandicaps,
  entryProblem,
  holeResult,
  parseIndexText,
  roundTotals,
  strokeRanks,
  strokesOn,
  type RoundHole,
  type RoundSetup,
} from '../../mobile/src/golf/scoring';
import { computeGolfStats, type CompletedRound } from '../../mobile/src/golf/stats';
import { checkCourseMap, playOptions, ratingFor, type CourseMapFile } from '../../mobile/src/golf/courseMap';

const PAR = [4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 4, 3, 5, 4, 3, 4, 5, 4];
const SI = [9, 17, 3, 7, 13, 1, 5, 15, 11, 10, 4, 16, 2, 8, 18, 12, 6, 14];
const HOLES: RoundHole[] = PAR.map((par, i) => ({ n: i + 1, par, si: SI[i], length: 300 }));

test('Course and Playing Handicap follow WHS Rule 6', () => {
  // 14.2 × 125/113 + (71.6 − 72) = 15.308… → 15; × 95% = 14.54… → 15
  const h = computeHandicaps(14.2, { cr: 71.6, slope: 125 }, 72, 18, 0.95);
  assert.equal(h.course, 15);
  assert.equal(h.playing, 15);
  assert.ok(Math.abs(h.raw - 15.3080) < 0.001);
});

test('a nine-hole Course Handicap halves the index to the nearest tenth (USGA example)', () => {
  // 8.7 ÷ 2 = 4.35 → 4.4; 4.4 × 121/113 + (35.3 − 36) = 4.011 → 4
  const h = computeHandicaps(8.7, { cr: 35.3, slope: 121 }, 36, 9, 1);
  assert.equal(h.idx, 4.4);
  assert.equal(h.course, 4);
});

test('plus handicaps come out negative', () => {
  const h = computeHandicaps(-2.3, { cr: 72.4, slope: 130 }, 72, 18, 1);
  // −2.3 × 130/113 + 0.4 = −2.246 → −2
  assert.equal(h.course, -2);
});

test('strokes go to the lowest stroke indexes, and plus handicaps give back on the highest', () => {
  const ranks = strokeRanks(HOLES);
  const received = HOLES.map((_, i) => strokesOn(ranks[i], 18, 20));
  // 20 = one on every hole and a second on SI 1 and 2 (holes 6 and 13)
  assert.equal(received.reduce((a, b) => a + b, 0), 20);
  assert.equal(received[5], 2);
  assert.equal(received[12], 2);
  assert.equal(received[0], 1);
  const plus = HOLES.map((_, i) => strokesOn(ranks[i], 18, -2));
  // gives back on SI 18 and 17 (holes 15 and 2)
  assert.deepEqual(plus.map((v, i) => (v ? i + 1 : 0)).filter(Boolean), [2, 15]);
  assert.equal(plus[14], -1);
});

test('a nine from an 18-hole card ranks its own stroke indexes', () => {
  const back = HOLES.slice(9);
  const ranks = strokeRanks(back);
  // back-nine SIs 10,4,16,2,8,18,12,6,14 → hole 13 (SI 2) is the hardest
  assert.equal(ranks[3], 1);
  assert.equal(ranks[5], 9);
});

test('Stableford points, net double bogey and pick-ups', () => {
  const setup: RoundSetup = { holes: HOLES, handicaps: { course: 18, playing: 17 } };
  // hole 6 (par 4, SI 1): receives a stroke
  const birdieNet = holeResult(setup, 5, { s: 4 });
  assert.equal(birdieNet.strokesReceived, 1);
  assert.equal(birdieNet.points, 3);
  const blowUp = holeResult(setup, 5, { s: 9 });
  assert.equal(blowUp.points, 0);
  assert.equal(blowUp.maxScore, 7); // par 4 + 2 + 1 stroke from the course handicap
  assert.equal(blowUp.adjusted, 7);
  const pickup = holeResult(setup, 5, { s: 'P' });
  assert.equal(pickup.points, 0);
  assert.equal(pickup.adjusted, 7);
  // hole 15 (SI 18) gets no stroke with playing 17
  assert.equal(holeResult(setup, 14, { s: 3 }).points, 2);
});

test('no handicap: scratch strokes and a par + 5 cap', () => {
  const setup: RoundSetup = { holes: HOLES, handicaps: null };
  const r = holeResult(setup, 0, { s: 12 });
  assert.equal(r.maxScore, 9);
  assert.equal(r.adjusted, 9);
  assert.equal(r.points, 0);
});

test('totals: a pick-up means no gross or net, points still count', () => {
  const setup: RoundSetup = { holes: HOLES, handicaps: { course: 18, playing: 17 } };
  const entries = HOLES.map((h) => ({ s: h.par as number | 'P' }));
  entries[0] = { s: 'P' };
  const t = roundTotals(setup, entries);
  assert.equal(t.holesPlayed, 18);
  assert.equal(t.gross, null);
  assert.equal(t.pickups, 1);
  // 17 holes at gross par: 3 pts with a stroke, 2 without; hole 1 picked up = 0
  const expected = HOLES.slice(1).reduce((s, _, k) => s + (strokesOn(strokeRanks(HOLES)[k + 1], 18, 17) ? 3 : 2), 0);
  assert.equal(t.points, expected);
});

test('green in regulation and entry validation', () => {
  const setup: RoundSetup = { holes: HOLES, handicaps: null };
  assert.equal(holeResult(setup, 0, { s: 4, putts: 2 }).gir, true);
  assert.equal(holeResult(setup, 0, { s: 5, putts: 2 }).gir, false);
  assert.equal(entryProblem(HOLES[1], { s: 3, fw: 'hit' }), "Hole 2: there's no fairway to hit on a par 3.");
  assert.equal(entryProblem(HOLES[0], { s: 2, putts: 2 }), 'Hole 1: putts must be fewer than the score.');
  assert.equal(entryProblem(HOLES[0], { s: 1, putts: 0 }), null);
  assert.equal(entryProblem(HOLES[0], { s: 21 }), 'Hole 1: score must be 1–20.');
});

test('Handicap Index text', () => {
  assert.equal(parseIndexText('14.2'), 14.2);
  assert.equal(parseIndexText('+1,4'), -1.4);
  assert.equal(parseIndexText(''), null);
  assert.equal(parseIndexText('55'), undefined);
  assert.equal(parseIndexText('14.25'), undefined);
});

function map(overrides: Partial<CourseMapFile> = {}): CourseMapFile {
  const sq = (x: number, y: number): [number, number][] => [[x, y], [x + 10, y], [x + 10, y + 10], [x, y + 10]];
  return {
    format: 'flagrr-course-map',
    version: 1,
    name: 'Demo',
    location: 'Somewhere',
    origin: [-34, 18],
    attribution: '© OpenStreetMap contributors',
    holeCount: 18,
    holes: HOLES.map((h, i) => ({ n: h.n, path: [[i * 100, 0], [i * 100, 300]] })),
    greens: HOLES.map((h, i) => ({ hole: h.n, pts: sq(i * 100 - 5, 295) })),
    teeBoxes: HOLES.map((h, i) => ({ hole: h.n, tees: ['white'], pts: sq(i * 100 - 5, -5) })),
    features: [],
    tees: [{ id: 'white', name: 'White', color: '#F4F4F2', lengths: HOLES.map(() => 300), ratings: { men: { full: { cr: 71.6, slope: 125 } } } }],
    card: { men: { par: PAR, si: SI } },
    ...overrides,
  };
}

test('a complete map has no errors or blockers', () => {
  assert.deepEqual(checkCourseMap(map()), { errors: [], blockers: [] });
  const opts = playOptions(map());
  assert.deepEqual(opts, [{ teeId: 'white', gender: 'men', layouts: ['full'] }]);
  assert.equal(ratingFor(map(), 'white', 'men', 'front9'), null);
});

test('missing stroke index or ratings block publishing but not import', () => {
  const noSi = checkCourseMap(map({ card: { men: { par: PAR, si: SI.map(() => null) } } }));
  assert.deepEqual(noSi.errors, []);
  assert.ok(noSi.blockers.some((b) => b.includes('stroke index')));
  const dupSi = checkCourseMap(map({ card: { men: { par: PAR, si: [...SI.slice(0, 17), 1] } } }));
  assert.ok(dupSi.blockers.length > 0);
  const badSlope = checkCourseMap(map({ tees: [{ ...map().tees[0], ratings: { men: { full: { cr: 71.6, slope: 170 } } } }] }));
  assert.ok(badSlope.blockers.some((b) => b.includes('Slope')));
  const noRatings = checkCourseMap(map({ tees: [{ ...map().tees[0], ratings: {} }] }));
  assert.ok(noRatings.blockers.some((b) => b.includes('No tee')));
});

test('a broken file is refused', () => {
  assert.ok(checkCourseMap({ format: 'nope' }).errors.length > 0);
  assert.ok(checkCourseMap(map({ holes: HOLES.slice(0, 17).map((h, i) => ({ n: h.n, path: [[i, 0], [i, 1]] })) })).errors.length > 0);
});

function round(id: string, day: number, scores: number[], courseId = 'c1'): CompletedRound {
  return {
    id,
    completedAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`,
    golfCourseId: courseId,
    courseName: 'Demo',
    teeName: 'White',
    teeColor: '#F4F4F2',
    holes: HOLES,
    entries: scores.map((s) => ({ s })),
    handicaps: { course: 18, playing: 17 },
  };
}

test('My Golf stats from completed rounds', () => {
  const bogeyGolf = PAR.map((p) => p + 1);
  const parGolf = PAR.slice();
  const s = computeGolfStats([round('a', 1, bogeyGolf), round('b', 2, parGolf)], 'c1');
  assert.equal(s.rounds, 2);
  assert.equal(s.basis, 18);
  // bogey golf with 17 strokes: 2 pts on 17 holes, 1 on the SI-18 hole = 35
  assert.equal(s.recent.find((r) => r.id === 'a')!.points, 35);
  assert.equal(s.bestPoints!.points, s.recent.find((r) => r.id === 'b')!.points);
  assert.equal(s.playedToHandicap, 1);
  assert.equal(s.scoringAverage, (90 + 72) / 2);
  assert.equal(s.bestGross!.gross, 72);
  assert.equal(s.mixPer18!.par, 9);
  assert.equal(s.mixPer18!.bogey, 9);
  assert.equal(s.toughestHoles!.rounds, 2);
  assert.equal(s.putting, null);
  assert.equal(s.recent[0].id, 'b');
});
