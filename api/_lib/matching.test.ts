import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCatalog, similarity } from './matching';

const catalog = [
  { id: 'cart', name: 'Visitors Golf Cart Rental 18 Holes', aliases: [] },
  { id: 'member18', name: 'Member 18 Holes', aliases: [] },
];

test('a generic fragment no longer matches a much longer catalog name', () => {
  assert.equal(matchCatalog('-- 18 HOLES --', catalog), null);
  assert.ok(similarity('18 holes', 'Visitors Golf Cart Rental 18 Holes') < 0.72);
});

test('a real item still matches its catalog entry', () => {
  assert.equal(matchCatalog('Full Member 18 Holes', catalog)?.item.id, 'member18');
  assert.equal(matchCatalog('Senior Member 18 Holes', catalog)?.item.id, 'member18');
});
