import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLoginBlocked,
  LOGIN_BLOCKED_MESSAGE,
  LOGIN_WINDOW_MINUTES,
  MAX_FAILED_LOGINS_PER_IDENTIFIER,
  MAX_FAILED_LOGINS_PER_IP,
  type LoginCounts,
} from './loginThrottle';

const none: LoginCounts = { identifierFailures: 0, ipFailures: 0 };

test('sign-in is allowed with no recent failures', () => {
  assert.equal(isLoginBlocked(none), false);
});

test('an account locks after too many wrong passwords, not before', () => {
  assert.equal(isLoginBlocked({ ...none, identifierFailures: MAX_FAILED_LOGINS_PER_IDENTIFIER - 1 }), false);
  assert.equal(isLoginBlocked({ ...none, identifierFailures: MAX_FAILED_LOGINS_PER_IDENTIFIER }), true);
});

test('one IP is blocked after too many wrong passwords across accounts', () => {
  assert.equal(isLoginBlocked({ ...none, ipFailures: MAX_FAILED_LOGINS_PER_IP - 1 }), false);
  assert.equal(isLoginBlocked({ ...none, ipFailures: MAX_FAILED_LOGINS_PER_IP }), true);
});

test('the per-IP limit is looser than the per-account one', () => {
  // A clubhouse shares one IP; members mistyping shouldn't block each other
  // before a single account would lock.
  assert.ok(MAX_FAILED_LOGINS_PER_IP > MAX_FAILED_LOGINS_PER_IDENTIFIER);
});

test('the blocked message tells people how long to wait', () => {
  assert.match(LOGIN_BLOCKED_MESSAGE, new RegExp(`${LOGIN_WINDOW_MINUTES} minutes`));
});
