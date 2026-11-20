// Limits for member and admin sign-in. Pure rules only (unit-tested); the
// database side lives in loginGuard.ts.
//
// Wrong passwords for one email/username are counted since the start of the
// window, or since that account's last successful sign-in or password reset
// if later, so a member who mistypes a few times and then gets in starts
// fresh. Wrong passwords from one IP are counted across every account, which
// is what stops one machine trying one password against many accounts.
export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILED_LOGINS_PER_IDENTIFIER = 10;
export const MAX_FAILED_LOGINS_PER_IP = 30;

export const LOGIN_BLOCKED_MESSAGE = `Too many sign-in attempts. Try again in ${LOGIN_WINDOW_MINUTES} minutes, or reset your password.`;

export interface LoginCounts {
  identifierFailures: number;
  ipFailures: number;
}

/** Whether a sign-in must be refused without even checking the password. */
export function isLoginBlocked(counts: LoginCounts): boolean {
  return counts.identifierFailures >= MAX_FAILED_LOGINS_PER_IDENTIFIER || counts.ipFailures >= MAX_FAILED_LOGINS_PER_IP;
}
