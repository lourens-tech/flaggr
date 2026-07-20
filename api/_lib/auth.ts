import bcrypt from 'bcryptjs';
import type { VercelRequest } from '@vercel/node';
import { sql } from './db';
import { HttpError } from './http';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface AuthedUser {
  id: string;
  courseId: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Looks up the bearer session token. Returns null if missing/invalid/expired
 * rather than throwing, so callers decide whether auth is required. */
export async function getAuthedUser(req: VercelRequest): Promise<AuthedUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();

  let rows: Array<{
    id: string;
    course_id: string;
    first_name: string;
    last_name: string;
    email: string;
  }>;
  try {
    rows = (await sql`
      select u.id, u.course_id, u.first_name, u.last_name, u.email
      from sessions s
      join users u on u.id = s.user_id
      where s.token = ${token} and s.expires_at > now()
    `) as typeof rows;
  } catch {
    // Malformed token (not a valid uuid) — treat as unauthenticated.
    return null;
  }

  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, courseId: r.course_id, firstName: r.first_name, lastName: r.last_name, email: r.email };
}

export async function requireAuthedUser(req: VercelRequest): Promise<AuthedUser> {
  const user = await getAuthedUser(req);
  if (!user) throw new HttpError(401, 'Not authenticated');
  return user;
}
