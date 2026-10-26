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

// A slip scored the old way: every amount read as an item, plus catalog
// values — 40 for the competition fee, 285 for a pre-paid round matched to
// the catalog, and 40 again for "Amount Tendered".
const scored: PointsResult = {
  items: [
    { description: 'Pre-Paid Senior 18 Holes', quantity: 1, price: 0, matchedProductId: null, matchedActivityId: 'a1', matchedName: 'Pre-paid Senior 18 Holes', pointsAwarded: 285 },
    { description: 'Competition Fees', quantity: 1, price: 40, matchedProductId: null, matchedActivityId: 'a2', matchedName: 'Competition Entry', pointsAwarded: 40 },
  ],
  merchant: { id: 'm1', name: 'Strand Golf Club', merchantType: 'club', courseId: HOME },
  subtotalPoints: 325,
  totalPointsAwarded: 325,
  bonusMultiplier: 1,
};

test('points are based on the slip total, not the sum of every amount', () => {
  const result = engine.finalizePoints(scored, { subtotal: null, grandTotal: 40 }, HOME, 1, true);
  assert.equal(result.finalPointsAwarded, 40);
  assert.equal(result.pointsBasis, 'total');
});

test('tier and merchant multipliers apply on top of the total', () => {
  const promo = { ...scored, bonusMultiplier: 2 };
  assert.equal(engine.finalizePoints(promo, { subtotal: null, grandTotal: 285 }, HOME, 1.2, true).finalPointsAwarded, 684);
});

test('the subtotal stands in when only it was legible', () => {
  assert.equal(engine.finalizePoints(scored, { subtotal: 35, grandTotal: null }, HOME, 1, true).finalPointsAwarded, 35);
});

test('with no total at all, the line items decide', () => {
  const result = engine.finalizePoints(scored, { subtotal: null, grandTotal: null }, HOME, 1, true);
  assert.equal(result.finalPointsAwarded, 325);
  assert.equal(result.pointsBasis, 'items');
});

test('on a total basis each line shows what it cost', () => {
  const items = engine.itemsForBasis(scored.items, 'total');
  assert.deepEqual(items.map((i) => i.pointsAwarded), [0, 40]);
  assert.equal(engine.itemsForBasis(scored.items, 'items'), scored.items);
});
