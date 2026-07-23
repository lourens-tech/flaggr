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

export interface AuthedAdmin {
  id: string;
  courseId: string | null; // null only for a super_admin, which isn't built yet
  role: 'super_admin' | 'course_admin';
  firstName: string;
  lastName: string;
  email: string;
}

/** Same shape as getAuthedUser, but against the separate admins/admin_sessions
 * tables — course-admin/super-admin identities are deliberately never mixed
 * with member `users`. */
export async function getAuthedAdmin(req: VercelRequest): Promise<AuthedAdmin | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();

  let rows: Array<{
    id: string;
    course_id: string | null;
    role: 'super_admin' | 'course_admin';
    first_name: string;
    last_name: string;
    email: string;
  }>;
  try {
    rows = (await sql`
      select a.id, a.course_id, a.role, a.first_name, a.last_name, a.email
      from admin_sessions s
      join admins a on a.id = s.admin_id
      where s.token = ${token} and s.expires_at > now() and a.activated_at is not null
    `) as typeof rows;
  } catch {
    return null;
  }

  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, courseId: r.course_id, role: r.role, firstName: r.first_name, lastName: r.last_name, email: r.email };
}

/** Requires a logged-in admin who is a course_admin (i.e. has a course_id) —
 * the only admin role this build supports UI for. A super_admin token is
 * valid but gets a 403 here until that side is built. */
export async function requireAuthedCourseAdmin(
  req: VercelRequest,
): Promise<AuthedAdmin & { courseId: string }> {
  const admin = await getAuthedAdmin(req);
  if (!admin) throw new HttpError(401, 'Not authenticated');
  if (admin.role !== 'course_admin' || !admin.courseId) {
    throw new HttpError(403, 'This account type is not supported yet');
  }
  return admin as AuthedAdmin & { courseId: string };
}
