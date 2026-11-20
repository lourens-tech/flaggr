import crypto from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

// Limits for the public "forgot password" flow (members and admin accounts).
// Only allowed requests and wrong codes count; blocked attempts are recorded
// for the audit trail but do not extend a block.
export const IDENTIFIER_WINDOW_MINUTES = 30;
export const IP_WINDOW_MINUTES = 60;
export const MAX_REQUESTS_PER_IDENTIFIER = 3;
export const MAX_REQUESTS_PER_IP = 10;
export const MAX_FAILED_CODES_PER_IDENTIFIER = 5;
export const MAX_FAILED_CODES_PER_IP = 20;

export const RESET_BLOCKED_MESSAGE =
  'Too many password reset attempts. Please contact Flagrr support at Swing@flagrr.com or 071 759 9553.';

export type ResetAccountType = 'member' | 'admin';

export interface ResetCounts {
  identifierRequests: number;
  ipRequests: number;
  identifierFailures: number;
  ipFailures: number;
}

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

/** The caller's IP (first x-forwarded-for hop, as set by Vercel) and device
 * string, trimmed to a sane length. Either can be null if absent. */
export function getClientInfo(req: Pick<VercelRequest, 'headers'>): ClientInfo {
  const header = (name: string): string => {
    const value = req.headers[name];
    return (Array.isArray(value) ? value[0] : value) ?? '';
  };
  const ip = header('x-forwarded-for').split(',')[0].trim() || header('x-real-ip').trim();
  const userAgent = header('user-agent').trim().slice(0, 300);
  return { ip: ip || null, userAgent: userAgent || null };
}

/** SHA-256 of the account type plus the normalised email/username, so the
 * typed identifier is never stored in plain text. */
export function hashResetIdentifier(accountType: ResetAccountType, identifier: string): string {
  return crypto.createHash('sha256').update(`${accountType}:${identifier.trim().toLowerCase()}`).digest('hex');
}

/** Whether the identifier is locked out after too many wrong codes. */
export function isLockedOut(counts: ResetCounts): boolean {
  return counts.identifierFailures >= MAX_FAILED_CODES_PER_IDENTIFIER;
}

/** Whether a new reset code may not be sent. */
export function isRequestBlocked(counts: ResetCounts): boolean {
  return (
    counts.identifierRequests >= MAX_REQUESTS_PER_IDENTIFIER ||
    counts.ipRequests >= MAX_REQUESTS_PER_IP ||
    isLockedOut(counts)
  );
}

/** Whether a code may not be checked at all (even a correct one). */
export function isResetBlocked(counts: ResetCounts): boolean {
  return isLockedOut(counts) || counts.ipFailures >= MAX_FAILED_CODES_PER_IP;
}
