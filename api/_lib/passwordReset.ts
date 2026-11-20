import crypto from 'node:crypto';
import { sql } from './db';
import { hashPassword, verifyPassword } from './auth';
import { HttpError } from './http';
import {
  getClientInfo,
  hashResetIdentifier,
  IDENTIFIER_WINDOW_MINUTES,
  IP_WINDOW_MINUTES,
  isLockedOut,
  isRequestBlocked,
  isResetBlocked,
  RESET_BLOCKED_MESSAGE,
  type ResetAccountType,
  type ResetCounts,
} from './resetThrottle';
import type { VercelRequest } from '@vercel/node';

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 30;

export type ResetOwner = { userId: string } | { adminId: string };

function generateResetCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(CODE_LENGTH, '0');
}

/** Issues a fresh 6-digit reset code for a member (userId) or admin account
 * (adminId), invalidating any earlier still-usable code for that same
 * account first — only the most recently requested code ever works. Only
 * the bcrypt hash is stored, never the raw code. */
export async function issuePasswordResetCode(owner: ResetOwner): Promise<string> {
  const userId = 'userId' in owner ? owner.userId : null;
  const adminId = 'adminId' in owner ? owner.adminId : null;

  await invalidatePasswordResetCodes(owner);

  const code = generateResetCode();
  const codeHash = await hashPassword(code);
  await sql`
    insert into password_reset_codes (user_id, admin_id, code_hash, expires_at)
    values (${userId}, ${adminId}, ${codeHash}, now() + make_interval(mins => ${CODE_TTL_MINUTES}))
  `;
  return code;
}

/** Verifies a submitted code against the account's still-valid (unused,
 * unexpired) codes, consuming it (marking used) on a match so it can never
 * be replayed. Returns whether the code was valid. */
export async function consumePasswordResetCode(owner: ResetOwner, code: string): Promise<boolean> {
  const userId = 'userId' in owner ? owner.userId : null;
  const adminId = 'adminId' in owner ? owner.adminId : null;

  const rows = (await sql`
    select id, code_hash from password_reset_codes
    where used_at is null
      and expires_at > now()
      and ${userId ? sql`user_id = ${userId}` : sql`admin_id = ${adminId}`}
    order by created_at desc
  `) as Array<{ id: string; code_hash: string }>;

  for (const row of rows) {
    if (await verifyPassword(code, row.code_hash)) {
      await sql`update password_reset_codes set used_at = now() where id = ${row.id}`;
      return true;
    }
  }
  return false;
}

/** Marks every still-usable code for the account as used, so none of them
 * can be entered any more. */
export async function invalidatePasswordResetCodes(owner: ResetOwner): Promise<void> {
  const userId = 'userId' in owner ? owner.userId : null;
  const adminId = 'adminId' in owner ? owner.adminId : null;
  await sql`
    update password_reset_codes set used_at = now()
    where used_at is null
      and ${userId ? sql`user_id = ${userId}` : sql`admin_id = ${adminId}`}
  `;
}

// --- Throttling and audit trail (password_reset_events, migration 050) ---

type ResetEvent = 'code_requested' | 'request_blocked' | 'code_failed' | 'reset_blocked' | 'password_reset';

export interface ResetContext {
  accountType: ResetAccountType;
  identifierHash: string;
  ip: string | null;
  userAgent: string | null;
}

export function resetContext(
  req: Pick<VercelRequest, 'headers'>,
  accountType: ResetAccountType,
  identifier: string,
): ResetContext {
  return { accountType, identifierHash: hashResetIdentifier(accountType, identifier), ...getClientInfo(req) };
}

async function getResetCounts(ctx: ResetContext): Promise<ResetCounts> {
  const rows = (await sql`
    select
      count(*) filter (where event = 'code_requested' and identifier_hash = ${ctx.identifierHash}
        and created_at > now() - make_interval(mins => ${IDENTIFIER_WINDOW_MINUTES})) as identifier_requests,
      count(*) filter (where event = 'code_requested' and ip = ${ctx.ip}) as ip_requests,
      count(*) filter (where event = 'code_failed' and identifier_hash = ${ctx.identifierHash}
        and created_at > now() - make_interval(mins => ${IDENTIFIER_WINDOW_MINUTES})) as identifier_failures,
      count(*) filter (where event = 'code_failed' and ip = ${ctx.ip}) as ip_failures
    from password_reset_events
    where account_type = ${ctx.accountType}
      and (identifier_hash = ${ctx.identifierHash} or ip = ${ctx.ip})
      and created_at > now() - make_interval(mins => ${IP_WINDOW_MINUTES})
  `) as Array<Record<string, string | number>>;
  const row = rows[0] ?? {};
  return {
    identifierRequests: Number(row.identifier_requests ?? 0),
    ipRequests: Number(row.ip_requests ?? 0),
    identifierFailures: Number(row.identifier_failures ?? 0),
    ipFailures: Number(row.ip_failures ?? 0),
  };
}

/** Stores the event and writes one log line with the caller's IP and device
 * (never the email address or username). */
export async function recordResetEvent(ctx: ResetContext, event: ResetEvent, owner: ResetOwner | null = null): Promise<void> {
  const userId = owner && 'userId' in owner ? owner.userId : null;
  const adminId = owner && 'adminId' in owner ? owner.adminId : null;
  await sql`
    insert into password_reset_events (account_type, event, identifier_hash, user_id, admin_id, ip, user_agent)
    values (${ctx.accountType}, ${event}, ${ctx.identifierHash}, ${userId}, ${adminId}, ${ctx.ip}, ${ctx.userAgent})
  `;
  console.info(
    '[password-reset]',
    JSON.stringify({ event, accountType: ctx.accountType, userId, adminId, ip: ctx.ip, userAgent: ctx.userAgent }),
  );
}

/** Call before sending a reset code. Throws a 429 with the support message
 * when this email/username or IP has asked too often, or is locked out. */
export async function guardResetRequest(ctx: ResetContext): Promise<void> {
  if (isRequestBlocked(await getResetCounts(ctx))) {
    await recordResetEvent(ctx, 'request_blocked');
    throw new HttpError(429, RESET_BLOCKED_MESSAGE);
  }
}

/** Call before checking a submitted code. Throws a 429 with the support
 * message when the account is locked out or the IP has guessed too often. */
export async function guardResetAttempt(ctx: ResetContext, owner: ResetOwner | null): Promise<void> {
  if (isResetBlocked(await getResetCounts(ctx))) {
    await recordResetEvent(ctx, 'reset_blocked', owner);
    throw new HttpError(429, RESET_BLOCKED_MESSAGE);
  }
}

/** Records a wrong code. When that reaches the lockout limit, every open code
 * for the account is cancelled and a 429 with the support message is thrown;
 * otherwise the usual "invalid code" 400. */
export async function rejectResetCode(ctx: ResetContext, owner: ResetOwner | null): Promise<never> {
  await recordResetEvent(ctx, 'code_failed', owner);
  if (isLockedOut(await getResetCounts(ctx))) {
    if (owner) await invalidatePasswordResetCodes(owner);
    throw new HttpError(429, RESET_BLOCKED_MESSAGE);
  }
  throw new HttpError(400, 'That code is invalid or has expired');
}
