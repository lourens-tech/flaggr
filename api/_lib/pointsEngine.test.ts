import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PointsResult } from './pointsEngine';

// pointsEngine imports the database client, which refuses to load without a
// connection string. finalizePoints and itemsForBasis never touch the
// database, so a placeholder is enough here.
let engine: typeof import('./pointsEngine');
before(async () => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost/test';
  engine = await import('./pointsEngine.js');
});

const HOME = 'home-club';

// A ClubMaster slip: a round paid for in advance (R0 on the slip, matched to
// the catalog at R285) and a R40 competition fee paid on the day.
const prepaidRound = { description: 'Pre-Paid Senior 18 Holes', quantity: 1, price: 0, matchedProductId: null, matchedActivityId: 'a1', matchedName: 'Pre-paid Senior 18 Holes', pointsAwarded: 285 };
const competition = { description: 'Competition Fees', quantity: 1, price: 40, matchedProductId: null, matchedActivityId: 'a2', matchedName: 'Competition Entry', pointsAwarded: 40 };
const merchant = { id: 'm1', name: 'Strand Golf Club', merchantType: 'club', courseId: HOME };

function scoredWith(items: PointsResult['items']): PointsResult {
  const sum = items.reduce((s, i) => s + i.pointsAwarded, 0);
  return { items, merchant, subtotalPoints: sum, totalPointsAwarded: sum, bonusMultiplier: 1 };
}

test('points are based on the slip total, not the sum of every amount', () => {
  // The catalog says a visitor's round is R490, but the slip says R285 was paid.
  const round = { ...competition, description: 'Visitor 18 Holes', price: 285, pointsAwarded: 490 };
  const result = engine.finalizePoints(scoredWith([round]), { subtotal: null, grandTotal: 285 }, HOME, 1, true);
  assert.equal(result.finalPointsAwarded, 285);
  assert.equal(result.pointsBasis, 'total');
});

test('a pre-paid catalog item earns its catalog value on top of the total', () => {
  const result = engine.finalizePoints(scoredWith([prepaidRound, competition]), { subtotal: null, grandTotal: 40 }, HOME, 1, true);
  assert.equal(result.finalPointsAwarded, 325);
});

test('a fully pre-paid slip (R0 total) earns its line items', () => {
  assert.equal(engine.finalizePoints(scoredWith([prepaidRound]), { subtotal: null, grandTotal: 0 }, HOME, 1.2, true).finalPointsAwarded, 342);
});

test('an R0 line that matched nothing in the catalog adds nothing', () => {
  const unknown = { ...prepaidRound, matchedActivityId: null, matchedName: null, pointsAwarded: 0 };
  assert.equal(engine.finalizePoints(scoredWith([unknown]), { subtotal: null, grandTotal: 0 }, HOME, 1, true).finalPointsAwarded, 0);
});

test('tier and merchant multipliers apply on top of the total', () => {
  const promo = { ...scoredWith([competition]), bonusMultiplier: 2 };
  assert.equal(engine.finalizePoints(promo, { subtotal: null, grandTotal: 285 }, HOME, 1.2, true).finalPointsAwarded, 684);
});

test('the subtotal stands in when only it was legible', () => {
  assert.equal(engine.finalizePoints(scoredWith([competition]), { subtotal: 35, grandTotal: null }, HOME, 1, true).finalPointsAwarded, 35);
});

test('with no total at all, the line items decide', () => {
  const result = engine.finalizePoints(scoredWith([prepaidRound, competition]), { subtotal: null, grandTotal: null }, HOME, 1, true);
  assert.equal(result.finalPointsAwarded, 325);
  assert.equal(result.pointsBasis, 'items');
});

test('away clubs earn the flat rate on what was paid', () => {
  const away = { ...scoredWith([prepaidRound, competition]), merchant: { ...merchant, courseId: 'other-club' } };
  assert.equal(engine.finalizePoints(away, { subtotal: null, grandTotal: 40 }, HOME, 1.5, true).finalPointsAwarded, 40);
});

test('on a total basis each line shows what it cost, pre-paid items their catalog value', () => {
  const items = [prepaidRound, { ...competition, pointsAwarded: 90 }];
  const home = { pointsBasis: 'total', awayClub: false, nonParticipatingClub: false } as const;
  assert.deepEqual(engine.itemsForBasis(items, home).map((i) => i.pointsAwarded), [285, 40]);
  assert.deepEqual(engine.itemsForBasis(items, { ...home, awayClub: true }).map((i) => i.pointsAwarded), [0, 40]);
  assert.equal(engine.itemsForBasis(items, { ...home, pointsBasis: 'items' }), items);
});
