import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { withErrorHandling, HttpError } from '../_lib/http';
import { hashPassword } from '../_lib/auth';
import { sendEmail } from '../_lib/email';
import {
  buildSubscriptionCheckoutFields,
  confirmItnWithPayfast,
  isPayfastSourceIp,
  payfastSignature,
  PAYFAST_MERCHANT_ID,
  PAYFAST_PROCESS_URL,
} from '../_lib/payfast';

const APP_URL = process.env.APP_URL || 'https://flagrr-loyalty.vercel.app';
const MONTHLY_SUBSCRIPTION_AMOUNT = 7199.0;

// Grace period on a missed/late renewal: club keeps working while we chase
// it, three reminder emails at these day offsets, full lockout at day 30 —
// per direction, no free trial, straight to 'active' on the first payment.
const GRACE_PERIOD_DAYS = 30;
const REMINDER_DAY_OFFSETS = [0, 14, 25];
// Payfast doesn't push a distinct "payment failed" ITN for a recurring
// charge — only the eventual COMPLETE or CANCELLED outcome of its own
// internal retries. We detect "went overdue" ourselves by comparing
// next_billing_date to today, with a few days of slack for processing time
// before we start our own grace-period clock.
const OVERDUE_GRACE_BUFFER_DAYS = 3;

function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && /duplicate key value/i.test(err.message);
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
}

function slugifyCourseName(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'club';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const MAX_SLUG_ATTEMPTS = 20;

/** Creates the course + its course_admin from a completed signup, mirroring
 * the super_admin-driven creation flow in api/admin/index.ts (same temp
 * password + forced-change-on-first-login pattern) — just triggered by a
 * Payfast ITN instead of an authenticated super_admin action. */
async function provisionCourseFromSignup(signup: {
  course_name: string;
  contact_email: string;
  contact_phone: string | null;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
}): Promise<{ courseId: string }> {
  const base = slugifyCourseName(signup.course_name);
  let course: { id: string } | null = null;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      const rows = (await sql`
        insert into courses (name, slug, contact_email, contact_phone)
        values (${signup.course_name}, ${slug}, ${signup.contact_email}, ${signup.contact_phone})
        returning id
      `) as Array<{ id: string }>;
      course = rows[0];
      break;
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < MAX_SLUG_ATTEMPTS - 1) continue;
      throw err;
    }
  }
  if (!course) throw new HttpError(500, 'Could not generate a unique course slug — try again');

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  try {
    await sql`
      insert into admins (course_id, role, first_name, last_name, email, password_hash, must_change_password, activated_at)
      values (${course.id}, 'course_admin', ${signup.admin_first_name}, ${signup.admin_last_name}, ${signup.admin_email}, ${passwordHash}, true, now())
    `;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new HttpError(409, 'An admin with that email already exists');
    throw err;
  }

  await sendEmail({
    to: signup.admin_email,
    subject: `Welcome to Flagrr — ${signup.course_name} is set up`,
    html: `
      <p>Hi ${escapeHtml(signup.admin_first_name)},</p>
      <p>Thanks for subscribing! ${escapeHtml(signup.course_name)} is now set up on Flagrr.</p>
      <p><strong>Login link:</strong> <a href="${APP_URL}">${APP_URL}</a></p>
      <p><strong>Email:</strong> ${escapeHtml(signup.admin_email)}<br/>
      <strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
      <p>You'll be asked to choose your own password the first time you log in, and a setup wizard will walk you through the rest of your club's profile.</p>
    `,
  });

  return { courseId: course.id };
}

async function sendPastDueReminderEmail(course: { id: string; name: string }, dayOffset: number) {
  const rows = (await sql`select email, first_name from admins where course_id = ${course.id} and role = 'course_admin' and revoked_at is null`) as Array<{
    email: string;
    first_name: string;
  }>;
  const daysLeft = GRACE_PERIOD_DAYS - dayOffset;
  for (const admin of rows) {
    await sendEmail({
      to: admin.email,
      subject: `Action needed: ${course.name}'s Flagrr subscription payment failed`,
      html: `
        <p>Hi ${escapeHtml(admin.first_name)},</p>
        <p>We couldn't process this month's Flagrr subscription payment for ${escapeHtml(course.name)}. Please update your payment details with Payfast as soon as possible.</p>
        <p>Your club's account will be suspended in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> if payment isn't received.</p>
      `,
    });
  }
}

async function initiateSignup(req: VercelRequest, res: VercelResponse) {
  const body = req.body as {
    courseName?: string;
    contactEmail?: string;
    contactPhone?: string;
    adminFirstName?: string;
    adminLastName?: string;
    adminEmail?: string;
    returnUrl?: string;
    cancelUrl?: string;
  };
  const courseName = body.courseName?.trim();
  const contactEmail = body.contactEmail?.trim().toLowerCase();
  const adminFirstName = body.adminFirstName?.trim();
  const adminLastName = body.adminLastName?.trim();
  const adminEmail = body.adminEmail?.trim().toLowerCase();
  const returnUrl = body.returnUrl?.trim();
  const cancelUrl = body.cancelUrl?.trim();

  if (!courseName || !contactEmail || !adminFirstName || !adminLastName || !adminEmail || !returnUrl || !cancelUrl) {
    throw new HttpError(400, 'courseName, contactEmail, adminFirstName, adminLastName, adminEmail, returnUrl, and cancelUrl are required');
  }
  if (!returnUrl.startsWith('https://') || !cancelUrl.startsWith('https://')) {
    throw new HttpError(400, 'returnUrl and cancelUrl must be https URLs');
  }

  const mPaymentId = crypto.randomUUID();
  await sql`
    insert into pending_club_signups (m_payment_id, course_name, contact_email, contact_phone, admin_first_name, admin_last_name, admin_email, amount)
    values (${mPaymentId}, ${courseName}, ${contactEmail}, ${body.contactPhone?.trim() || null}, ${adminFirstName}, ${adminLastName}, ${adminEmail}, ${MONTHLY_SUBSCRIPTION_AMOUNT})
  `;

  const fields = buildSubscriptionCheckoutFields({
    mPaymentId,
    amount: MONTHLY_SUBSCRIPTION_AMOUNT,
    itemName: 'Flagrr Monthly Subscription',
    itemDescription: `${courseName} — Flagrr loyalty platform, billed monthly`,
    nameFirst: adminFirstName,
    nameLast: adminLastName,
    emailAddress: adminEmail,
    returnUrl,
    cancelUrl,
    notifyUrl: `${APP_URL}/api/courses?action=payfastNotify`,
  });

  res.status(200).json({ actionUrl: PAYFAST_PROCESS_URL, fields });
}

async function payfastNotify(req: VercelRequest, res: VercelResponse) {
  // Payfast expects a fast, plain 200 regardless of outcome — it does not
  // read or act on the response body, but retries on non-2xx.
  const body = (req.body ?? {}) as Record<string, string>;
  const { signature, ...fields } = body;

  const forwardedFor = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  const sourceIp = forwardedFor.split(',')[0]?.trim() ?? '';

  const validSignature = typeof signature === 'string' && signature.toLowerCase() === payfastSignature(fields);
  const validSourceIp = isPayfastSourceIp(sourceIp);
  const rawBody = new URLSearchParams(body as Record<string, string>).toString();
  const validWithPayfast = await confirmItnWithPayfast(rawBody);

  if (!validSignature || !validSourceIp || !validWithPayfast || fields.merchant_id !== PAYFAST_MERCHANT_ID) {
    console.error('Rejected Payfast ITN', { validSignature, validSourceIp, validWithPayfast, sourceIp, merchantId: fields.merchant_id });
    res.status(400).send('invalid');
    return;
  }

  const paymentStatus = fields.payment_status;
  const token = fields.token || null;
  const billingDate = fields.billing_date || null;
  const mPaymentId = fields.m_payment_id || null;

  if (paymentStatus === 'COMPLETE') {
    const pending = mPaymentId
      ? ((await sql`select * from pending_club_signups where m_payment_id = ${mPaymentId} and status = 'pending'`) as Array<{
          course_name: string;
          contact_email: string;
          contact_phone: string | null;
          admin_first_name: string;
          admin_last_name: string;
          admin_email: string;
        }>)
      : [];

    if (pending.length > 0) {
      // First payment for a brand-new club signup.
      const { courseId } = await provisionCourseFromSignup(pending[0]);
      await sql`
        update courses set payfast_token = ${token}, next_billing_date = ${billingDate}, subscription_status = 'active',
          past_due_since = null, past_due_reminders_sent = 0
        where id = ${courseId}
      `;
      await sql`update pending_club_signups set status = 'completed', completed_at = now() where m_payment_id = ${mPaymentId}`;
    } else if (token) {
      // A recurring renewal for an existing subscription.
      await sql`
        update courses set next_billing_date = ${billingDate}, subscription_status = 'active',
          past_due_since = null, past_due_reminders_sent = 0
        where payfast_token = ${token}
      `;
    }
  } else if (paymentStatus === 'CANCELLED' && token) {
    // Payfast's own retries were exhausted, or the subscription was cancelled
    // directly on their dashboard — no point running our own grace period
    // for a subscription that no longer exists on their side.
    await sql`update courses set subscription_status = 'canceled' where payfast_token = ${token}`;
  }

  res.status(200).send('OK');
}

async function payfastGracePeriodCheck(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new HttpError(401, 'Unauthorized');
  }

  const overdue = (await sql`
    select id, name from courses
    where subscription_status = 'active' and next_billing_date is not null
      and next_billing_date < (current_date - ${OVERDUE_GRACE_BUFFER_DAYS})
  `) as Array<{ id: string; name: string }>;
  for (const course of overdue) {
    await sql`update courses set subscription_status = 'past_due', past_due_since = now(), past_due_reminders_sent = 1 where id = ${course.id}`;
    await sendPastDueReminderEmail(course, 0);
  }

  const pastDue = (await sql`
    select id, name, past_due_since, past_due_reminders_sent from courses where subscription_status = 'past_due'
  `) as Array<{ id: string; name: string; past_due_since: string; past_due_reminders_sent: number }>;
  for (const course of pastDue) {
    const daysOverdue = Math.floor((Date.now() - new Date(course.past_due_since).getTime()) / (24 * 60 * 60 * 1000));
    if (daysOverdue >= GRACE_PERIOD_DAYS) {
      await sql`update courses set subscription_status = 'canceled' where id = ${course.id}`;
      continue;
    }
    const nextReminderIndex = course.past_due_reminders_sent;
    if (nextReminderIndex < REMINDER_DAY_OFFSETS.length && daysOverdue >= REMINDER_DAY_OFFSETS[nextReminderIndex]) {
      await sql`update courses set past_due_reminders_sent = ${nextReminderIndex + 1} where id = ${course.id}`;
      await sendPastDueReminderEmail(course, REMINDER_DAY_OFFSETS[nextReminderIndex]);
    }
  }

  res.status(200).json({ ok: true, flaggedOverdue: overdue.length, checked: pastDue.length });
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const action = req.query.action;

  if (action === 'initiateSignup') {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    await initiateSignup(req, res);
    return;
  }
  if (action === 'payfastNotify') {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    await payfastNotify(req, res);
    return;
  }
  if (action === 'payfastGracePeriodCheck') {
    await payfastGracePeriodCheck(req, res);
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const rows = (await sql`
    select id, name, slug, logo_url from courses order by name
  `) as Array<{ id: string; name: string; slug: string; logo_url: string | null }>;

  res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      logoUrl: r.logo_url,
    })),
  );
});
