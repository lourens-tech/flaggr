import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedCourseAdmin, hashPassword, verifyPassword } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { deltaPct, isStatsPeriod, periodWindow, type StatsPeriod } from '../_lib/periods';
import { fillMonthlyByNumber } from '../_lib/monthly';
import { getDashboardReport } from '../_lib/adminReports';
import { toCsv } from '../_lib/csv';
import {
  addAdminMessage,
  ENQUIRY_STATUSES,
  listEnquiryMessages,
  markThreadReadByAdmin,
  type EnquiryStatus,
} from '../_lib/enquiries';
import { sendPushToUser } from '../_lib/pushNotifications';
import { sendEmail } from '../_lib/email';

// Every action for the course-admin side of the app lives in this one file,
// dispatched by ?action= (same pattern as api/profile/index.ts and
// api/receipts/index.ts), to stay within Vercel Hobby's 12-serverless-
// function cap. Every query below is scoped to the calling admin's own
// course_id — a course_admin can never read or write another club's data,
// even by guessing another club's reward/ad/voucher id.

const DATA_URI_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,/;
const MAX_IMAGE_BASE64_LENGTH = 2_000_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'lourens@ewosolutions.com';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface LoginBody {
  email?: string;
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

const REWARD_CATEGORIES = ['rounds', 'experiences', 'pro-shop', 'practice', 'dining'];
const AD_PLACEMENTS = ['home', 'rewards_shop'];
const BROADCAST_TARGETS = ['all', 'Bronze', 'Silver', 'Gold', 'Platinum'];

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
  };
}

async function fetchCourse(courseId: string) {
  const rows = (await sql`
    select id, name, slug, logo_url, cover_image_url, contact_email, contact_phone, address, fb_per_rand
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
  }>;
  if (rows.length === 0) throw new HttpError(404, 'Course not found');
  return courseDto(rows[0]);
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const action = req.query.action;

  // --- Unauthenticated actions ---
  if (action === 'login') {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const { email, password } = req.body as LoginBody;
    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required');
    }

    const rows = (await sql`
      select id, course_id, role, first_name, last_name, email, password_hash, activated_at
      from admins where email = ${email.trim().toLowerCase()}
    `) as Array<{
      id: string;
      course_id: string | null;
      role: 'super_admin' | 'course_admin';
      first_name: string;
      last_name: string;
      email: string;
      password_hash: string | null;
      activated_at: string | null;
    }>;

    const admin = rows[0];
    if (!admin || !admin.password_hash || !admin.activated_at) {
      throw new HttpError(401, 'Invalid email or password');
    }
    if (!(await verifyPassword(password, admin.password_hash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    if (admin.role !== 'course_admin' || !admin.course_id) {
      throw new HttpError(403, 'This account type is not supported yet');
    }

    const sessionRows = (await sql`
      insert into admin_sessions (admin_id) values (${admin.id}) returning token
    `) as Array<{ token: string }>;

    const course = await fetchCourse(admin.course_id);
    res.status(200).json({
      token: sessionRows[0].token,
      admin: {
        id: admin.id,
        firstName: admin.first_name,
        lastName: admin.last_name,
        email: admin.email,
        role: admin.role,
      },
      course,
    });
    return;
  }

  // --- Everything below requires a logged-in course_admin ---
  const authed = await requireAuthedCourseAdmin(req);
  const courseId = authed.courseId;

  if (action === 'logout') {
    const header = req.headers.authorization;
    const token = header?.slice('Bearer '.length).trim();
    if (token) {
      await sql`delete from admin_sessions where token = ${token}`;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'me' && req.method === 'GET') {
    const course = await fetchCourse(courseId);
    res.status(200).json({
      admin: { id: authed.id, firstName: authed.firstName, lastName: authed.lastName, email: authed.email, role: authed.role },
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

  if (action === 'changePassword') {
    const { currentPassword, newPassword } = req.body as ChangePasswordBody;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw new HttpError(400, 'Current password and a new password (min. 8 characters) are required');
    }
    const rows = (await sql`select password_hash from admins where id = ${authed.id}`) as Array<{ password_hash: string | null }>;
    if (!rows[0]?.password_hash || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
      throw new HttpError(401, 'Current password is incorrect');
    }
    const newHash = await hashPassword(newPassword);
    await sql`update admins set password_hash = ${newHash} where id = ${authed.id}`;
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
    // Flagrr team's direct involvement (see the contactSupport action).
    await sql`
      update courses
      set name = ${name}, contact_email = ${contactEmail}, contact_phone = ${contactPhone}, address = ${address}
      where id = ${courseId}
    `;

    res.status(200).json(await fetchCourse(courseId));
    return;
  }

  if (action === 'contactSupport') {
    const course = await fetchCourse(courseId);
    await sendEmail({
      to: CONTACT_EMAIL,
      subject: `Flagrr Cash rate change request — ${course.name}`,
      html: `
        <p><strong>Course:</strong> ${escapeHtml(course.name)}</p>
        <p><strong>Requested by:</strong> ${escapeHtml(authed.firstName)} ${escapeHtml(authed.lastName)} (${escapeHtml(authed.email)})</p>
        <p><strong>Current Flagrr Cash per Rand:</strong> ${course.fbPerRand}</p>
        <p>This course admin would like to change their Flagrr Cash per Rand denomination and needs the Flagrr team's assistance.</p>
      `,
    });
    res.status(200).json({ ok: true });
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

  if (action === 'rewards' && req.method === 'GET') {
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
    res.status(200).json(Array.from(byId.values()));
    return;
  }

  if (action === 'rewardSave') {
    const body = req.body as RewardSaveBody;
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

    res.status(200).json({ id: rewardId });
    return;
  }

  if (action === 'rewardDelete') {
    const id = (req.body as RewardDeleteBody).id;
    if (!id) throw new HttpError(400, 'id is required');
    // Soft-delete: rewards/variants are referenced by past vouchers with no
    // cascade, so hard-deleting would either fail or orphan redemption
    // history. Deactivating hides it from the Rewards Shop instead.
    await sql`update rewards set active = false where id = ${id} and course_id = ${courseId}`;
    await sql`
      update reward_variants set active = false
      where reward_id in (select id from rewards where id = ${id} and course_id = ${courseId})
    `;
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'ads' && req.method === 'GET') {
    const rows = (await sql`
      select a.id, a.placement, a.title, a.image_url, a.target_url, a.sort_order, a.active,
             a.starts_at, a.ends_at, count(c.id)::int as clicks
      from ads a
      left join ad_clicks c on c.ad_id = a.id
      where a.course_id = ${courseId}
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
    res.status(200).json(
      rows.map((r) => ({
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
      })),
    );
    return;
  }

  if (action === 'adSave') {
    const body = req.body as AdSaveBody;
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
      const owned = (await sql`select id from ads where id = ${body.id} and course_id = ${courseId}`) as Array<{ id: string }>;
      if (owned.length === 0) throw new HttpError(404, 'Ad not found');
      await sql`
        update ads
        set title = ${title}, placement = ${placement}, target_url = ${targetUrl}, sort_order = ${sortOrder},
            active = ${active}, starts_at = ${startsAt}, ends_at = ${endsAt}, updated_at = now()
            ${body.imageBase64 ? sql`, image_url = ${body.imageBase64}` : sql``}
        where id = ${body.id}
      `;
      res.status(200).json({ id: body.id });
    } else {
      const inserted = (await sql`
        insert into ads (course_id, placement, title, image_url, target_url, sort_order, active, starts_at, ends_at)
        values (${courseId}, ${placement}, ${title}, ${body.imageBase64 ?? null}, ${targetUrl}, ${sortOrder}, ${active}, ${startsAt}, ${endsAt})
        returning id
      `) as Array<{ id: string }>;
      res.status(200).json({ id: inserted[0].id });
    }
    return;
  }

  if (action === 'adDelete') {
    const id = (req.body as AdDeleteBody).id;
    if (!id) throw new HttpError(400, 'id is required');
    await sql`delete from ads where id = ${id} and course_id = ${courseId}`;
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
