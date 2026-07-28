import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getAuthedAdmin, hashPassword, verifyPassword, type AuthedAdmin } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { deltaPct, isStatsPeriod, periodWindow, type StatsPeriod } from '../_lib/periods';
import { fillMonthlyByNumber } from '../_lib/monthly';
import {
  getDashboardReport,
  getSuperAdminDashboardReport,
  getAdPerformanceReport,
  getSuperAdminStatBreakdown,
  type StatBreakdownMetric,
} from '../_lib/adminReports';
import { toCsv } from '../_lib/csv';
import {
  addAdminMessage,
  ENQUIRY_STATUSES,
  listEnquiryMessages,
  markThreadReadByAdmin,
  type EnquiryStatus,
} from '../_lib/enquiries';
import { registerAdminPushToken, sendPushToAdmin, sendPushToUser, type PushPlatform } from '../_lib/pushNotifications';
import { sendEmail } from '../_lib/email';
import {
  addAgentMessage,
  addRequesterMessage,
  createSupportTicket,
  listSupportTicketMessages,
  markThreadReadByAgent,
  markThreadReadByRequester,
  SUPPORT_TICKET_STATUSES,
  type SupportTicketStatus,
} from '../_lib/supportTickets';
import { getRosterStatus, replaceMemberRoster } from '../_lib/memberRoster';
import { parseMemberRosterFile } from '../_lib/memberRosterFileParsing';
import { logAudit } from '../_lib/auditLog';
import { describeFraudReasons } from '../_lib/fraudChecks';
import { consumePasswordResetCode, issuePasswordResetCode } from '../_lib/passwordReset';

// Every action for the course-admin side of the app lives in this one file,
// dispatched by ?action= (same pattern as api/profile/index.ts and
// api/receipts/index.ts), to stay within Vercel Hobby's 12-serverless-
// function cap. Every query below is scoped to the calling admin's own
// course_id — a course_admin can never read or write another club's data,
// even by guessing another club's reward/ad/voucher id.

const DATA_URI_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,/;
const MAX_IMAGE_BASE64_LENGTH = 2_000_000;
// Base64 length, not raw file bytes (base64 inflates size ~4/3) — keeps the
// request comfortably under Vercel's serverless function body size ceiling.
const MAX_ROSTER_FILE_BASE64_LENGTH = 4_000_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'lourens@ewosolutions.com';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface LoginBody {
  // A course_admin/super_admin logs in with their (unique) email; a staff
  // account logs in with its system-generated username instead, since
  // staff at the same course may share one real email address. Same field
  // on the wire either way — the server checks both.
  identifier?: string;
  password?: string;
}

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

interface CourseProfileBody {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

interface LogoBody {
  imageBase64?: string;
}

interface RewardVariantInput {
  id?: string;
  label?: string;
  randValue?: number | null;
  cost?: number;
  sortOrder?: number;
  active?: boolean;
}

interface RewardSaveBody {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  imageBase64?: string;
  active?: boolean;
  variants?: RewardVariantInput[];
}

interface RewardDeleteBody {
  id?: string;
}

// A super_admin isn't scoped to one course, so its reward actions carry the
// target courseId explicitly instead of it coming from the session. Unlike
// ads, rewards have no "global" concept — courseId is always a real course.
interface SuperAdminRewardSaveBody extends RewardSaveBody {
  courseId?: string;
}

interface SuperAdminRewardDeleteBody extends RewardDeleteBody {
  courseId?: string;
}

interface SubscriptionActionBody {
  courseId?: string;
}

interface MemberRosterUploadBody {
  fileName?: string;
  fileBase64?: string;
}

// A super_admin isn't scoped to one course, so its roster action carries the
// target courseId explicitly instead of it coming from the session.
interface SuperAdminMemberRosterUploadBody extends MemberRosterUploadBody {
  courseId?: string;
}

interface SupportTicketCreateBody {
  subject?: string;
  message?: string;
}

interface SupportTicketReplyBody {
  ticketId?: string;
  message?: string;
}

interface SupportTicketStatusBody {
  ticketId?: string;
  status?: SupportTicketStatus;
}

interface SupportAgentCreateBody {
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface SupportAgentIdBody {
  id?: string;
}

interface AdSaveBody {
  id?: string;
  placement?: string;
  title?: string;
  imageBase64?: string;
  targetUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

interface AdDeleteBody {
  id?: string;
}

// A super_admin isn't scoped to one course, so its ad actions carry the
// target courseId explicitly instead of it coming from the session.
interface SuperAdminAdSaveBody extends AdSaveBody {
  courseId?: string;
}

interface SuperAdminAdDeleteBody extends AdDeleteBody {
  courseId?: string;
}

interface VoucherRedeemBody {
  code?: string;
}

interface BroadcastSendBody {
  title?: string;
  body?: string;
  target?: string;
}

interface BroadcastDeleteBody {
  id?: string;
}

interface AdminRegisterPushTokenBody {
  token?: string;
  platform?: PushPlatform;
}

interface SuperAdminBroadcastSendBody {
  title?: string;
  body?: string;
  target?: string;
  // Scopes the broadcast to one specific club instead of platform-wide —
  // omit for every club (member/tier targets) or every course_admin
  // ('course_admins' target).
  courseId?: string;
}

interface SuperAdminBroadcastDeleteBody {
  id?: string;
}

interface StaffCreateBody {
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface CourseAdminInviteBody {
  firstName?: string;
  lastName?: string;
  email?: string;
}

// A club can have at most this many course_admin accounts — a course_admin
// can invite one more themselves (see 'courseAdminInvite' below), but has no
// further admin-management ability (no reset/revoke/delete — that stays
// super_admin-only, see SuperAdminCourseAdminsScreen).
const MAX_COURSE_ADMINS_PER_CLUB = 2;

interface StaffUpdateBody {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
}

interface StaffIdBody {
  id?: string;
}

interface CourseCreateBody {
  courseName?: string;
  contactEmail?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
}

interface SuperAdminCourseAdminCreateBody {
  courseId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface SuperAdminCourseAdminIdBody {
  id?: string;
}

const REWARD_CATEGORIES = ['rounds', 'experiences', 'pro-shop', 'practice', 'dining'];

const STAT_BREAKDOWN_METRICS = new Set(['members', 'newMembers', 'fcEarned', 'fcRedeemed', 'receiptsScanned']);
const AD_PLACEMENTS = ['home', 'rewards_shop'];
const BROADCAST_TARGETS = ['all', 'Bronze', 'Silver', 'Gold', 'Platinum'];
// Same tier targets as a club's own broadcast, plus 'course_admins' — a
// super_admin isn't scoped to one course, so 'all'/tier targets here reach
// every member across every club, and 'course_admins' reaches every
// course_admin account platform-wide instead of members at all.
const SUPER_ADMIN_BROADCAST_TARGETS = ['all', 'Bronze', 'Silver', 'Gold', 'Platinum', 'course_admins'];

// Staff accounts only get a course-admin-created login for the Vouchers tab
// and their own basic profile — every other action stays course_admin-only,
// enforced right after auth below rather than scattered per-action.
const STAFF_ALLOWED_ACTIONS = new Set([
  'logout',
  'me',
  'changePassword',
  'voucherLookup',
  'voucherRedeem',
  'themePreference',
  'supportTicketCreate',
  'supportTickets',
  'supportTicketThread',
  'supportTicketReply',
]);

// Cross-club actions a super_admin can perform — not scoped to any single
// course_id, unlike everything else in this file.
const SUPER_ADMIN_ALLOWED_ACTIONS = new Set([
  'logout',
  'me',
  'themePreference',
  'superAdminCourses',
  'superAdminCourseCreate',
  'superAdminAds',
  'superAdminAdSave',
  'superAdminAdDelete',
  'superAdminDashboard',
  'superAdminAdPerformance',
  'superAdminRewards',
  'superAdminRewardSave',
  'superAdminRewardDelete',
  'superAdminStatBreakdown',
  'superAdminCourseCancelSubscription',
  'superAdminCourseReactivateSubscription',
  'superAdminCourseArchive',
  'superAdminCourseUnarchive',
  'superAdminMemberRosterStatus',
  'superAdminMemberRosterUpload',
  'superAdminMembers',
  'superAdminMemberStats',
  'superAdminFlaggedReceipts',
  'superAdminDuplicateAttempts',
  'superAdminReceiptImage',
  'superAdminBroadcasts',
  'superAdminBroadcastSend',
  'superAdminBroadcastDelete',
  'superAdminCourseAdmins',
  'superAdminCourseAdminCreate',
  'superAdminCourseAdminResetPassword',
  'superAdminCourseAdminRevoke',
  'superAdminCourseAdminReactivate',
  'superAdminCourseAdminDelete',
  'auditLog',
  'supportInbox',
  'supportInboxThread',
  'supportAgentReply',
  'supportTicketStatus',
  'supportAgents',
  'supportAgentCreate',
  'supportAgentResetPassword',
  'supportAgentRevoke',
  'supportAgentReactivate',
  'supportAgentDelete',
]);

// A support_agent is a Flagrr-team account (created by a super_admin) that
// can only see and reply to the cross-club support inbox — not scoped to
// any single course, like super_admin, but with none of super_admin's
// course/ads/rewards/reporting/agent-management access.
const SUPPORT_AGENT_ALLOWED_ACTIONS = new Set([
  'logout',
  'me',
  'themePreference',
  'changePassword',
  'supportInbox',
  'supportInboxThread',
  'supportAgentReply',
  'supportTicketStatus',
]);

function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && /duplicate key value/i.test(err.message);
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
}

function slugifyUsernamePart(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'staff';
}

const MAX_USERNAME_ATTEMPTS = 20;

/** Staff at the same course can share a real email, so email can't be their
 * login — instead they get a generated `firstname.courseslug` username,
 * unique across all admins. Retries with a numeric suffix on collision
 * (e.g. two staff both named Jo at the same course). */
async function insertStaffWithUniqueUsername(params: {
  courseId: string;
  courseSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
}) {
  const base = `${slugifyUsernamePart(params.firstName)}.${params.courseSlug}`;
  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
    const username = attempt === 0 ? base : `${base}${attempt + 1}`;
    try {
      return (await sql`
        insert into admins (course_id, role, first_name, last_name, email, username, password_hash, must_change_password, activated_at)
        values (${params.courseId}, 'staff', ${params.firstName}, ${params.lastName}, ${params.email}, ${username}, ${params.passwordHash}, true, now())
        returning id, first_name, last_name, email, username, must_change_password, revoked_at, created_at
      `) as Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        username: string;
        must_change_password: boolean;
        revoked_at: string | null;
        created_at: string;
      }>;
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < MAX_USERNAME_ATTEMPTS - 1) continue;
      throw err;
    }
  }
  throw new HttpError(500, 'Could not generate a unique username — try again');
}

const MAX_SLUG_ATTEMPTS = 20;

function slugifyCourseName(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'club';
}

/** Mirrors insertStaffWithUniqueUsername's retry-on-collision approach —
 * courses.slug is unique, and a super_admin naming a new club could collide
 * with an existing one (e.g. two "Riverside Golf Club"s in different towns). */
async function insertCourseWithUniqueSlug(params: { name: string; contactEmail: string | null }) {
  const base = slugifyCourseName(params.name);
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      return (await sql`
        insert into courses (name, slug, contact_email)
        values (${params.name}, ${slug}, ${params.contactEmail})
        returning id, name, slug, logo_url, cover_image_url, contact_email, contact_phone, address, fb_per_rand,
          onboarding_completed_at, staff_onboarding_completed_at, subscription_status, archived_at, created_at
      `) as Array<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        cover_image_url: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        address: string | null;
        fb_per_rand: number;
        onboarding_completed_at: string | null;
        staff_onboarding_completed_at: string | null;
        subscription_status: string | null;
        archived_at: string | null;
        created_at: string;
      }>;
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < MAX_SLUG_ATTEMPTS - 1) continue;
      throw err;
    }
  }
  throw new HttpError(500, 'Could not generate a unique course slug — try again');
}

function staffDto(row: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  must_change_password: boolean;
  revoked_at: string | null;
  created_at: string;
}) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    username: row.username,
    mustChangePassword: row.must_change_password,
    revoked: row.revoked_at !== null,
    createdAt: row.created_at,
  };
}

function courseAdminAccountDto(row: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  must_change_password: boolean;
  revoked_at: string | null;
  created_at: string;
}) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    mustChangePassword: row.must_change_password,
    revoked: row.revoked_at !== null,
    createdAt: row.created_at,
  };
}

function courseDto(row: {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  fb_per_rand: number;
  onboarding_completed_at: string | null;
  staff_onboarding_completed_at: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    coverImageUrl: row.cover_image_url,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    address: row.address,
    fbPerRand: Number(row.fb_per_rand),
    onboardingCompletedAt: row.onboarding_completed_at,
    staffOnboardingCompletedAt: row.staff_onboarding_completed_at,
  };
}

// A super_admin isn't scoped to any single course, so `me`/`login` return
// this placeholder in the `course` field instead of null — keeps the wire
// shape (and every mobile type that assumes AdminCourse is non-null)
// unchanged. Super-admin screens never read from `course`.
const EMPTY_COURSE_DTO = {
  id: '',
  name: '',
  slug: '',
  logoUrl: null,
  coverImageUrl: null,
  contactEmail: null,
  contactPhone: null,
  address: null,
  fbPerRand: 0,
  onboardingCompletedAt: null,
  staffOnboardingCompletedAt: null,
};

function superAdminCourseDto(row: {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  subscription_status: string | null;
  onboarding_completed_at: string | null;
  staff_onboarding_completed_at: string | null;
  archived_at?: string | null;
  created_at: string;
  admin_count: number | string;
  member_count: number | string;
  fb_per_rand: number;
}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    contactEmail: row.contact_email,
    subscriptionStatus: row.subscription_status,
    onboardingCompletedAt: row.onboarding_completed_at,
    staffOnboardingCompletedAt: row.staff_onboarding_completed_at,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    adminCount: Number(row.admin_count),
    memberCount: Number(row.member_count),
    fbPerRand: Number(row.fb_per_rand),
  };
}

async function fetchCourse(courseId: string) {
  const rows = (await sql`
    select id, name, slug, logo_url, cover_image_url, contact_email, contact_phone, address, fb_per_rand,
      onboarding_completed_at, staff_onboarding_completed_at
    from courses where id = ${courseId}
  `) as Array<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    cover_image_url: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    fb_per_rand: number;
    onboarding_completed_at: string | null;
    staff_onboarding_completed_at: string | null;
  }>;
  if (rows.length === 0) throw new HttpError(404, 'Course not found');
  return courseDto(rows[0]);
}

// Shared by the course_admin path (implicit courseId from the session) and
// the super_admin path (explicit courseId — a super_admin isn't scoped to
// one club) so the actual query logic isn't duplicated per role.
async function listAdsForCourse(courseId: string | null) {
  const rows = (await sql`
    select a.id, a.placement, a.title, a.image_url, a.target_url, a.sort_order, a.active,
           a.starts_at, a.ends_at, count(c.id)::int as clicks
    from ads a
    left join ad_clicks c on c.ad_id = a.id
    where a.course_id is not distinct from ${courseId}
    group by a.id
    order by a.placement, a.sort_order
  `) as Array<{
    id: string;
    placement: string;
    title: string;
    image_url: string | null;
    target_url: string | null;
    sort_order: number;
    active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    clicks: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    placement: r.placement,
    title: r.title,
    imageUrl: r.image_url,
    targetUrl: r.target_url,
    sortOrder: r.sort_order,
    active: r.active,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    clicks: r.clicks,
  }));
}

async function saveAdForCourse(courseId: string | null, body: AdSaveBody): Promise<{ id: string }> {
  const title = body.title?.trim();
  const placement = body.placement;
  if (!title || !placement || !AD_PLACEMENTS.includes(placement)) {
    throw new HttpError(400, 'title and a valid placement are required');
  }
  if (body.imageBase64 && (!DATA_URI_PATTERN.test(body.imageBase64) || body.imageBase64.length > MAX_IMAGE_BASE64_LENGTH)) {
    throw new HttpError(400, 'imageBase64 must be a jpeg/png/webp data URI under the size limit');
  }
  const targetUrl = body.targetUrl?.trim() || null;
  const startsAt = body.startsAt || null;
  const endsAt = body.endsAt || null;
  const sortOrder = body.sortOrder ?? 0;
  const active = body.active ?? true;

  if (body.id) {
    const owned = (await sql`select id from ads where id = ${body.id} and course_id is not distinct from ${courseId}`) as Array<{ id: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Ad not found');
    await sql`
      update ads
      set title = ${title}, placement = ${placement}, target_url = ${targetUrl}, sort_order = ${sortOrder},
          active = ${active}, starts_at = ${startsAt}, ends_at = ${endsAt}, updated_at = now()
          ${body.imageBase64 ? sql`, image_url = ${body.imageBase64}` : sql``}
      where id = ${body.id}
    `;
    return { id: body.id };
  }
  const inserted = (await sql`
    insert into ads (course_id, placement, title, image_url, target_url, sort_order, active, starts_at, ends_at)
    values (${courseId}, ${placement}, ${title}, ${body.imageBase64 ?? null}, ${targetUrl}, ${sortOrder}, ${active}, ${startsAt}, ${endsAt})
    returning id
  `) as Array<{ id: string }>;
  return { id: inserted[0].id };
}

async function deleteAdForCourse(courseId: string | null, id: string) {
  await sql`delete from ads where id = ${id} and course_id is not distinct from ${courseId}`;
}

// Shared by the course_admin path (implicit courseId from the session) and
// the super_admin path (explicit courseId — for viewing/overriding any
// club's rewards). Unlike ads, rewards have no "global" concept, so courseId
// here is always a real course id, never null.
async function listRewardsForCourse(courseId: string) {
  const rows = (await sql`
    select r.id, r.title, r.description, r.image_url, r.category, r.active,
           v.id as variant_id, v.label, v.rand_value, v.cost, v.sort_order, v.active as variant_active
    from rewards r
    left join reward_variants v on v.reward_id = r.id
    where r.course_id = ${courseId}
    order by r.title, v.sort_order
  `) as Array<{
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    category: string;
    active: boolean;
    variant_id: string | null;
    label: string | null;
    rand_value: number | null;
    cost: number | null;
    sort_order: number | null;
    variant_active: boolean | null;
  }>;

  const byId = new Map<string, any>();
  for (const row of rows) {
    let reward = byId.get(row.id);
    if (!reward) {
      reward = {
        id: row.id,
        title: row.title,
        description: row.description,
        imageUrl: row.image_url,
        category: row.category,
        active: row.active,
        variants: [],
      };
      byId.set(row.id, reward);
    }
    if (row.variant_id) {
      reward.variants.push({
        id: row.variant_id,
        label: row.label,
        randValue: row.rand_value,
        cost: row.cost,
        sortOrder: row.sort_order,
        active: row.variant_active,
      });
    }
  }
  return Array.from(byId.values());
}

async function saveRewardForCourse(courseId: string, body: RewardSaveBody): Promise<{ id: string }> {
  const title = body.title?.trim();
  const category = body.category;
  if (!title || !category || !REWARD_CATEGORIES.includes(category)) {
    throw new HttpError(400, 'title and a valid category are required');
  }
  if (body.imageBase64 && (!DATA_URI_PATTERN.test(body.imageBase64) || body.imageBase64.length > MAX_IMAGE_BASE64_LENGTH)) {
    throw new HttpError(400, 'imageBase64 must be a jpeg/png/webp data URI under the size limit');
  }
  if (!body.variants || body.variants.length === 0) {
    throw new HttpError(400, 'At least one variant is required');
  }

  const course = await fetchCourse(courseId);

  let rewardId = body.id;
  if (rewardId) {
    const owned = (await sql`select id from rewards where id = ${rewardId} and course_id = ${courseId}`) as Array<{ id: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Reward not found');
    await sql`
      update rewards
      set title = ${title}, description = ${body.description ?? ''}, category = ${category},
          active = ${body.active ?? true}
          ${body.imageBase64 ? sql`, image_url = ${body.imageBase64}` : sql``}
      where id = ${rewardId}
    `;
  } else {
    const inserted = (await sql`
      insert into rewards (course_id, title, description, image_url, category, active)
      values (${courseId}, ${title}, ${body.description ?? ''}, ${body.imageBase64 ?? null}, ${category}, ${body.active ?? true})
      returning id
    `) as Array<{ id: string }>;
    rewardId = inserted[0].id;
  }

  for (const [i, variant] of body.variants.entries()) {
    const label = variant.label?.trim();
    if (!label) throw new HttpError(400, 'Every variant needs a label');
    const randValue = typeof variant.randValue === 'number' ? variant.randValue : null;
    const cost = randValue !== null ? Math.round(randValue * course.fbPerRand) : variant.cost;
    if (typeof cost !== 'number' || cost < 0) {
      throw new HttpError(400, `Variant "${label}" needs a Rand value or an explicit Flagrr Cash cost`);
    }
    const sortOrder = variant.sortOrder ?? i;
    const active = variant.active ?? true;

    if (variant.id) {
      const owned = (await sql`
        select v.id from reward_variants v join rewards r on r.id = v.reward_id
        where v.id = ${variant.id} and r.course_id = ${courseId}
      `) as Array<{ id: string }>;
      if (owned.length === 0) throw new HttpError(404, 'Variant not found');
      await sql`
        update reward_variants
        set label = ${label}, rand_value = ${randValue}, cost = ${cost}, sort_order = ${sortOrder}, active = ${active}
        where id = ${variant.id}
      `;
    } else {
      await sql`
        insert into reward_variants (reward_id, label, rand_value, cost, sort_order, active)
        values (${rewardId}, ${label}, ${randValue}, ${cost}, ${sortOrder}, ${active})
      `;
    }
  }

  return { id: rewardId as string };
}

async function deleteRewardForCourse(courseId: string, id: string) {
  // Soft-delete: rewards/variants are referenced by past vouchers with no
  // cascade, so hard-deleting would either fail or orphan redemption
  // history. Deactivating hides it from the Rewards Shop instead.
  await sql`update rewards set active = false where id = ${id} and course_id = ${courseId}`;
  await sql`
    update reward_variants set active = false
    where reward_id in (select id from rewards where id = ${id} and course_id = ${courseId})
  `;
}

// A super_admin's ad actions carry a courseId that's either a real course
// id or the literal string 'global' (a course id can never collide with
// that, since courses.id is a uuid) — 'global' maps to a null course_id,
// meaning the ad shows to every course's members.
const GLOBAL_COURSE_SENTINEL = 'global';

function resolveAdCourseId(value: string | undefined): string | null {
  if (!value) throw new HttpError(400, 'courseId is required');
  return value === GLOBAL_COURSE_SENTINEL ? null : value;
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const action = req.query.action;

  // --- Unauthenticated actions ---
  if (action === 'login') {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const { identifier, password } = req.body as LoginBody;
    if (!identifier || !password) {
      throw new HttpError(400, 'Email/username and password are required');
    }

    // A course_admin/super_admin's email is unique and is their login; a
    // staff account's email can be shared with others, so it logs in by
    // its own unique username instead. Both are checked here since one
    // login screen serves every role.
    const loginId = identifier.trim().toLowerCase();
    const rows = (await sql`
      select a.id, a.course_id, a.role, a.first_name, a.last_name, a.email, a.username, a.password_hash,
        a.activated_at, a.must_change_password, a.revoked_at, a.theme_preference, c.subscription_status
      from admins a
      left join courses c on c.id = a.course_id
      where (a.role = 'staff' and a.username = ${loginId}) or (a.role <> 'staff' and a.email = ${loginId})
    `) as Array<{
      id: string;
      course_id: string | null;
      role: 'super_admin' | 'course_admin' | 'staff' | 'support_agent';
      first_name: string;
      last_name: string;
      email: string;
      username: string | null;
      password_hash: string | null;
      activated_at: string | null;
      must_change_password: boolean;
      revoked_at: string | null;
      theme_preference: 'system' | 'light' | 'dark';
      subscription_status: string | null;
    }>;

    const admin = rows[0];
    if (!admin || !admin.password_hash || !admin.activated_at) {
      throw new HttpError(401, 'Invalid email/username or password');
    }
    if (!(await verifyPassword(password, admin.password_hash))) {
      throw new HttpError(401, 'Invalid email/username or password');
    }
    if (admin.revoked_at) {
      throw new HttpError(403, 'Your access has been revoked. Contact your course administrator.');
    }
    if (admin.role === 'course_admin' || admin.role === 'staff') {
      if (!admin.course_id) throw new HttpError(403, 'This account type is not supported yet');
      if (admin.subscription_status === 'canceled') {
        throw new HttpError(403, "This club's subscription has been cancelled. Contact Flagrr support to reactivate.");
      }
    } else if (admin.role !== 'super_admin' && admin.role !== 'support_agent') {
      throw new HttpError(403, 'This account type is not supported yet');
    }

    const sessionRows = (await sql`
      insert into admin_sessions (admin_id) values (${admin.id}) returning token
    `) as Array<{ token: string }>;

    // A super_admin/support_agent has no course_id — return the placeholder
    // shape instead of querying a course that doesn't exist.
    const course =
      admin.role === 'super_admin' || admin.role === 'support_agent'
        ? EMPTY_COURSE_DTO
        : await fetchCourse(admin.course_id as string);
    res.status(200).json({
      token: sessionRows[0].token,
      admin: {
        id: admin.id,
        firstName: admin.first_name,
        lastName: admin.last_name,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        mustChangePassword: admin.must_change_password,
        themePreference: admin.theme_preference,
      },
      course,
    });
    return;
  }

  // --- Self-service password reset — no session required. Mirrors the
  // member-side actions in api/auth/login.ts: the response is identical
  // whether or not the identifier matches an account, and a code must be
  // submitted before the password actually changes (unlike the existing
  // super_admin-triggered "reset password" actions further below, which
  // immediately overwrite the password since those are performed by a
  // trusted admin acting deliberately, not a public unauthenticated caller).
  if (action === 'adminForgotPassword') {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const identifier = (req.body as { identifier?: string }).identifier?.trim().toLowerCase();
    if (!identifier) throw new HttpError(400, 'identifier is required');

    const rows = (await sql`
      select id, first_name, email from admins
      where ((role = 'staff' and username = ${identifier}) or (role <> 'staff' and email = ${identifier}))
        and activated_at is not null and revoked_at is null
    `) as Array<{ id: string; first_name: string; email: string }>;

    if (rows.length > 0) {
      const found = rows[0];
      const code = await issuePasswordResetCode({ adminId: found.id });
      await sendEmail({
        to: found.email,
        subject: 'Your Flagrr password reset code',
        html: `
          <p>Hi ${escapeHtml(found.first_name)},</p>
          <p>Use this code to reset your Flagrr password. It expires in 30 minutes.</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${escapeHtml(code)}</p>
          <p>If you didn't request this, you can safely ignore this email — your password won't change unless this code is used.</p>
        `,
      });
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'adminResetPassword') {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const body = req.body as { identifier?: string; code?: string; newPassword?: string };
    const identifier = body.identifier?.trim().toLowerCase();
    const code = body.code?.trim();
    const newPassword = body.newPassword;
    if (!identifier || !code || !newPassword || newPassword.length < 8) {
      throw new HttpError(400, 'Email/username, code, and a new password (min. 8 characters) are required');
    }

    const rows = (await sql`
      select id from admins
      where ((role = 'staff' and username = ${identifier}) or (role <> 'staff' and email = ${identifier}))
        and activated_at is not null and revoked_at is null
    `) as Array<{ id: string }>;

    if (rows.length === 0 || !(await consumePasswordResetCode({ adminId: rows[0].id }, code))) {
      throw new HttpError(400, 'That code is invalid or has expired');
    }

    const passwordHash = await hashPassword(newPassword);
    await sql`update admins set password_hash = ${passwordHash}, must_change_password = false where id = ${rows[0].id}`;
    res.status(200).json({ ok: true });
    return;
  }

  // --- Everything below requires a logged-in admin account of some kind ---
  const authedAdmin = await getAuthedAdmin(req);
  if (!authedAdmin) throw new HttpError(401, 'Not authenticated');

  // logout and themePreference apply identically to every admin role,
  // including super_admin, so they're handled before role-narrowing below.
  if (action === 'logout') {
    const header = req.headers.authorization;
    const token = header?.slice('Bearer '.length).trim();
    if (token) {
      await sql`delete from admin_sessions where token = ${token}`;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'themePreference') {
    const preference = (req.body as { preference?: string }).preference;
    if (preference !== 'system' && preference !== 'light' && preference !== 'dark') {
      throw new HttpError(400, 'preference must be system, light, or dark');
    }
    await sql`update admins set theme_preference = ${preference} where id = ${authedAdmin.id}`;
    res.status(200).json({ themePreference: preference });
    return;
  }

  if (action === 'changePassword') {
    const { currentPassword, newPassword } = req.body as ChangePasswordBody;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw new HttpError(400, 'Current password and a new password (min. 8 characters) are required');
    }
    const rows = (await sql`select password_hash from admins where id = ${authedAdmin.id}`) as Array<{ password_hash: string | null }>;
    if (!rows[0]?.password_hash || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
      throw new HttpError(401, 'Current password is incorrect');
    }
    const newHash = await hashPassword(newPassword);
    await sql`update admins set password_hash = ${newHash}, must_change_password = false where id = ${authedAdmin.id}`;
    res.status(200).json({ ok: true });
    return;
  }

  // --- Support Centre agents + super-admin: cross-club actions, not scoped
  // to any single course ---
  if (authedAdmin.role === 'super_admin' || authedAdmin.role === 'support_agent') {
    const allowedActions = authedAdmin.role === 'super_admin' ? SUPER_ADMIN_ALLOWED_ACTIONS : SUPPORT_AGENT_ALLOWED_ACTIONS;
    if (!allowedActions.has(String(action))) {
      throw new HttpError(403, 'Not authorized for this action');
    }

    if (action === 'me' && req.method === 'GET') {
      res.status(200).json({
        admin: {
          id: authedAdmin.id,
          firstName: authedAdmin.firstName,
          lastName: authedAdmin.lastName,
          email: authedAdmin.email,
          username: authedAdmin.username,
          role: authedAdmin.role,
          mustChangePassword: authedAdmin.mustChangePassword,
          themePreference: authedAdmin.themePreference,
        },
        course: EMPTY_COURSE_DTO,
      });
      return;
    }

    // --- Support Centre inbox — shared by super_admin and support_agent;
    // any agent can pick up and reply to any ticket, no per-ticket
    // assignment (same "anyone on the team can answer" model the existing
    // per-club enquiries inbox already uses). ---
    if (action === 'supportInbox' && req.method === 'GET') {
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
      const rows = (await sql`
        select t.id, t.requester_type, t.requester_name, t.requester_email, t.subject, t.status,
               t.created_at, t.updated_at,
               (select body from support_ticket_messages m where m.ticket_id = t.id order by m.created_at desc limit 1) as last_message,
               exists(select 1 from support_ticket_messages m where m.ticket_id = t.id and m.read_by_agent = false) as has_unread
        from support_tickets t
        where (${statusFilter}::text is null or t.status = ${statusFilter})
        order by t.updated_at desc
      `) as Array<{
        id: string;
        requester_type: string;
        requester_name: string;
        requester_email: string;
        subject: string;
        status: string;
        created_at: string;
        updated_at: string;
        last_message: string | null;
        has_unread: boolean;
      }>;
      res.status(200).json(
        rows.map((r) => ({
          id: r.id,
          requesterType: r.requester_type,
          requesterName: r.requester_name,
          requesterEmail: r.requester_email,
          subject: r.subject,
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          lastMessage: r.last_message,
          hasUnread: r.has_unread,
        })),
      );
      return;
    }

    if (action === 'supportInboxThread' && req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      const rows = (await sql`
        select id, requester_type, requester_name, requester_email, subject, status
        from support_tickets where id = ${id}
      `) as Array<{
        id: string;
        requester_type: string;
        requester_name: string;
        requester_email: string;
        subject: string;
        status: string;
      }>;
      if (rows.length === 0) throw new HttpError(404, 'Ticket not found');
      await markThreadReadByAgent(id);
      const t = rows[0];
      res.status(200).json({
        id: t.id,
        requesterType: t.requester_type,
        requesterName: t.requester_name,
        requesterEmail: t.requester_email,
        subject: t.subject,
        status: t.status,
        messages: await listSupportTicketMessages(id),
      });
      return;
    }

    if (action === 'supportAgentReply') {
      const { ticketId, message } = req.body as SupportTicketReplyBody;
      const body = message?.trim();
      if (!ticketId || !body) throw new HttpError(400, 'ticketId and message are required');
      const owned = (await sql`select id from support_tickets where id = ${ticketId}`) as Array<{ id: string }>;
      if (owned.length === 0) throw new HttpError(404, 'Ticket not found');
      await addAgentMessage(ticketId, authedAdmin.id, body);
      res.status(200).json(await listSupportTicketMessages(ticketId));
      return;
    }

    if (action === 'supportTicketStatus') {
      const { ticketId, status } = req.body as SupportTicketStatusBody;
      if (!ticketId || !status || !SUPPORT_TICKET_STATUSES.includes(status)) {
        throw new HttpError(400, 'ticketId and a valid status are required');
      }
      await sql`update support_tickets set status = ${status}, updated_at = now() where id = ${ticketId}`;
      res.status(200).json({ ok: true });
      return;
    }

    // --- Everything below is super_admin-only: course/ads/rewards/reporting
    // management, plus support_agent account management. ---
    if (authedAdmin.role === 'super_admin') {
      if (action === 'superAdminCourses' && req.method === 'GET') {
        const rows = (await sql`
          select c.id, c.name, c.slug, c.contact_email, c.subscription_status, c.archived_at, c.created_at, c.fb_per_rand,
            c.onboarding_completed_at, c.staff_onboarding_completed_at,
            (select count(*) from admins a where a.course_id = c.id and a.role = 'course_admin' and a.revoked_at is null) as admin_count,
            (select count(*) from users u where u.course_id = c.id) as member_count
          from courses c
          order by c.archived_at is not null, c.created_at desc
        `) as Array<Parameters<typeof superAdminCourseDto>[0]>;
        res.status(200).json(rows.map(superAdminCourseDto));
        return;
      }

      if (action === 'superAdminCourseCreate' && req.method === 'POST') {
        const body = req.body as CourseCreateBody;
        const courseName = body.courseName?.trim();
        const contactEmail = body.contactEmail?.trim().toLowerCase() || null;
        const adminFirstName = body.adminFirstName?.trim();
        const adminLastName = body.adminLastName?.trim() || '';
        const adminEmail = body.adminEmail?.trim().toLowerCase();
        if (!courseName || !adminFirstName || !adminEmail) {
          throw new HttpError(400, 'Course name, admin first name, and admin email are required');
        }
        if (!EMAIL_PATTERN.test(adminEmail)) throw new HttpError(400, 'Enter a valid admin email address');
        if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) throw new HttpError(400, 'Enter a valid contact email address');

        const newCourse = (await insertCourseWithUniqueSlug({ name: courseName, contactEmail }))[0];

        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        let createdAdmin: Array<{ id: string; first_name: string; last_name: string; email: string }>;
        try {
          createdAdmin = (await sql`
            insert into admins (course_id, role, first_name, last_name, email, password_hash, must_change_password, activated_at)
            values (${newCourse.id}, 'course_admin', ${adminFirstName}, ${adminLastName}, ${adminEmail}, ${passwordHash}, true, now())
            returning id, first_name, last_name, email
          `) as typeof createdAdmin;
        } catch (err) {
          if (isDuplicateKeyError(err)) throw new HttpError(409, 'A course admin with that email already exists');
          throw err;
        }

        await sendEmail({
          to: adminEmail,
          subject: `You've been set up as a course admin for ${courseName} on Flagrr`,
          html: `
            <p>Hi ${escapeHtml(adminFirstName)},</p>
            <p>${escapeHtml(authedAdmin.firstName)} ${escapeHtml(authedAdmin.lastName)} has set you up as the course admin for ${escapeHtml(courseName)} on Flagrr.</p>
            <p><strong>Login link:</strong> <a href="https://flagrr-loyalty.vercel.app">https://flagrr-loyalty.vercel.app</a></p>
            <p><strong>Email:</strong> ${escapeHtml(adminEmail)}<br/>
            <strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
            <p>You'll be asked to choose your own password the first time you log in.</p>
          `,
        });

        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseCreate',
          targetType: 'course',
          targetId: newCourse.id,
          targetLabel: courseName,
        });

        res.status(200).json({
          course: superAdminCourseDto({ ...newCourse, admin_count: 1, member_count: 0 }),
          admin: {
            id: createdAdmin[0].id,
            firstName: createdAdmin[0].first_name,
            lastName: createdAdmin[0].last_name,
            email: createdAdmin[0].email,
          },
        });
        return;
      }

      // No live billing/Stripe wiring yet — these just flip the same
      // subscription_status column the Courses list already reads for its
      // badge. That column isn't purely cosmetic though: a 'canceled' club's
      // own course_admin/staff accounts are blocked from logging in (see
      // getAuthedAdmin/the login action), and its members fall back to the
      // standard non-participating-club point rate (see isClubParticipating
      // in pointsEngine.ts) until it's reactivated.
      if (action === 'superAdminCourseCancelSubscription') {
        const { courseId } = req.body as SubscriptionActionBody;
        if (!courseId) throw new HttpError(400, 'courseId is required');
        const updated = (await sql`
          update courses set subscription_status = 'canceled' where id = ${courseId} returning name
        `) as Array<{ name: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseCancelSubscription',
          targetType: 'course',
          targetId: courseId,
          targetLabel: updated[0]?.name,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'superAdminCourseReactivateSubscription') {
        const { courseId } = req.body as SubscriptionActionBody;
        if (!courseId) throw new HttpError(400, 'courseId is required');
        const updated = (await sql`
          update courses set subscription_status = 'active' where id = ${courseId} returning name
        `) as Array<{ name: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseReactivateSubscription',
          targetType: 'course',
          targetId: courseId,
          targetLabel: updated[0]?.name,
        });
        res.status(200).json({ ok: true });
        return;
      }

      // --- Archive/unarchive a club — hides it from the default Courses
      // list without touching any of its data (members, receipts, rewards,
      // ads, roster). Fully reversible, unlike a real delete. ---
      if (action === 'superAdminCourseArchive') {
        const { courseId } = req.body as SubscriptionActionBody;
        if (!courseId) throw new HttpError(400, 'courseId is required');
        const updated = (await sql`
          update courses set archived_at = now() where id = ${courseId} returning name
        `) as Array<{ name: string }>;
        if (updated.length === 0) throw new HttpError(404, 'Course not found');
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseArchive',
          targetType: 'course',
          targetId: courseId,
          targetLabel: updated[0]?.name,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'superAdminCourseUnarchive') {
        const { courseId } = req.body as SubscriptionActionBody;
        if (!courseId) throw new HttpError(400, 'courseId is required');
        const updated = (await sql`
          update courses set archived_at = null where id = ${courseId} returning name
        `) as Array<{ name: string }>;
        if (updated.length === 0) throw new HttpError(404, 'Course not found');
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseUnarchive',
          targetType: 'course',
          targetId: courseId,
          targetLabel: updated[0]?.name,
        });
        res.status(200).json({ ok: true });
        return;
      }

      // --- Member roster (verify membership at signup) — a super_admin can
      // upload a club's list on its behalf, same as the course_admin action
      // further below but with an explicit courseId instead of session scope. ---
      if (action === 'superAdminMemberRosterStatus' && req.method === 'GET') {
        const targetCourseId = typeof req.query.courseId === 'string' ? req.query.courseId : undefined;
        if (!targetCourseId) throw new HttpError(400, 'courseId is required');
        res.status(200).json(await getRosterStatus(targetCourseId));
        return;
      }

      if (action === 'superAdminMemberRosterUpload') {
        const body = req.body as SuperAdminMemberRosterUploadBody;
        if (!body.courseId) throw new HttpError(400, 'courseId is required');
        const { fileName, fileBase64 } = body;
        if (!fileName || !fileBase64 || fileBase64.length > MAX_ROSTER_FILE_BASE64_LENGTH) {
          throw new HttpError(400, 'A member list file (CSV or Excel) is required and must be under 3MB');
        }
        let parsedRows;
        try {
          parsedRows = await parseMemberRosterFile(fileName, fileBase64);
        } catch (err) {
          throw new HttpError(400, err instanceof Error ? err.message : 'Could not parse the member list file');
        }
        const rosterResult = await replaceMemberRoster(body.courseId, parsedRows);
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminMemberRosterUpload',
          targetType: 'course',
          targetId: body.courseId,
          targetLabel: `${rosterResult.rosterCount} members`,
        });
        res.status(200).json(rosterResult);
        return;
      }

      // --- Cross-club member lookup — same idea as a course_admin's own
      // 'members'/'memberStats' actions further below, but not scoped to any
      // single course_id, so a search or a stats lookup can find any member
      // platform-wide instead of only within one club. Every result includes
      // which club the member belongs to, since that's no longer implicit. ---
      if (action === 'superAdminMembers' && req.method === 'GET') {
        const query = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        if (!query) throw new HttpError(400, 'Enter a search term');
        const search = `%${query}%`;
        const rows = (await sql`
          select u.id, u.first_name, u.last_name, u.email, u.tier, u.member_since, p.balance, c.id as course_id, c.name as course_name
          from users u
          join points_accounts p on p.user_id = u.id
          join courses c on c.id = u.course_id
          where u.first_name || ' ' || u.last_name ilike ${search} or u.email ilike ${search}
          order by u.first_name, u.last_name
          limit 100
        `) as Array<{
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          tier: string;
          member_since: string;
          balance: number;
          course_id: string;
          course_name: string;
        }>;
        res.status(200).json(
          rows.map((r) => ({
            id: r.id,
            firstName: r.first_name,
            lastName: r.last_name,
            email: r.email,
            tier: r.tier,
            memberSince: r.member_since,
            balance: r.balance,
            courseId: r.course_id,
            courseName: r.course_name,
          })),
        );
        return;
      }

      if (action === 'superAdminMemberStats' && req.method === 'GET') {
        const memberId = typeof req.query.id === 'string' ? req.query.id : '';
        if (!memberId) throw new HttpError(400, 'id is required');
        const period: StatsPeriod = isStatsPeriod(req.query.period) ? req.query.period : 'month';
        const { currentStart, previousStart, previousEnd, hasComparison } = periodWindow(period);

        const memberRows = (await sql`
          select u.id, u.first_name, u.last_name, u.email, u.tier, u.member_since, p.balance, p.total_earned, p.total_redeemed,
                 c.name as course_name
          from users u
          join points_accounts p on p.user_id = u.id
          join courses c on c.id = u.course_id
          where u.id = ${memberId}
        `) as Array<{
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          tier: string;
          member_since: string;
          balance: number;
          total_earned: number;
          total_redeemed: number;
          course_name: string;
        }>;
        if (memberRows.length === 0) throw new HttpError(404, 'Member not found');
        const m = memberRows[0];

        const [bucksRows, roundsRows, receiptRows, monthlyRows] = await Promise.all([
          sql`
            select
              coalesce(sum(amount) filter (where type = 'earn' and date >= ${currentStart}), 0)::int as earned_current,
              coalesce(sum(amount) filter (where type = 'earn' and date >= ${previousStart} and date < ${previousEnd}), 0)::int as earned_previous,
              coalesce(sum(-amount) filter (where type = 'redeem' and date >= ${currentStart}), 0)::int as redeemed_current,
              coalesce(sum(-amount) filter (where type = 'redeem' and date >= ${previousStart} and date < ${previousEnd}), 0)::int as redeemed_previous
            from activity where user_id = ${memberId}
          `,
          sql`
            select
              coalesce(sum(ri.quantity) filter (where ga.name = '9 Hole Round' and r.submitted_at >= ${currentStart}), 0)::int as r9_current,
              coalesce(sum(ri.quantity) filter (where ga.name = '9 Hole Round' and r.submitted_at >= ${previousStart} and r.submitted_at < ${previousEnd}), 0)::int as r9_previous,
              coalesce(sum(ri.quantity) filter (where ga.name = '18 Hole Round' and r.submitted_at >= ${currentStart}), 0)::int as r18_current,
              coalesce(sum(ri.quantity) filter (where ga.name = '18 Hole Round' and r.submitted_at >= ${previousStart} and r.submitted_at < ${previousEnd}), 0)::int as r18_previous
            from receipts r
            join receipt_items ri on ri.receipt_id = r.id
            join golf_activities ga on ga.id = ri.matched_activity_id
            where r.user_id = ${memberId}
          `,
          sql`
            select
              count(*) filter (where submitted_at >= ${currentStart})::int as current,
              count(*) filter (where submitted_at >= ${previousStart} and submitted_at < ${previousEnd})::int as previous
            from receipts where user_id = ${memberId}
          `,
          sql`select month, value from monthly_points where user_id = ${memberId} and year = extract(year from now())::int`,
        ]);

        const bucks = (bucksRows as Array<{
          earned_current: number;
          earned_previous: number;
          redeemed_current: number;
          redeemed_previous: number;
        }>)[0];
        const rounds = (roundsRows as Array<{
          r9_current: number;
          r9_previous: number;
          r18_current: number;
          r18_previous: number;
        }>)[0];
        const receipts = (receiptRows as Array<{ current: number; previous: number }>)[0];

        res.status(200).json({
          member: {
            id: m.id,
            firstName: m.first_name,
            lastName: m.last_name,
            email: m.email,
            tier: m.tier,
            memberSince: m.member_since,
            balance: m.balance,
            totalEarned: m.total_earned,
            totalRedeemed: m.total_redeemed,
            courseName: m.course_name,
          },
          stats: {
            period,
            roundsPlayed9: rounds.r9_current,
            roundsPlayed9DeltaPct: deltaPct(rounds.r9_current, rounds.r9_previous, hasComparison),
            roundsPlayed18: rounds.r18_current,
            roundsPlayed18DeltaPct: deltaPct(rounds.r18_current, rounds.r18_previous, hasComparison),
            bucksEarned: bucks.earned_current,
            bucksEarnedDeltaPct: deltaPct(bucks.earned_current, bucks.earned_previous, hasComparison),
            bucksRedeemed: bucks.redeemed_current,
            bucksRedeemedDeltaPct: deltaPct(bucks.redeemed_current, bucks.redeemed_previous, hasComparison),
            receiptsScanned: receipts.current,
            receiptsScannedDeltaPct: deltaPct(receipts.current, receipts.previous, hasComparison),
            monthly: fillMonthlyByNumber(monthlyRows as Array<{ month: number; value: number }>),
          },
        });
        return;
      }

      // --- Cross-club fraud oversight — a course_admin only ever sees
      // flagged receipts (and duplicate rejections) for their own club; this
      // is the platform-wide equivalent, plus the one signal no single club
      // could ever piece together on its own: the same member's receipt
      // being flagged, or the same receipt/image reused, at a *different*
      // club. ---
      if (action === 'superAdminFlaggedReceipts' && req.method === 'GET') {
        const rows = (await sql`
          select r.id, r.course_id, c.name as course_name, r.user_id, u.first_name, u.last_name, u.email,
            r.course_name as merchant_name, r.total, r.points_awarded, r.submitted_at, r.flag_reason,
            (select count(*) from receipts r2 where r2.flagged = true and r2.user_id = r.user_id) as member_flag_count
          from receipts r
          join users u on u.id = r.user_id
          join courses c on c.id = r.course_id
          where r.flagged = true
          order by r.submitted_at desc
          limit 200
        `) as Array<{
          id: string;
          course_id: string;
          course_name: string;
          user_id: string;
          first_name: string;
          last_name: string;
          email: string;
          merchant_name: string;
          total: string;
          points_awarded: number | null;
          submitted_at: string;
          flag_reason: string | null;
          member_flag_count: number | string;
        }>;
        res.status(200).json(
          rows.map((r) => ({
            id: r.id,
            courseId: r.course_id,
            courseName: r.course_name,
            memberId: r.user_id,
            memberName: `${r.first_name} ${r.last_name}`,
            memberEmail: r.email,
            merchantName: r.merchant_name,
            total: Number(r.total),
            pointsAwarded: r.points_awarded,
            submittedAt: r.submitted_at,
            flagReason: r.flag_reason ? describeFraudReasons(r.flag_reason.split(', ')) : null,
            memberFlagCount: Number(r.member_flag_count),
          })),
        );
        return;
      }

      if (action === 'superAdminDuplicateAttempts' && req.method === 'GET') {
        const rows = (await sql`
          select d.id, d.attempted_at, d.match_type,
            d.user_id, u.first_name, u.last_name, u.email,
            d.course_id as attempted_course_id, ac.name as attempted_course_name,
            r.course_id as original_course_id, oc.name as original_course_name,
            r.submitted_at as original_submitted_at
          from receipt_duplicate_attempts d
          join users u on u.id = d.user_id
          join courses ac on ac.id = d.course_id
          left join receipts r on r.id = d.matched_receipt_id
          left join courses oc on oc.id = r.course_id
          order by d.attempted_at desc
          limit 200
        `) as Array<{
          id: string;
          attempted_at: string;
          match_type: string;
          user_id: string;
          first_name: string;
          last_name: string;
          email: string;
          attempted_course_id: string;
          attempted_course_name: string;
          original_course_id: string | null;
          original_course_name: string | null;
          original_submitted_at: string | null;
        }>;
        res.status(200).json(
          rows.map((r) => ({
            id: r.id,
            attemptedAt: r.attempted_at,
            matchType: r.match_type,
            memberId: r.user_id,
            memberName: `${r.first_name} ${r.last_name}`,
            memberEmail: r.email,
            attemptedCourseId: r.attempted_course_id,
            attemptedCourseName: r.attempted_course_name,
            originalCourseId: r.original_course_id,
            originalCourseName: r.original_course_name,
            originalSubmittedAt: r.original_submitted_at,
            crossClub: r.original_course_id !== null && r.original_course_id !== r.attempted_course_id,
          })),
        );
        return;
      }

      // Lazy-loaded on demand (not included in superAdminFlaggedReceipts'
      // list payload) so browsing the flagged list stays light — only
      // fetched when a super_admin actually taps to view one receipt's photo.
      if (action === 'superAdminReceiptImage' && req.method === 'GET') {
        const receiptId = typeof req.query.id === 'string' ? req.query.id : undefined;
        if (!receiptId) throw new HttpError(400, 'id is required');
        const rows = (await sql`select image_data from receipts where id = ${receiptId}`) as Array<{
          image_data: string | null;
        }>;
        if (rows.length === 0) throw new HttpError(404, 'Receipt not found');
        res.status(200).json({ imageData: rows[0].image_data });
        return;
      }

      // --- Push notifications — platform-wide, unlike a club's own
      // broadcast (see 'broadcastSend' further below, course-scoped). ---
      if (action === 'superAdminBroadcasts' && req.method === 'GET') {
        const rows = (await sql`
          select b.id, b.title, b.body, b.target, b.recipient_count, b.sent_at, b.course_id, c.name as course_name
          from super_admin_broadcasts b
          left join courses c on c.id = b.course_id
          order by b.sent_at desc
          limit 100
        `) as Array<{
          id: string;
          title: string;
          body: string;
          target: string;
          recipient_count: number;
          sent_at: string;
          course_id: string | null;
          course_name: string | null;
        }>;
        res.status(200).json(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            body: r.body,
            target: r.target,
            recipientCount: r.recipient_count,
            sentAt: r.sent_at,
            courseId: r.course_id,
            courseName: r.course_name,
          })),
        );
        return;
      }

      if (action === 'superAdminBroadcastSend') {
        const body = req.body as SuperAdminBroadcastSendBody;
        const title = body.title?.trim();
        const message = body.body?.trim();
        const target = body.target?.trim();
        const courseId = body.courseId?.trim() || null;
        if (!title) throw new HttpError(400, 'title is required');
        if (!message) throw new HttpError(400, 'body is required');
        if (!target || !SUPER_ADMIN_BROADCAST_TARGETS.includes(target)) {
          throw new HttpError(400, 'a valid target is required');
        }
        if (courseId) {
          const courseExists = (await sql`select 1 from courses where id = ${courseId}`) as Array<{ '?column?': number }>;
          if (courseExists.length === 0) throw new HttpError(400, 'Unknown course');
        }

        let recipientCount: number;
        if (target === 'course_admins') {
          const recipients = (await sql`
            select id from admins
            where role = 'course_admin' and revoked_at is null
              ${courseId ? sql`and course_id = ${courseId}` : sql``}
          `) as Array<{ id: string }>;
          recipientCount = recipients.length;

          if (recipients.length > 0) {
            // One row per distinct club — every course_admin at that club
            // already reads admin_notifications scoped by their own course_id
            // (see the 'notifications' action further below), so this shows
            // up in their existing bell without any new per-recipient plumbing.
            await sql`
              insert into admin_notifications (course_id, title, body)
              select distinct course_id, ${title}, ${message} from admins
              where role = 'course_admin' and revoked_at is null
                ${courseId ? sql`and course_id = ${courseId}` : sql``}
            `;
            await Promise.allSettled(recipients.map((r) => sendPushToAdmin(r.id, { title, body: message })));
          }
        } else {
          const recipients = (await sql`
            select id from users
            where ${target !== 'all' ? sql`tier = ${target}` : sql`true`}
              ${courseId ? sql`and course_id = ${courseId}` : sql``}
          `) as Array<{ id: string }>;
          recipientCount = recipients.length;

          if (recipients.length > 0) {
            await sql`
              insert into notifications (user_id, title, body)
              select id, ${title}, ${message} from users
              where ${target !== 'all' ? sql`tier = ${target}` : sql`true`}
                ${courseId ? sql`and course_id = ${courseId}` : sql``}
            `;
            await Promise.allSettled(recipients.map((r) => sendPushToUser(r.id, { title, body: message })));
          }
        }

        const inserted = (await sql`
          with inserted as (
            insert into super_admin_broadcasts (admin_id, title, body, target, recipient_count, course_id)
            values (${authedAdmin.id}, ${title}, ${message}, ${target}, ${recipientCount}, ${courseId})
            returning id, title, body, target, recipient_count, sent_at, course_id
          )
          select i.*, c.name as course_name from inserted i left join courses c on c.id = i.course_id
        `) as Array<{
          id: string;
          title: string;
          body: string;
          target: string;
          recipient_count: number;
          sent_at: string;
          course_id: string | null;
          course_name: string | null;
        }>;
        const b = inserted[0];
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminBroadcastSend',
          targetType: 'broadcast',
          targetId: b.id,
          targetLabel: b.title,
        });
        res.status(200).json({
          id: b.id,
          title: b.title,
          body: b.body,
          target: b.target,
          recipientCount: b.recipient_count,
          sentAt: b.sent_at,
          courseId: b.course_id,
          courseName: b.course_name,
        });
        return;
      }

      if (action === 'superAdminBroadcastDelete') {
        const id = (req.body as SuperAdminBroadcastDeleteBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const deleted = (await sql`delete from super_admin_broadcasts where id = ${id} returning title`) as Array<{ title: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminBroadcastDelete',
          targetType: 'broadcast',
          targetId: id,
          targetLabel: deleted[0]?.title,
        });
        res.status(200).json({ ok: true });
        return;
      }

      // --- Course admin account management — add a second (or replacement)
      // course_admin to an existing club, reset a password, or revoke/
      // reactivate/delete access, without needing direct DB access. ---
      if (action === 'superAdminCourseAdmins' && req.method === 'GET') {
        const targetCourseId = typeof req.query.courseId === 'string' ? req.query.courseId : undefined;
        if (!targetCourseId) throw new HttpError(400, 'courseId is required');
        const rows = (await sql`
          select id, first_name, last_name, email, must_change_password, revoked_at, created_at
          from admins where course_id = ${targetCourseId} and role = 'course_admin'
          order by created_at desc
        `) as Array<{
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          must_change_password: boolean;
          revoked_at: string | null;
          created_at: string;
        }>;
        res.status(200).json(rows.map(courseAdminAccountDto));
        return;
      }

      if (action === 'superAdminCourseAdminCreate' && req.method === 'POST') {
        const body = req.body as SuperAdminCourseAdminCreateBody;
        const targetCourseId = body.courseId?.trim();
        const firstName = body.firstName?.trim();
        const lastName = body.lastName?.trim() || '';
        const email = body.email?.trim().toLowerCase();
        if (!targetCourseId) throw new HttpError(400, 'courseId is required');
        if (!firstName || !email) throw new HttpError(400, 'First name and email are required');
        if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter a valid email address');

        const targetCourse = await fetchCourse(targetCourseId);

        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        let created: Array<{
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          must_change_password: boolean;
          revoked_at: string | null;
          created_at: string;
        }>;
        try {
          created = (await sql`
            insert into admins (course_id, role, first_name, last_name, email, password_hash, must_change_password, activated_at)
            values (${targetCourseId}, 'course_admin', ${firstName}, ${lastName}, ${email}, ${passwordHash}, true, now())
            returning id, first_name, last_name, email, must_change_password, revoked_at, created_at
          `) as typeof created;
        } catch (err) {
          if (isDuplicateKeyError(err)) throw new HttpError(409, 'An admin with that email already exists');
          throw err;
        }

        await sendEmail({
          to: email,
          subject: `You've been set up as a course admin for ${targetCourse.name} on Flagrr`,
          html: `
            <p>Hi ${escapeHtml(firstName)},</p>
            <p>${escapeHtml(authedAdmin.firstName)} ${escapeHtml(authedAdmin.lastName)} has set you up as a course admin for ${escapeHtml(targetCourse.name)} on Flagrr.</p>
            <p><strong>Login link:</strong> <a href="https://flagrr-loyalty.vercel.app">https://flagrr-loyalty.vercel.app</a></p>
            <p><strong>Email:</strong> ${escapeHtml(email)}<br/>
            <strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
            <p>You'll be asked to choose your own password the first time you log in.</p>
          `,
        });

        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseAdminCreate',
          targetType: 'course_admin',
          targetId: created[0].id,
          targetLabel: `${email} (${targetCourse.name})`,
        });
        res.status(200).json(courseAdminAccountDto(created[0]));
        return;
      }

      if (action === 'superAdminCourseAdminResetPassword' && req.method === 'POST') {
        const id = (req.body as SuperAdminCourseAdminIdBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const rows = (await sql`
          select email, first_name, course_id from admins where id = ${id} and role = 'course_admin'
        `) as Array<{ email: string; first_name: string; course_id: string }>;
        if (rows.length === 0) throw new HttpError(404, 'Course admin not found');
        const target = rows[0];

        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        await sql`update admins set password_hash = ${passwordHash}, must_change_password = true where id = ${id}`;

        const targetCourse = await fetchCourse(target.course_id);
        await sendEmail({
          to: target.email,
          subject: `Your Flagrr password has been reset`,
          html: `
            <p>Hi ${escapeHtml(target.first_name)},</p>
            <p>Your password for ${escapeHtml(targetCourse.name)} on Flagrr has been reset.</p>
            <p><strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
            <p>You'll be asked to choose your own password the next time you log in.</p>
          `,
        });
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseAdminResetPassword',
          targetType: 'course_admin',
          targetId: id,
          targetLabel: target.email,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'superAdminCourseAdminRevoke') {
        const id = (req.body as SuperAdminCourseAdminIdBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const updated = (await sql`
          update admins set revoked_at = now() where id = ${id} and role = 'course_admin' returning email
        `) as Array<{ email: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseAdminRevoke',
          targetType: 'course_admin',
          targetId: id,
          targetLabel: updated[0]?.email,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'superAdminCourseAdminReactivate') {
        const id = (req.body as SuperAdminCourseAdminIdBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const updated = (await sql`
          update admins set revoked_at = null where id = ${id} and role = 'course_admin' returning email
        `) as Array<{ email: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseAdminReactivate',
          targetType: 'course_admin',
          targetId: id,
          targetLabel: updated[0]?.email,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'superAdminCourseAdminDelete') {
        const id = (req.body as SuperAdminCourseAdminIdBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const deleted = (await sql`
          delete from admins where id = ${id} and role = 'course_admin' returning email
        `) as Array<{ email: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminCourseAdminDelete',
          targetType: 'course_admin',
          targetId: id,
          targetLabel: deleted[0]?.email,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'superAdminAds' && req.method === 'GET') {
        const targetCourseId = resolveAdCourseId(typeof req.query.courseId === 'string' ? req.query.courseId : undefined);
        res.status(200).json(await listAdsForCourse(targetCourseId));
        return;
      }

      if (action === 'superAdminAdSave') {
        const body = req.body as SuperAdminAdSaveBody;
        const targetCourseId = resolveAdCourseId(body.courseId);
        const saved = await saveAdForCourse(targetCourseId, body);
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminAdSave',
          targetType: 'ad',
          targetId: saved.id,
          targetLabel: body.title,
        });
        res.status(200).json(saved);
        return;
      }

      if (action === 'superAdminAdDelete') {
        const body = req.body as SuperAdminAdDeleteBody;
        const targetCourseId = resolveAdCourseId(body.courseId);
        if (!body.id) throw new HttpError(400, 'id is required');
        await deleteAdForCourse(targetCourseId, body.id);
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminAdDelete',
          targetType: 'ad',
          targetId: body.id,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'superAdminRewards' && req.method === 'GET') {
        const targetCourseId = typeof req.query.courseId === 'string' ? req.query.courseId : undefined;
        if (!targetCourseId) throw new HttpError(400, 'courseId is required');
        res.status(200).json(await listRewardsForCourse(targetCourseId));
        return;
      }

      if (action === 'superAdminRewardSave') {
        const body = req.body as SuperAdminRewardSaveBody;
        if (!body.courseId) throw new HttpError(400, 'courseId is required');
        const saved = await saveRewardForCourse(body.courseId, body);
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminRewardSave',
          targetType: 'reward',
          targetId: saved.id,
          targetLabel: body.title,
        });
        res.status(200).json(saved);
        return;
      }

      if (action === 'superAdminRewardDelete') {
        const body = req.body as SuperAdminRewardDeleteBody;
        if (!body.courseId) throw new HttpError(400, 'courseId is required');
        if (!body.id) throw new HttpError(400, 'id is required');
        await deleteRewardForCourse(body.courseId, body.id);
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'superAdminRewardDelete',
          targetType: 'reward',
          targetId: body.id,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'superAdminDashboard' && req.method === 'GET') {
        const period: StatsPeriod = isStatsPeriod(req.query.period) ? req.query.period : 'month';
        res.status(200).json(await getSuperAdminDashboardReport(period));
        return;
      }

      if (action === 'superAdminAdPerformance' && req.method === 'GET') {
        res.status(200).json(await getAdPerformanceReport());
        return;
      }

      if (action === 'superAdminStatBreakdown' && req.method === 'GET') {
        const period: StatsPeriod = isStatsPeriod(req.query.period) ? req.query.period : 'month';
        const metric = req.query.metric;
        if (!STAT_BREAKDOWN_METRICS.has(String(metric))) {
          throw new HttpError(400, 'metric must be one of members, newMembers, fcEarned, fcRedeemed, receiptsScanned');
        }
        res.status(200).json(await getSuperAdminStatBreakdown(period, metric as StatBreakdownMetric));
        return;
      }

      // --- Audit log — read-only record of the super_admin mutating actions
      // above (course/subscription/roster/broadcast/course-admin/ad/reward/
      // support-agent changes), for accountability once more than one person
      // has super_admin access. ---
      if (action === 'auditLog' && req.method === 'GET') {
        const rows = (await sql`
          select id, admin_id, admin_name, admin_role, action, target_type, target_id, target_label, created_at
          from audit_log
          order by created_at desc
          limit 200
        `) as Array<{
          id: string;
          admin_id: string | null;
          admin_name: string;
          admin_role: string;
          action: string;
          target_type: string | null;
          target_id: string | null;
          target_label: string | null;
          created_at: string;
        }>;
        res.status(200).json(
          rows.map((r) => ({
            id: r.id,
            adminId: r.admin_id,
            adminName: r.admin_name,
            adminRole: r.admin_role,
            action: r.action,
            targetType: r.target_type,
            targetId: r.target_id,
            targetLabel: r.target_label,
            createdAt: r.created_at,
          })),
        );
        return;
      }

      // --- Support agent account management ---
      if (action === 'supportAgents' && req.method === 'GET') {
        const rows = (await sql`
          select id, first_name, last_name, email, must_change_password, revoked_at, created_at
          from admins where role = 'support_agent'
          order by created_at desc
        `) as Array<{
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          must_change_password: boolean;
          revoked_at: string | null;
          created_at: string;
        }>;
        res.status(200).json(
          rows.map((r) => ({
            id: r.id,
            firstName: r.first_name,
            lastName: r.last_name,
            email: r.email,
            mustChangePassword: r.must_change_password,
            revoked: r.revoked_at !== null,
            createdAt: r.created_at,
          })),
        );
        return;
      }

      if (action === 'supportAgentCreate' && req.method === 'POST') {
        const body = req.body as SupportAgentCreateBody;
        const firstName = body.firstName?.trim();
        const lastName = body.lastName?.trim() || '';
        const email = body.email?.trim().toLowerCase();
        if (!firstName || !email) throw new HttpError(400, 'firstName and email are required');
        if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter a valid email address');

        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        let created: Array<{ id: string; first_name: string; last_name: string; email: string; created_at: string }>;
        try {
          created = (await sql`
            insert into admins (course_id, role, first_name, last_name, email, password_hash, must_change_password, activated_at)
            values (null, 'support_agent', ${firstName}, ${lastName}, ${email}, ${passwordHash}, true, now())
            returning id, first_name, last_name, email, created_at
          `) as typeof created;
        } catch (err) {
          if (isDuplicateKeyError(err)) throw new HttpError(409, 'A support agent with that email already exists');
          throw err;
        }

        await sendEmail({
          to: email,
          subject: `You've been set up as a Flagrr support agent`,
          html: `
            <p>Hi ${escapeHtml(firstName)},</p>
            <p>${escapeHtml(authedAdmin.firstName)} ${escapeHtml(authedAdmin.lastName)} has set you up with support agent access on Flagrr, so you can respond to member and club support tickets.</p>
            <p><strong>Login link:</strong> <a href="https://flagrr-loyalty.vercel.app">https://flagrr-loyalty.vercel.app</a></p>
            <p><strong>Email:</strong> ${escapeHtml(email)}<br/>
            <strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
            <p>You'll be asked to choose your own password the first time you log in.</p>
          `,
        });

        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'supportAgentCreate',
          targetType: 'support_agent',
          targetId: created[0].id,
          targetLabel: email,
        });
        res.status(200).json({
          id: created[0].id,
          firstName: created[0].first_name,
          lastName: created[0].last_name,
          email: created[0].email,
          mustChangePassword: true,
          revoked: false,
          createdAt: created[0].created_at,
        });
        return;
      }

      if (action === 'supportAgentResetPassword') {
        const id = (req.body as SupportAgentIdBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const rows = (await sql`
          select email, first_name from admins where id = ${id} and role = 'support_agent'
        `) as Array<{ email: string; first_name: string }>;
        if (rows.length === 0) throw new HttpError(404, 'Support agent not found');
        const target = rows[0];

        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        await sql`update admins set password_hash = ${passwordHash}, must_change_password = true where id = ${id}`;

        await sendEmail({
          to: target.email,
          subject: `Your Flagrr password has been reset`,
          html: `
            <p>Hi ${escapeHtml(target.first_name)},</p>
            <p>Your Flagrr support agent password has been reset.</p>
            <p><strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
            <p>You'll be asked to choose your own password the next time you log in.</p>
          `,
        });
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'supportAgentResetPassword',
          targetType: 'support_agent',
          targetId: id,
          targetLabel: target.email,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'supportAgentRevoke') {
        const id = (req.body as SupportAgentIdBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const updated = (await sql`
          update admins set revoked_at = now() where id = ${id} and role = 'support_agent' returning email
        `) as Array<{ email: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'supportAgentRevoke',
          targetType: 'support_agent',
          targetId: id,
          targetLabel: updated[0]?.email,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'supportAgentReactivate') {
        const id = (req.body as SupportAgentIdBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const updated = (await sql`
          update admins set revoked_at = null where id = ${id} and role = 'support_agent' returning email
        `) as Array<{ email: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'supportAgentReactivate',
          targetType: 'support_agent',
          targetId: id,
          targetLabel: updated[0]?.email,
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'supportAgentDelete') {
        const id = (req.body as SupportAgentIdBody).id;
        if (!id) throw new HttpError(400, 'id is required');
        const deleted = (await sql`
          delete from admins where id = ${id} and role = 'support_agent' returning email
        `) as Array<{ email: string }>;
        await logAudit({
          adminId: authedAdmin.id,
          adminName: `${authedAdmin.firstName} ${authedAdmin.lastName}`,
          adminRole: authedAdmin.role,
          action: 'supportAgentDelete',
          targetType: 'support_agent',
          targetId: id,
          targetLabel: deleted[0]?.email,
        });
        res.status(200).json({ ok: true });
        return;
      }
    }

    throw new HttpError(404, 'Unknown action');
  }

  // --- Everything below requires a logged-in course_admin or staff account ---
  if ((authedAdmin.role !== 'course_admin' && authedAdmin.role !== 'staff') || !authedAdmin.courseId) {
    throw new HttpError(403, 'This account type is not supported yet');
  }
  const authed = authedAdmin as AuthedAdmin & { courseId: string };
  const courseId = authed.courseId;

  if (authed.role === 'staff' && !STAFF_ALLOWED_ACTIONS.has(String(action))) {
    throw new HttpError(403, 'Not authorized for this action');
  }

  if (action === 'me' && req.method === 'GET') {
    const course = await fetchCourse(courseId);
    res.status(200).json({
      admin: {
        id: authed.id,
        firstName: authed.firstName,
        lastName: authed.lastName,
        email: authed.email,
        username: authed.username,
        role: authed.role,
        mustChangePassword: authed.mustChangePassword,
        themePreference: authed.themePreference,
      },
      course,
    });
    return;
  }

  if (action === 'dashboard' && req.method === 'GET') {
    const period: StatsPeriod = isStatsPeriod(req.query.period) ? req.query.period : 'month';
    const report = await getDashboardReport(courseId, period);
    res.status(200).json(report);
    return;
  }

  // course_admin-only (not in STAFF_ALLOWED_ACTIONS) — lets a super_admin's
  // platform-wide broadcast (see superAdminBroadcastSend below) reach this
  // device, the same way a member broadcast already does for members.
  if (action === 'registerPushToken') {
    const { token, platform } = req.body as AdminRegisterPushTokenBody;
    if (!token || (platform !== 'ios' && platform !== 'android')) {
      throw new HttpError(400, 'token and a valid platform are required');
    }
    await registerAdminPushToken(authed.id, token, platform);
    res.status(200).json({ ok: true });
    return;
  }

  // Support Centre (requester side) — a ticket to the Flagrr team itself,
  // not the club's own enquiries inbox (see 'enquiries' below, which stays
  // member <-> this club's admins). Available to course_admin and staff.
  if (action === 'supportTickets' && req.method === 'GET') {
    const rows = (await sql`
      select t.id, t.subject, t.status, t.created_at, t.updated_at,
             (select body from support_ticket_messages m where m.ticket_id = t.id order by m.created_at desc limit 1) as last_message,
             exists(select 1 from support_ticket_messages m where m.ticket_id = t.id and m.read_by_requester = false) as has_unread
      from support_tickets t
      where t.requester_admin_id = ${authed.id}
      order by t.updated_at desc
    `) as Array<{
      id: string;
      subject: string;
      status: string;
      created_at: string;
      updated_at: string;
      last_message: string | null;
      has_unread: boolean;
    }>;
    res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lastMessage: r.last_message,
        hasUnread: r.has_unread,
      })),
    );
    return;
  }

  if (action === 'supportTicketThread' && req.method === 'GET') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const owned = (await sql`
      select id, status, subject from support_tickets where id = ${id} and requester_admin_id = ${authed.id}
    `) as Array<{ id: string; status: string; subject: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Ticket not found');
    await markThreadReadByRequester(id);
    res.status(200).json({
      id: owned[0].id,
      status: owned[0].status,
      subject: owned[0].subject,
      messages: await listSupportTicketMessages(id),
    });
    return;
  }

  if (action === 'supportTicketCreate') {
    const { subject, message } = req.body as SupportTicketCreateBody;
    const trimmedSubject = subject?.trim();
    const trimmedMessage = message?.trim();
    if (!trimmedSubject || !trimmedMessage) {
      throw new HttpError(400, 'subject and message are required');
    }
    const requesterName = `${authed.firstName} ${authed.lastName}`.trim();
    const ticketId = await createSupportTicket({
      requesterType: authed.role === 'staff' ? 'staff' : 'course_admin',
      requesterUserId: null,
      requesterAdminId: authed.id,
      requesterName,
      requesterEmail: authed.email,
      courseId,
      subject: trimmedSubject,
      message: trimmedMessage,
    });
    await sendEmail({
      to: CONTACT_EMAIL,
      subject: `New support ticket: ${trimmedSubject}`,
      html: `
        <p><strong>From:</strong> ${escapeHtml(requesterName)} (${escapeHtml(authed.email)}) — ${authed.role}</p>
        <p><strong>Subject:</strong> ${escapeHtml(trimmedSubject)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(trimmedMessage).replace(/\n/g, '<br/>')}</p>
      `,
    });
    res.status(200).json({ ok: true, ticketId });
    return;
  }

  if (action === 'supportTicketReply') {
    const { ticketId, message } = req.body as SupportTicketReplyBody;
    const body = message?.trim();
    if (!ticketId || !body) throw new HttpError(400, 'ticketId and message are required');
    const owned = (await sql`
      select id from support_tickets where id = ${ticketId} and requester_admin_id = ${authed.id}
    `) as Array<{ id: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Ticket not found');
    await addRequesterMessage(ticketId, body);
    res.status(200).json(await listSupportTicketMessages(ticketId));
    return;
  }

  if (action === 'notifications' && req.method === 'GET') {
    const rows = (await sql`
      select id, title, body, receipt_id, enquiry_id, date, read
      from admin_notifications
      where course_id = ${courseId}
      order by date desc
      limit 50
    `) as Array<{
      id: string;
      title: string;
      body: string;
      receipt_id: string | null;
      enquiry_id: string | null;
      date: string;
      read: boolean;
    }>;
    res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        receiptId: r.receipt_id,
        enquiryId: r.enquiry_id,
        date: r.date,
        read: r.read,
      })),
    );
    return;
  }

  if (action === 'notificationRead') {
    const id = (req.body as { id?: string }).id;
    if (!id) throw new HttpError(400, 'id is required');
    await sql`update admin_notifications set read = true where id = ${id} and course_id = ${courseId}`;
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'enquiries' && req.method === 'GET') {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
    const rows = (await sql`
      select e.id, e.enquiry_type, e.status, e.created_at, e.updated_at,
             u.first_name, u.last_name, u.email,
             (select body from enquiry_messages m where m.enquiry_id = e.id order by m.created_at desc limit 1) as last_message,
             exists(select 1 from enquiry_messages m where m.enquiry_id = e.id and m.read_by_admin = false) as has_unread
      from enquiries e
      join users u on u.id = e.user_id
      where e.course_id = ${courseId}
        and (${statusFilter}::text is null or e.status = ${statusFilter})
      order by e.updated_at desc
    `) as Array<{
      id: string;
      enquiry_type: string;
      status: string;
      created_at: string;
      updated_at: string;
      first_name: string;
      last_name: string;
      email: string;
      last_message: string | null;
      has_unread: boolean;
    }>;
    res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        enquiryType: r.enquiry_type,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        memberName: `${r.first_name} ${r.last_name}`,
        memberEmail: r.email,
        lastMessage: r.last_message,
        hasUnread: r.has_unread,
      })),
    );
    return;
  }

  if (action === 'enquiryThread' && req.method === 'GET') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const owned = (await sql`
      select e.id, e.status, e.enquiry_type, u.first_name, u.last_name, u.email
      from enquiries e join users u on u.id = e.user_id
      where e.id = ${id} and e.course_id = ${courseId}
    `) as Array<{ id: string; status: string; enquiry_type: string; first_name: string; last_name: string; email: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Enquiry not found');
    await markThreadReadByAdmin(id);
    const e = owned[0];
    res.status(200).json({
      id: e.id,
      status: e.status,
      enquiryType: e.enquiry_type,
      memberName: `${e.first_name} ${e.last_name}`,
      memberEmail: e.email,
      messages: await listEnquiryMessages(id),
    });
    return;
  }

  if (action === 'enquiryReply') {
    const { enquiryId, message } = req.body as { enquiryId?: string; message?: string };
    const body = message?.trim();
    if (!enquiryId || !body) throw new HttpError(400, 'enquiryId and message are required');

    const owned = (await sql`
      select e.id, e.user_id from enquiries e where e.id = ${enquiryId} and e.course_id = ${courseId}
    `) as Array<{ id: string; user_id: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Enquiry not found');

    await addAdminMessage(enquiryId, authed.id, body);

    const course = await fetchCourse(courseId);
    const notifBody = `${course.name} replied: ${body}`;
    await sql`
      insert into notifications (user_id, title, body, enquiry_id)
      values (${owned[0].user_id}, 'Reply to your enquiry', ${notifBody}, ${enquiryId})
    `;
    await sendPushToUser(owned[0].user_id, { title: 'Reply to your enquiry', body: notifBody });

    res.status(200).json(await listEnquiryMessages(enquiryId));
    return;
  }

  if (action === 'enquiryStatus') {
    const { enquiryId, status } = req.body as { enquiryId?: string; status?: EnquiryStatus };
    if (!enquiryId || !status || !ENQUIRY_STATUSES.includes(status)) {
      throw new HttpError(400, 'enquiryId and a valid status are required');
    }
    await sql`
      update enquiries set status = ${status}, updated_at = now()
      where id = ${enquiryId} and course_id = ${courseId}
    `;
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'courseProfile') {
    const body = req.body as CourseProfileBody;
    const name = body.name?.trim();
    if (!name) throw new HttpError(400, 'name is required');
    const contactEmail = body.contactEmail?.trim() || null;
    if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
      throw new HttpError(400, 'Enter a valid contact email address');
    }
    const contactPhone = body.contactPhone?.trim() || null;
    const address = body.address?.trim() || null;

    // Flagrr Cash per Rand is deliberately not editable here — changing it
    // reprices every existing reward variant, so it now requires the
    // Flagrr team's direct involvement (via the Support Centre, since the
    // course_admin can now message them directly instead of a one-shot
    // "request a change" email with no reply capability).
    await sql`
      update courses
      set name = ${name}, contact_email = ${contactEmail}, contact_phone = ${contactPhone}, address = ${address}
      where id = ${courseId}
    `;

    res.status(200).json(await fetchCourse(courseId));
    return;
  }

  // Member roster — used to validate a new signup is actually a member of
  // this club (see api/auth/signup.ts). A member who never matches stays
  // fully usable but capped at Bronze tier (see api/_lib/tiers.ts).
  if (action === 'memberRosterStatus' && req.method === 'GET') {
    res.status(200).json(await getRosterStatus(courseId));
    return;
  }

  if (action === 'memberRosterUpload') {
    const { fileName, fileBase64 } = req.body as MemberRosterUploadBody;
    if (!fileName || !fileBase64 || fileBase64.length > MAX_ROSTER_FILE_BASE64_LENGTH) {
      throw new HttpError(400, 'A member list file (CSV or Excel) is required and must be under 3MB');
    }
    let parsedRows;
    try {
      parsedRows = await parseMemberRosterFile(fileName, fileBase64);
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Could not parse the member list file');
    }
    res.status(200).json(await replaceMemberRoster(courseId, parsedRows));
    return;
  }

  if (action === 'courseLogo') {
    const imageBase64 = (req.body as LogoBody).imageBase64;
    if (!imageBase64 || !DATA_URI_PATTERN.test(imageBase64)) {
      throw new HttpError(400, 'imageBase64 must be a jpeg/png/webp data URI');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpError(400, 'Image is too large');
    }
    await sql`update courses set logo_url = ${imageBase64} where id = ${courseId}`;
    res.status(200).json({ logoUrl: imageBase64 });
    return;
  }

  if (action === 'courseCover') {
    const imageBase64 = (req.body as LogoBody).imageBase64;
    if (!imageBase64 || !DATA_URI_PATTERN.test(imageBase64)) {
      throw new HttpError(400, 'imageBase64 must be a jpeg/png/webp data URI');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpError(400, 'Image is too large');
    }
    await sql`update courses set cover_image_url = ${imageBase64} where id = ${courseId}`;
    res.status(200).json({ coverImageUrl: imageBase64 });
    return;
  }

  if (action === 'completeOnboarding') {
    await sql`update courses set onboarding_completed_at = now() where id = ${courseId}`;
    res.status(200).json(await fetchCourse(courseId));
    return;
  }

  if (action === 'completeStaffOnboarding') {
    await sql`update courses set staff_onboarding_completed_at = now() where id = ${courseId}`;
    res.status(200).json(await fetchCourse(courseId));
    return;
  }

  // course_admin-only (not in STAFF_ALLOWED_ACTIONS) — lets a course_admin
  // add exactly one more admin for their own club themselves, without any
  // further management ability (no reset/revoke/delete — that stays
  // super_admin-only, see superAdminCourseAdmin* actions above).
  if (action === 'courseAdmins' && req.method === 'GET') {
    const rows = (await sql`
      select id, first_name, last_name, email
      from admins where course_id = ${courseId} and role = 'course_admin'
      order by created_at asc
    `) as Array<{ id: string; first_name: string; last_name: string; email: string }>;
    res.status(200).json(
      rows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email })),
    );
    return;
  }

  if (action === 'courseAdminInvite') {
    const body = req.body as CourseAdminInviteBody;
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim() || '';
    const email = body.email?.trim().toLowerCase();
    if (!firstName || !email) throw new HttpError(400, 'First name and email are required');
    if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter a valid email address');

    const existingCount = (await sql`
      select count(*)::int as count from admins where course_id = ${courseId} and role = 'course_admin'
    `) as Array<{ count: number }>;
    if (existingCount[0].count >= MAX_COURSE_ADMINS_PER_CLUB) {
      throw new HttpError(400, `Your club already has the maximum of ${MAX_COURSE_ADMINS_PER_CLUB} admins`);
    }

    const course = await fetchCourse(courseId);
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    let created: Array<{ id: string; first_name: string; last_name: string; email: string }>;
    try {
      created = (await sql`
        insert into admins (course_id, role, first_name, last_name, email, password_hash, must_change_password, activated_at)
        values (${courseId}, 'course_admin', ${firstName}, ${lastName}, ${email}, ${passwordHash}, true, now())
        returning id, first_name, last_name, email
      `) as typeof created;
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new HttpError(409, 'An admin with that email already exists');
      throw err;
    }

    await sendEmail({
      to: email,
      subject: `You've been set up as a course admin for ${course.name} on Flagrr`,
      html: `
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>${escapeHtml(authed.firstName)} ${escapeHtml(authed.lastName)} has set you up as a course admin for ${escapeHtml(course.name)} on Flagrr.</p>
        <p><strong>Login link:</strong> <a href="https://flagrr-loyalty.vercel.app">https://flagrr-loyalty.vercel.app</a></p>
        <p><strong>Email:</strong> ${escapeHtml(email)}<br/>
        <strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
        <p>You'll be asked to choose your own password the first time you log in.</p>
      `,
    });

    res.status(200).json({
      id: created[0].id,
      firstName: created[0].first_name,
      lastName: created[0].last_name,
      email: created[0].email,
    });
    return;
  }

  if (action === 'staffList' && req.method === 'GET') {
    const rows = (await sql`
      select id, first_name, last_name, email, username, must_change_password, revoked_at, created_at
      from admins
      where course_id = ${courseId} and role = 'staff'
      order by created_at desc
    `) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      username: string;
      must_change_password: boolean;
      revoked_at: string | null;
      created_at: string;
    }>;
    res.status(200).json(rows.map(staffDto));
    return;
  }

  if (action === 'staffCreate') {
    const body = req.body as StaffCreateBody;
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim() || '';
    const email = body.email?.trim().toLowerCase();
    if (!firstName || !email) throw new HttpError(400, 'First name and email are required');
    if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter a valid email address');

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const course = await fetchCourse(courseId);

    const created = await insertStaffWithUniqueUsername({
      courseId,
      courseSlug: course.slug,
      firstName,
      lastName,
      email,
      passwordHash,
    });

    // Deliberately emails the *username*, not the email address, as the
    // login credential — the recipient inbox may be shared by several
    // staff members, so the email itself can't double as an identifier.
    await sendEmail({
      to: email,
      subject: `You've been added as staff at ${course.name} on Flagrr`,
      html: `
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>${escapeHtml(authed.firstName)} ${escapeHtml(authed.lastName)} has set you up with staff access to the Flagrr app for ${escapeHtml(course.name)}, so you can validate members' reward vouchers.</p>
        <p><strong>Login link:</strong> <a href="https://flagrr-loyalty.vercel.app">https://flagrr-loyalty.vercel.app</a></p>
        <p><strong>Username:</strong> ${escapeHtml(created[0].username)}<br/>
        <strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
        <p>You'll be asked to choose your own password the first time you log in.</p>
      `,
    });

    res.status(200).json(staffDto(created[0]));
    return;
  }

  if (action === 'staffUpdate') {
    const body = req.body as StaffUpdateBody;
    const id = body.id;
    if (!id) throw new HttpError(400, 'id is required');
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim() || '';
    const email = body.email?.trim().toLowerCase();
    if (!firstName || !email) throw new HttpError(400, 'First name and email are required');
    if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter a valid email address');

    const owned = await sql`select id from admins where id = ${id} and course_id = ${courseId} and role = 'staff'`;
    if ((owned as Array<{ id: string }>).length === 0) throw new HttpError(404, 'Staff member not found');

    const newPassword = body.password?.trim();
    if (newPassword && newPassword.length < 8) {
      throw new HttpError(400, 'New password must be at least 8 characters');
    }

    // Email is no longer unique across staff, so there's nothing left here
    // that can violate a uniqueness constraint (username is fixed at
    // creation and never edited) — no duplicate-key handling needed.
    let updated: Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      username: string;
      must_change_password: boolean;
      revoked_at: string | null;
      created_at: string;
    }>;
    if (newPassword) {
      const passwordHash = await hashPassword(newPassword);
      updated = (await sql`
        update admins
        set first_name = ${firstName}, last_name = ${lastName}, email = ${email},
            password_hash = ${passwordHash}, must_change_password = false
        where id = ${id}
        returning id, first_name, last_name, email, username, must_change_password, revoked_at, created_at
      `) as typeof updated;
    } else {
      updated = (await sql`
        update admins
        set first_name = ${firstName}, last_name = ${lastName}, email = ${email}
        where id = ${id}
        returning id, first_name, last_name, email, username, must_change_password, revoked_at, created_at
      `) as typeof updated;
    }

    res.status(200).json(staffDto(updated[0]));
    return;
  }

  if (action === 'staffRevoke') {
    const id = (req.body as StaffIdBody).id;
    if (!id) throw new HttpError(400, 'id is required');
    await sql`update admins set revoked_at = now() where id = ${id} and course_id = ${courseId} and role = 'staff'`;
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'staffReactivate') {
    const id = (req.body as StaffIdBody).id;
    if (!id) throw new HttpError(400, 'id is required');
    await sql`update admins set revoked_at = null where id = ${id} and course_id = ${courseId} and role = 'staff'`;
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'staffDelete') {
    const id = (req.body as StaffIdBody).id;
    if (!id) throw new HttpError(400, 'id is required');
    await sql`delete from admins where id = ${id} and course_id = ${courseId} and role = 'staff'`;
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'rewards' && req.method === 'GET') {
    res.status(200).json(await listRewardsForCourse(courseId));
    return;
  }

  if (action === 'rewardSave') {
    res.status(200).json(await saveRewardForCourse(courseId, req.body as RewardSaveBody));
    return;
  }

  if (action === 'rewardDelete') {
    const id = (req.body as RewardDeleteBody).id;
    if (!id) throw new HttpError(400, 'id is required');
    await deleteRewardForCourse(courseId, id);
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'ads' && req.method === 'GET') {
    res.status(200).json(await listAdsForCourse(courseId));
    return;
  }

  if (action === 'adSave') {
    res.status(200).json(await saveAdForCourse(courseId, req.body as AdSaveBody));
    return;
  }

  if (action === 'adDelete') {
    const id = (req.body as AdDeleteBody).id;
    if (!id) throw new HttpError(400, 'id is required');
    await deleteAdForCourse(courseId, id);
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'members' && req.method === 'GET') {
    const search = typeof req.query.search === 'string' ? `%${req.query.search.trim()}%` : '%';
    const rows = (await sql`
      select u.id, u.first_name, u.last_name, u.email, u.tier, u.member_since, p.balance
      from users u
      join points_accounts p on p.user_id = u.id
      where u.course_id = ${courseId}
        and (u.first_name || ' ' || u.last_name ilike ${search} or u.email ilike ${search})
      order by u.first_name, u.last_name
      limit 100
    `) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      tier: string;
      member_since: string;
      balance: number;
    }>;
    res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        tier: r.tier,
        memberSince: r.member_since,
        balance: r.balance,
      })),
    );
    return;
  }

  if (action === 'membersList' && req.method === 'GET') {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '10'), 10) || 10));
    const offset = (page - 1) * pageSize;

    const [rows, countRows] = await Promise.all([
      sql`
        select u.id, u.first_name, u.last_name, u.email, u.tier, u.member_since, p.balance
        from users u
        join points_accounts p on p.user_id = u.id
        where u.course_id = ${courseId}
        order by u.first_name, u.last_name
        limit ${pageSize} offset ${offset}
      `,
      sql`select count(*)::int as total from users where course_id = ${courseId}`,
    ]);

    res.status(200).json({
      members: (rows as Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        tier: string;
        member_since: string;
        balance: number;
      }>).map((r) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        tier: r.tier,
        memberSince: r.member_since,
        balance: r.balance,
      })),
      total: (countRows as Array<{ total: number }>)[0].total,
      page,
      pageSize,
    });
    return;
  }

  if (action === 'memberStats' && req.method === 'GET') {
    const memberId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!memberId) throw new HttpError(400, 'id is required');
    const period: StatsPeriod = isStatsPeriod(req.query.period) ? req.query.period : 'month';
    const { currentStart, previousStart, previousEnd, hasComparison } = periodWindow(period);

    const memberRows = (await sql`
      select u.id, u.first_name, u.last_name, u.email, u.tier, u.member_since, p.balance, p.total_earned, p.total_redeemed
      from users u
      join points_accounts p on p.user_id = u.id
      where u.id = ${memberId} and u.course_id = ${courseId}
    `) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      tier: string;
      member_since: string;
      balance: number;
      total_earned: number;
      total_redeemed: number;
    }>;
    if (memberRows.length === 0) throw new HttpError(404, 'Member not found');
    const m = memberRows[0];

    const [bucksRows, roundsRows, receiptRows, monthlyRows] = await Promise.all([
      sql`
        select
          coalesce(sum(amount) filter (where type = 'earn' and date >= ${currentStart}), 0)::int as earned_current,
          coalesce(sum(amount) filter (where type = 'earn' and date >= ${previousStart} and date < ${previousEnd}), 0)::int as earned_previous,
          coalesce(sum(-amount) filter (where type = 'redeem' and date >= ${currentStart}), 0)::int as redeemed_current,
          coalesce(sum(-amount) filter (where type = 'redeem' and date >= ${previousStart} and date < ${previousEnd}), 0)::int as redeemed_previous
        from activity where user_id = ${memberId}
      `,
      sql`
        select
          coalesce(sum(ri.quantity) filter (where ga.name = '9 Hole Round' and r.submitted_at >= ${currentStart}), 0)::int as r9_current,
          coalesce(sum(ri.quantity) filter (where ga.name = '9 Hole Round' and r.submitted_at >= ${previousStart} and r.submitted_at < ${previousEnd}), 0)::int as r9_previous,
          coalesce(sum(ri.quantity) filter (where ga.name = '18 Hole Round' and r.submitted_at >= ${currentStart}), 0)::int as r18_current,
          coalesce(sum(ri.quantity) filter (where ga.name = '18 Hole Round' and r.submitted_at >= ${previousStart} and r.submitted_at < ${previousEnd}), 0)::int as r18_previous
        from receipts r
        join receipt_items ri on ri.receipt_id = r.id
        join golf_activities ga on ga.id = ri.matched_activity_id
        where r.user_id = ${memberId}
      `,
      sql`
        select
          count(*) filter (where submitted_at >= ${currentStart})::int as current,
          count(*) filter (where submitted_at >= ${previousStart} and submitted_at < ${previousEnd})::int as previous
        from receipts where user_id = ${memberId}
      `,
      sql`select month, value from monthly_points where user_id = ${memberId} and year = extract(year from now())::int`,
    ]);

    const bucks = (bucksRows as Array<{
      earned_current: number;
      earned_previous: number;
      redeemed_current: number;
      redeemed_previous: number;
    }>)[0];
    const rounds = (roundsRows as Array<{
      r9_current: number;
      r9_previous: number;
      r18_current: number;
      r18_previous: number;
    }>)[0];
    const receipts = (receiptRows as Array<{ current: number; previous: number }>)[0];

    res.status(200).json({
      member: {
        id: m.id,
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        tier: m.tier,
        memberSince: m.member_since,
        balance: m.balance,
        totalEarned: m.total_earned,
        totalRedeemed: m.total_redeemed,
      },
      stats: {
        period,
        roundsPlayed9: rounds.r9_current,
        roundsPlayed9DeltaPct: deltaPct(rounds.r9_current, rounds.r9_previous, hasComparison),
        roundsPlayed18: rounds.r18_current,
        roundsPlayed18DeltaPct: deltaPct(rounds.r18_current, rounds.r18_previous, hasComparison),
        bucksEarned: bucks.earned_current,
        bucksEarnedDeltaPct: deltaPct(bucks.earned_current, bucks.earned_previous, hasComparison),
        bucksRedeemed: bucks.redeemed_current,
        bucksRedeemedDeltaPct: deltaPct(bucks.redeemed_current, bucks.redeemed_previous, hasComparison),
        receiptsScanned: receipts.current,
        receiptsScannedDeltaPct: deltaPct(receipts.current, receipts.previous, hasComparison),
        monthly: fillMonthlyByNumber(monthlyRows as Array<{ month: number; value: number }>),
      },
    });
    return;
  }

  if (action === 'broadcasts' && req.method === 'GET') {
    const rows = (await sql`
      select id, title, body, target, recipient_count, sent_at
      from admin_broadcasts
      where course_id = ${courseId}
      order by sent_at desc
      limit 100
    `) as Array<{
      id: string;
      title: string;
      body: string;
      target: string;
      recipient_count: number;
      sent_at: string;
    }>;
    res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        target: r.target,
        recipientCount: r.recipient_count,
        sentAt: r.sent_at,
      })),
    );
    return;
  }

  if (action === 'broadcastSend') {
    const body = req.body as BroadcastSendBody;
    const title = body.title?.trim();
    const message = body.body?.trim();
    const target = body.target?.trim();
    if (!title) throw new HttpError(400, 'title is required');
    if (!message) throw new HttpError(400, 'body is required');
    if (!target || !BROADCAST_TARGETS.includes(target)) throw new HttpError(400, 'a valid target is required');

    const recipients = (await sql`
      select id from users
      where course_id = ${courseId}
        ${target !== 'all' ? sql`and tier = ${target}` : sql``}
    `) as Array<{ id: string }>;

    if (recipients.length > 0) {
      await sql`
        insert into notifications (user_id, title, body)
        select id, ${title}, ${message} from users
        where course_id = ${courseId}
          ${target !== 'all' ? sql`and tier = ${target}` : sql``}
      `;
      await Promise.allSettled(recipients.map((r) => sendPushToUser(r.id, { title, body: message })));
    }

    const inserted = (await sql`
      insert into admin_broadcasts (course_id, admin_id, title, body, target, recipient_count)
      values (${courseId}, ${authed.id}, ${title}, ${message}, ${target}, ${recipients.length})
      returning id, title, body, target, recipient_count, sent_at
    `) as Array<{
      id: string;
      title: string;
      body: string;
      target: string;
      recipient_count: number;
      sent_at: string;
    }>;
    const b = inserted[0];
    res.status(200).json({
      id: b.id,
      title: b.title,
      body: b.body,
      target: b.target,
      recipientCount: b.recipient_count,
      sentAt: b.sent_at,
    });
    return;
  }

  if (action === 'broadcastDelete') {
    const id = (req.body as BroadcastDeleteBody).id;
    if (!id) throw new HttpError(400, 'id is required');
    await sql`delete from admin_broadcasts where id = ${id} and course_id = ${courseId}`;
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'voucherLookup' && req.method === 'GET') {
    const code = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';
    if (!code) throw new HttpError(400, 'code is required');
    const rows = await lookupVoucher(code, courseId);
    if (rows.length === 0) throw new HttpError(404, 'No voucher found with that code for your club');
    res.status(200).json(rows[0]);
    return;
  }

  if (action === 'voucherRedeem') {
    const code = (req.body as VoucherRedeemBody).code?.trim().toUpperCase();
    if (!code) throw new HttpError(400, 'code is required');
    const rows = await lookupVoucher(code, courseId);
    if (rows.length === 0) throw new HttpError(404, 'No voucher found with that code for your club');
    const voucher = rows[0];
    if (voucher.status === 'redeemed') throw new HttpError(409, 'This voucher has already been redeemed');
    if (voucher.status === 'expired' || new Date(voucher.expiresAt) < new Date()) {
      throw new HttpError(409, 'This voucher has expired');
    }
    await sql`
      update vouchers set status = 'redeemed', redeemed_at = now(), redeemed_by_admin_id = ${authed.id}
      where id = ${voucher.id}
    `;

    const displayName = voucher.variantLabel === 'Standard' ? voucher.rewardTitle : `${voucher.rewardTitle} (${voucher.variantLabel})`;
    const notificationBody = `Your ${displayName} voucher has been validated and redeemed at the club. Enjoy!`;
    await sql`
      insert into notifications (user_id, title, body)
      values (${voucher.userId}, 'Reward validated', ${notificationBody})
    `;
    await sendPushToUser(voucher.userId, { title: 'Reward validated', body: notificationBody });

    res.status(200).json({ ...voucher, status: 'redeemed' });
    return;
  }

  if (action === 'exportCsv' && req.method === 'GET') {
    const report = typeof req.query.report === 'string' ? req.query.report : '';
    const period: StatsPeriod = isStatsPeriod(req.query.period) ? req.query.period : 'month';
    const { currentStart } = periodWindow(period);
    let csv: string;
    let filename: string;

    if (report === 'redemptions') {
      const rows = (await sql`
        select v.code, u.first_name, u.last_name, u.email, r.title, v.variant_label, v.cost, v.status, v.issued_at, v.redeemed_at
        from vouchers v
        join rewards r on r.id = v.reward_id
        join users u on u.id = v.user_id
        where r.course_id = ${courseId} and v.issued_at >= ${currentStart}
        order by v.issued_at desc
      `) as Array<{
        code: string;
        first_name: string;
        last_name: string;
        email: string;
        title: string;
        variant_label: string;
        cost: number;
        status: string;
        issued_at: string;
        redeemed_at: string | null;
      }>;
      csv = toCsv(
        ['Code', 'Member', 'Email', 'Reward', 'Variant', 'Flagrr Cash', 'Status', 'Issued At', 'Redeemed At'],
        rows.map((r) => [r.code, `${r.first_name} ${r.last_name}`, r.email, r.title, r.variant_label, r.cost, r.status, r.issued_at, r.redeemed_at]),
      );
      filename = `redemptions-${period}.csv`;
    } else if (report === 'receipts') {
      const rows = (await sql`
        select r.receipt_number, u.first_name, u.last_name, u.email, r.course_name, r.total, r.points_awarded, r.status, r.submitted_at
        from receipts r
        join users u on u.id = r.user_id
        where r.course_id = ${courseId} and r.submitted_at >= ${currentStart}
        order by r.submitted_at desc
      `) as Array<{
        receipt_number: string | null;
        first_name: string;
        last_name: string;
        email: string;
        course_name: string;
        total: number;
        points_awarded: number | null;
        status: string;
        submitted_at: string;
      }>;
      csv = toCsv(
        ['Receipt #', 'Member', 'Email', 'Where Scanned', 'Total (R)', 'Flagrr Cash Awarded', 'Status', 'Submitted At'],
        rows.map((r) => [r.receipt_number, `${r.first_name} ${r.last_name}`, r.email, r.course_name, r.total, r.points_awarded, r.status, r.submitted_at]),
      );
      filename = `receipts-${period}.csv`;
    } else if (report === 'members') {
      const rows = (await sql`
        select u.first_name, u.last_name, u.email, u.tier, u.member_since, p.balance, p.total_earned, p.total_redeemed
        from users u join points_accounts p on p.user_id = u.id
        where u.course_id = ${courseId}
        order by u.member_since desc
      `) as Array<{
        first_name: string;
        last_name: string;
        email: string;
        tier: string;
        member_since: string;
        balance: number;
        total_earned: number;
        total_redeemed: number;
      }>;
      csv = toCsv(
        ['First Name', 'Last Name', 'Email', 'Tier', 'Member Since', 'FC Balance', 'FC Total Earned', 'FC Total Redeemed'],
        rows.map((r) => [r.first_name, r.last_name, r.email, r.tier, r.member_since, r.balance, r.total_earned, r.total_redeemed]),
      );
      filename = 'members.csv';
    } else if (report === 'memberActivity') {
      const memberId = typeof req.query.userId === 'string' ? req.query.userId : '';
      if (!memberId) throw new HttpError(400, 'userId is required');
      const owned = await sql`select id from users where id = ${memberId} and course_id = ${courseId}`;
      if ((owned as Array<{ id: string }>).length === 0) throw new HttpError(404, 'Member not found');
      const rows = (await sql`
        select date, type, title, subtitle, amount
        from activity where user_id = ${memberId}
        order by date desc
      `) as Array<{ date: string; type: string; title: string; subtitle: string; amount: number }>;
      csv = toCsv(
        ['Date', 'Type', 'Title', 'Details', 'Flagrr Cash'],
        rows.map((r) => [r.date, r.type, r.title, r.subtitle, r.amount]),
      );
      filename = `member-activity-${memberId}.csv`;
    } else {
      throw new HttpError(400, 'Unknown report');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
    return;
  }

  res.status(404).json({ error: 'Unknown admin action' });
});

async function lookupVoucher(code: string, courseId: string) {
  const rows = (await sql`
    select v.id, v.user_id, v.code, v.variant_label, v.cost, v.status, v.issued_at, v.expires_at,
           r.title as reward_title, u.first_name, u.last_name, u.email
    from vouchers v
    join rewards r on r.id = v.reward_id
    join users u on u.id = v.user_id
    where v.code = ${code} and r.course_id = ${courseId}
  `) as Array<{
    id: string;
    user_id: string;
    code: string;
    variant_label: string;
    cost: number;
    status: string;
    issued_at: string;
    expires_at: string;
    reward_title: string;
    first_name: string;
    last_name: string;
    email: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    code: r.code,
    variantLabel: r.variant_label,
    cost: r.cost,
    status: r.status,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    rewardTitle: r.reward_title,
    memberName: `${r.first_name} ${r.last_name}`,
    memberEmail: r.email,
  }));
}
