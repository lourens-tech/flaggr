import crypto from 'node:crypto';
import { sql } from './db';
import { hashPassword, verifyPassword } from './auth';

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 30;

type ResetOwner = { userId: string } | { adminId: string };

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

  await sql`
    update password_reset_codes set used_at = now()
    where used_at is null
      and ${userId ? sql`user_id = ${userId}` : sql`admin_id = ${adminId}`}
  `;

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
