import type { VercelRequest } from '@vercel/node';
import { sql } from './db';
import { HttpError } from './http';
import { hashPassword, verifyPassword } from './auth';
import { getClientInfo, hashResetIdentifier, type ResetAccountType } from './resetThrottle';
import { isLoginBlocked, LOGIN_BLOCKED_MESSAGE, LOGIN_WINDOW_MINUTES, type LoginCounts } from './loginThrottle';

// Sign-in lockout and audit trail (login_events, migration 051). Mirrors the
// password-reset throttle in passwordReset.ts.

type LoginEvent = 'login_succeeded' | 'login_failed' | 'login_blocked';
type LoginOwner = { userId: string } | { adminId: string };

export interface LoginContext {
  accountType: ResetAccountType;
  identifierHash: string;
  ip: string | null;
  userAgent: string | null;
}

/** The identifier hash is the same one the reset flow uses, so a completed
 * password reset clears the sign-in lockout for that email/username. */
export function loginContext(
  req: Pick<VercelRequest, 'headers'>,
  accountType: ResetAccountType,
  identifier: string,
): LoginContext {
  return { accountType, identifierHash: hashResetIdentifier(accountType, identifier), ...getClientInfo(req) };
}

/** Postgres "relation does not exist": migration 051 not applied yet. */
function isMissingTable(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '42P01';
}

async function getLoginCounts(ctx: LoginContext): Promise<LoginCounts> {
  const rows = (await sql`
    with since as (
      select greatest(
        now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES}),
        coalesce((select max(created_at) from login_events
                  where account_type = ${ctx.accountType} and identifier_hash = ${ctx.identifierHash}
                    and event = 'login_succeeded'), '-infinity'::timestamptz),
        coalesce((select max(created_at) from password_reset_events
                  where account_type = ${ctx.accountType} and identifier_hash = ${ctx.identifierHash}
                    and event = 'password_reset'), '-infinity'::timestamptz)
      ) as t
    )
    select
      (select count(*) from login_events, since
        where account_type = ${ctx.accountType} and identifier_hash = ${ctx.identifierHash}
          and event = 'login_failed' and created_at > since.t) as identifier_failures,
      (select count(*) from login_events
        where ip = ${ctx.ip} and event = 'login_failed'
          and created_at > now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES})) as ip_failures
  `) as Array<Record<string, string | number>>;
  const row = rows[0] ?? {};
  return {
    identifierFailures: Number(row.identifier_failures ?? 0),
    ipFailures: Number(row.ip_failures ?? 0),
  };
}

/** Stores the event and writes one log line with the caller's IP and device
 * (never the email address or username). */
export async function recordLoginEvent(ctx: LoginContext, event: LoginEvent, owner: LoginOwner | null = null): Promise<void> {
  const userId = owner && 'userId' in owner ? owner.userId : null;
  const adminId = owner && 'adminId' in owner ? owner.adminId : null;
  try {
    await sql`
      insert into login_events (account_type, event, identifier_hash, user_id, admin_id, ip, user_agent)
      values (${ctx.accountType}, ${event}, ${ctx.identifierHash}, ${userId}, ${adminId}, ${ctx.ip}, ${ctx.userAgent})
    `;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    console.error('[login] login_events table missing: apply db/migrations/051_login_events.sql');
  }
  console.info('[login]', JSON.stringify({ event, accountType: ctx.accountType, userId, adminId, ip: ctx.ip, userAgent: ctx.userAgent }));
}

/** Call before checking a password. Throws a 429 when this email/username or
 * IP has had too many wrong passwords recently. If migration 051 hasn't been
 * applied yet, sign-in is allowed (and an error logged) rather than locking
 * every account out. */
export async function guardLogin(ctx: LoginContext): Promise<void> {
  let counts: LoginCounts;
  try {
    counts = await getLoginCounts(ctx);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    console.error('[login] login_events table missing: apply db/migrations/051_login_events.sql');
    return;
  }
  if (isLoginBlocked(counts)) {
    await recordLoginEvent(ctx, 'login_blocked');
    throw new HttpError(429, LOGIN_BLOCKED_MESSAGE);
  }
}

let dummyHash: Promise<string> | null = null;

/** Runs a bcrypt check against a throwaway hash so a sign-in for an email
 * with no account takes as long as one with a wrong password, and response
 * time can't reveal which emails are registered. */
export async function spendPasswordCheckTime(password: string): Promise<void> {
  dummyHash ??= hashPassword('flagrr-no-account-placeholder');
  await verifyPassword(password, await dummyHash);
}
