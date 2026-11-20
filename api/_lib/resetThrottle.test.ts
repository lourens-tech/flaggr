import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getClientInfo,
  hashResetIdentifier,
  isLockedOut,
  isRequestBlocked,
  isResetBlocked,
  MAX_FAILED_CODES_PER_IDENTIFIER,
  MAX_FAILED_CODES_PER_IP,
  MAX_REQUESTS_PER_IDENTIFIER,
  MAX_REQUESTS_PER_IP,
  RESET_BLOCKED_MESSAGE,
  type ResetCounts,
} from './resetThrottle';

const none: ResetCounts = { identifierRequests: 0, ipRequests: 0, identifierFailures: 0, ipFailures: 0 };

test('requests are allowed up to the per-email limit, then blocked', () => {
  assert.equal(isRequestBlocked({ ...none, identifierRequests: MAX_REQUESTS_PER_IDENTIFIER - 1 }), false);
  assert.equal(isRequestBlocked({ ...none, identifierRequests: MAX_REQUESTS_PER_IDENTIFIER }), true);
});

test('requests are blocked once one IP has asked too often', () => {
  assert.equal(isRequestBlocked({ ...none, ipRequests: MAX_REQUESTS_PER_IP - 1 }), false);
  assert.equal(isRequestBlocked({ ...none, ipRequests: MAX_REQUESTS_PER_IP }), true);
});

test('too many wrong codes locks out both new codes and code checks', () => {
  const locked = { ...none, identifierFailures: MAX_FAILED_CODES_PER_IDENTIFIER };
  assert.equal(isLockedOut({ ...none, identifierFailures: MAX_FAILED_CODES_PER_IDENTIFIER - 1 }), false);
  assert.equal(isLockedOut(locked), true);
  assert.equal(isRequestBlocked(locked), true);
  assert.equal(isResetBlocked(locked), true);
});

test('one IP guessing codes across many emails is blocked from checking codes', () => {
  assert.equal(isResetBlocked({ ...none, ipFailures: MAX_FAILED_CODES_PER_IP - 1 }), false);
  assert.equal(isResetBlocked({ ...none, ipFailures: MAX_FAILED_CODES_PER_IP }), true);
});

test('requesting codes alone never blocks checking a code', () => {
  assert.equal(isResetBlocked({ ...none, identifierRequests: 99, ipRequests: 99 }), false);
});

test('the blocked message points to Flagrr support by email and phone', () => {
  assert.match(RESET_BLOCKED_MESSAGE, /Swing@flagrr\.com/);
  assert.match(RESET_BLOCKED_MESSAGE, /071 759 9553/);
});

test('client info takes the first forwarded IP and the user agent', () => {
  const info = getClientInfo({ headers: { 'x-forwarded-for': '41.1.2.3, 10.0.0.1', 'user-agent': 'Mozilla/5.0' } });
  assert.deepEqual(info, { ip: '41.1.2.3', userAgent: 'Mozilla/5.0' });
});

test('client info falls back to x-real-ip and returns null when headers are missing', () => {
  assert.deepEqual(getClientInfo({ headers: { 'x-real-ip': '41.9.9.9' } }), { ip: '41.9.9.9', userAgent: null });
  assert.deepEqual(getClientInfo({ headers: {} }), { ip: null, userAgent: null });
});

test('the identifier hash ignores case and spaces, differs by account type, and hides the email', () => {
  const a = hashResetIdentifier('member', 'Someone@Example.com ');
  assert.equal(a, hashResetIdentifier('member', 'someone@example.com'));
  assert.notEqual(a, hashResetIdentifier('admin', 'someone@example.com'));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes('example'));
});
