import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, uuidOrNotFound } from './http';

test('a well-formed uuid is returned unchanged', () => {
  assert.equal(uuidOrNotFound('3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f', 'Ticket'), '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f');
});

test('a malformed, empty or non-string id is a 404, not a database error', () => {
  for (const bad of ['', 'abc', '3f1c2d4e-5a6b-4c7d-8e9f', "1' or '1'='1", undefined, null, 42]) {
    assert.throws(
      () => uuidOrNotFound(bad, 'Ticket'),
      (err) => err instanceof HttpError && err.status === 404 && err.message === 'Ticket not found',
    );
  }
});
