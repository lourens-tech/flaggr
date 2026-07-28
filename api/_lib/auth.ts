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
  courseId: string | null; // null only for a super_admin, which isn't scoped to one club
  role: 'super_admin' | 'course_admin' | 'staff' | 'support_agent';
  firstName: string;
  lastName: string;
  email: string;
  username: string | null; // set for `staff`; null for course_admin/super_admin, who log in with email
  mustChangePassword: boolean;
  themePreference: 'system' | 'light' | 'dark';
}

/** Same shape as getAuthedUser, but against the separate admins/admin_sessions
 * tables — course-admin/super-admin/staff identities are deliberately never
 * mixed with member `users`. A revoked staff member's session stops working
 * immediately, even mid-session, since that check lives here rather than
 * only at login. Same for a course_admin/staff account whose club's
 * subscription gets cancelled while they're logged in — super_admin/
 * support_agent aren't scoped to a course, so they're never affected. */
export async function getAuthedAdmin(req: VercelRequest): Promise<AuthedAdmin | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();

  let rows: Array<{
    id: string;
    course_id: string | null;
    role: 'super_admin' | 'course_admin' | 'staff' | 'support_agent';
    first_name: string;
    last_name: string;
    email: string;
    username: string | null;
    must_change_password: boolean;
    theme_preference: 'system' | 'light' | 'dark';
    subscription_status: string | null;
  }>;
  try {
    rows = (await sql`
      select a.id, a.course_id, a.role, a.first_name, a.last_name, a.email, a.username, a.must_change_password,
             a.theme_preference, c.subscription_status
      from admin_sessions s
      join admins a on a.id = s.admin_id
      left join courses c on c.id = a.course_id
      where s.token = ${token} and s.expires_at > now() and a.activated_at is not null and a.revoked_at is null
    `) as typeof rows;
  } catch {
    return null;
  }

  if (rows.length === 0) return null;
  const r = rows[0];

  // Distinct from an invalid/expired session (which just returns null,
  // above) so the mobile app can show a specific explanation and log the
  // admin out cleanly, instead of a bare "Not authenticated" on whatever
  // request happened to be in flight when the club's subscription lapsed.
  if (r.course_id && r.subscription_status === 'canceled') {
    throw new HttpError(403, "This club's subscription has been cancelled. Contact Flagrr support to reactivate.");
  }

  return {
    id: r.id,
    courseId: r.course_id,
    role: r.role,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    username: r.username,
    mustChangePassword: r.must_change_password,
    themePreference: r.theme_preference,
  };
}

/** Requires a logged-in admin who is a course_admin (i.e. has a course_id).
 * A super_admin token is valid but gets a 403 here — cross-club actions go
 * through requireAuthedSuperAdmin instead. Staff accounts (see
 * requireAuthedCourseStaffOrAdmin) are also rejected — staff management
 * itself is a course_admin-only action. */
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

/** Like requireAuthedCourseAdmin, but also accepts a course-scoped `staff`
 * account — used for the small set of actions staff can perform themselves
 * (logout, me, changePassword, voucher lookup/redeem). Callers must still
 * gate anything staff shouldn't reach (see STAFF_ALLOWED_ACTIONS in
 * api/admin/index.ts). */
export async function requireAuthedCourseStaffOrAdmin(
  req: VercelRequest,
): Promise<AuthedAdmin & { courseId: string }> {
  const admin = await getAuthedAdmin(req);
  if (!admin) throw new HttpError(401, 'Not authenticated');
  if ((admin.role !== 'course_admin' && admin.role !== 'staff') || !admin.courseId) {
    throw new HttpError(403, 'This account type is not supported yet');
  }
  return admin as AuthedAdmin & { courseId: string };
}

/** Requires a logged-in super_admin — the platform-level role that isn't
 * scoped to any single course (courseId is always null for this role).
 * Used for cross-club actions: creating new courses/course_admins, ad
 * management across clubs, and cross-club reporting. */
export async function requireAuthedSuperAdmin(
  req: VercelRequest,
): Promise<AuthedAdmin & { courseId: null }> {
  const admin = await getAuthedAdmin(req);
  if (!admin) throw new HttpError(401, 'Not authenticated');
  if (admin.role !== 'super_admin') {
    throw new HttpError(403, 'Not authorized for this action');
  }
  return admin as AuthedAdmin & { courseId: null };
}

/** Requires a logged-in super_admin OR support_agent — the two roles that
 * can see the cross-club Support Centre inbox. Agent management itself
 * (creating/revoking support_agent accounts) stays super_admin-only. */
export async function requireAuthedSupportStaff(
  req: VercelRequest,
): Promise<AuthedAdmin & { courseId: null }> {
  const admin = await getAuthedAdmin(req);
  if (!admin) throw new HttpError(401, 'Not authenticated');
  if (admin.role !== 'super_admin' && admin.role !== 'support_agent') {
    throw new HttpError(403, 'Not authorized for this action');
  }
  return admin as AuthedAdmin & { courseId: null };
}
