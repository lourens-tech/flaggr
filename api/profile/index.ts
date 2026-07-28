import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { hashPassword, requireAuthedUser, verifyPassword } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { sendEmail } from '../_lib/email';
import { logAdClick } from '../_lib/ads';
import { registerPushToken, type PushPlatform } from '../_lib/pushNotifications';
import { notifyCourseAdmins } from '../_lib/adminNotifications';
import { addMemberMessage, createEnquiry, listEnquiryMessages, markThreadReadByMember } from '../_lib/enquiries';
import {
  addRequesterMessage,
  createSupportTicket,
  listSupportTicketMessages,
  markThreadReadByRequester,
} from '../_lib/supportTickets';

// Folded avatar update, profile field editing, the contact form's send,
// ad-click logging, and push-token registration into one file (dispatched
// by ?action=) to stay within Vercel Hobby's 12-serverless-function cap —
// same pattern as POST /api/receipts?action=scan.

const DATA_URI_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,/;
const MAX_AVATAR_BASE64_LENGTH = 2_000_000; // ~1.5MB decoded, comfortably above a 480px-wide JPEG
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Resend's shared test domain only delivers to the account owner's own
// verified address until a custom sending domain is verified — see email.ts.
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'lourens@ewosolutions.com';

interface UpdateAvatarBody {
  imageBase64?: string;
}

interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
}

interface ContactBody {
  name?: string;
  surname?: string;
  phone?: string;
  email?: string;
  enquiryType?: string;
  message?: string;
}

interface AdClickBody {
  adId?: string;
}

interface ChangeClubBody {
  courseId?: string;
}

interface RegisterPushTokenBody {
  token?: string;
  platform?: PushPlatform;
}

interface EnquiryReplyBody {
  enquiryId?: string;
  message?: string;
}

interface SupportTicketCreateBody {
  subject?: string;
  message?: string;
}

interface SupportTicketReplyBody {
  ticketId?: string;
  message?: string;
}

interface ThemePreferenceBody {
  preference?: string;
}

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

interface DeleteAccountBody {
  password?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const authed = await requireAuthedUser(req);
  const action = req.query.action;

  if (action === 'myEnquiries' && req.method === 'GET') {
    const rows = (await sql`
      select e.id, e.enquiry_type, e.status, e.created_at, e.updated_at,
             (select body from enquiry_messages m where m.enquiry_id = e.id order by m.created_at desc limit 1) as last_message,
             exists(select 1 from enquiry_messages m where m.enquiry_id = e.id and m.read_by_member = false) as has_unread
      from enquiries e
      where e.user_id = ${authed.id}
      order by e.updated_at desc
    `) as Array<{
      id: string;
      enquiry_type: string;
      status: string;
      created_at: string;
      updated_at: string;
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
        lastMessage: r.last_message,
        hasUnread: r.has_unread,
      })),
    );
    return;
  }

  if (action === 'enquiryThread' && req.method === 'GET') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const owned = (await sql`
      select id, status, enquiry_type from enquiries where id = ${id} and user_id = ${authed.id}
    `) as Array<{ id: string; status: string; enquiry_type: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Enquiry not found');
    await markThreadReadByMember(id);
    res.status(200).json({
      id: owned[0].id,
      status: owned[0].status,
      enquiryType: owned[0].enquiry_type,
      messages: await listEnquiryMessages(id),
    });
    return;
  }

  if (action === 'supportTickets' && req.method === 'GET') {
    const rows = (await sql`
      select t.id, t.subject, t.status, t.created_at, t.updated_at,
             (select body from support_ticket_messages m where m.ticket_id = t.id order by m.created_at desc limit 1) as last_message,
             exists(select 1 from support_ticket_messages m where m.ticket_id = t.id and m.read_by_requester = false) as has_unread
      from support_tickets t
      where t.requester_user_id = ${authed.id}
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
      select id, status, subject from support_tickets where id = ${id} and requester_user_id = ${authed.id}
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

  // A member's own copy of everything Flagrr holds on them — profile,
  // points/streak/stats, receipts, activity, vouchers, notifications, and
  // every enquiry/support-ticket thread (with messages). Delivered as a
  // JSON file download, not embedded in the app UI, since this is a
  // one-off request rather than something browsed. Receipt/avatar photos
  // are left out (already viewable individually in-app) to keep this from
  // ballooning into a multi-megabyte response.
  if (action === 'exportMyData' && req.method === 'GET') {
    const [profileRows, pointsRows, streakRows, statsRows, receiptRows, activityRows, voucherRows, notificationRows, enquiryRows, ticketRows] =
      await Promise.all([
        sql`
          select first_name, last_name, email, phone, date_of_birth, tier, member_since, verified_member
          from users where id = ${authed.id}
        `,
        sql`select balance, total_earned, total_redeemed from points_accounts where user_id = ${authed.id}`,
        sql`select weeks, active_since from streaks where user_id = ${authed.id}`,
        sql`select total_receipts_scanned, last_scan_date from user_stats where user_id = ${authed.id}`,
        sql`
          select id, course_name, status, items, subtotal, tax, total, submitted_at, points_awarded,
                 receipt_number, transaction_number, till_number, receipt_time, flagged, flag_reason
          from receipts where user_id = ${authed.id} order by submitted_at desc
        `,
        sql`select type, title, subtitle, amount, date from activity where user_id = ${authed.id} order by date desc`,
        sql`
          select v.code, v.cost, v.status, v.issued_at, v.expires_at, v.redeemed_at, r.title as reward_title, v.variant_label
          from vouchers v join rewards r on r.id = v.reward_id
          where v.user_id = ${authed.id} order by v.issued_at desc
        `,
        sql`select title, body, date, read from notifications where user_id = ${authed.id} order by date desc`,
        sql`
          select e.id, e.enquiry_type, e.status, e.created_at, e.updated_at,
            (select jsonb_agg(jsonb_build_object('senderType', m.sender_type, 'body', m.body, 'createdAt', m.created_at) order by m.created_at)
             from enquiry_messages m where m.enquiry_id = e.id) as messages
          from enquiries e where e.user_id = ${authed.id} order by e.created_at desc
        `,
        sql`
          select t.id, t.subject, t.status, t.created_at, t.updated_at,
            (select jsonb_agg(jsonb_build_object('senderType', m.sender_type, 'body', m.body, 'createdAt', m.created_at) order by m.created_at)
             from support_ticket_messages m where m.ticket_id = t.id) as messages
          from support_tickets t where t.requester_user_id = ${authed.id} order by t.created_at desc
        `,
      ]);

    const u = profileRows[0] as {
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      date_of_birth: string | null;
      tier: string;
      member_since: string;
      verified_member: boolean;
    };
    const p = pointsRows[0] as { balance: number; total_earned: number; total_redeemed: number } | undefined;
    const s = streakRows[0] as { weeks: number; active_since: string } | undefined;
    const stats = statsRows[0] as { total_receipts_scanned: number; last_scan_date: string | null } | undefined;

    const exportData = {
      generatedAt: new Date().toISOString(),
      profile: {
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        phone: u.phone,
        dateOfBirth: u.date_of_birth,
        tier: u.tier,
        memberSince: u.member_since,
        verifiedMember: u.verified_member,
      },
      points: p ? { balance: p.balance, totalEarned: p.total_earned, totalRedeemed: p.total_redeemed } : null,
      streak: s ? { weeks: s.weeks, activeSince: s.active_since } : null,
      stats: stats ? { totalReceiptsScanned: stats.total_receipts_scanned, lastScanDate: stats.last_scan_date } : null,
      receipts: (receiptRows as Array<Record<string, unknown>>).map((r) => ({
        id: r.id,
        courseName: r.course_name,
        status: r.status,
        items: r.items,
        subtotal: Number(r.subtotal),
        tax: Number(r.tax),
        total: Number(r.total),
        submittedAt: r.submitted_at,
        pointsAwarded: r.points_awarded,
        receiptNumber: r.receipt_number,
        transactionNumber: r.transaction_number,
        tillNumber: r.till_number,
        receiptTime: r.receipt_time,
        flagged: r.flagged,
        flagReason: r.flag_reason,
      })),
      activity: (activityRows as Array<Record<string, unknown>>).map((a) => ({
        type: a.type,
        title: a.title,
        subtitle: a.subtitle,
        amount: a.amount,
        date: a.date,
      })),
      vouchers: (voucherRows as Array<Record<string, unknown>>).map((v) => ({
        code: v.code,
        rewardTitle: v.reward_title,
        variantLabel: v.variant_label,
        cost: v.cost,
        status: v.status,
        issuedAt: v.issued_at,
        expiresAt: v.expires_at,
        redeemedAt: v.redeemed_at,
      })),
      notifications: (notificationRows as Array<Record<string, unknown>>).map((n) => ({
        title: n.title,
        body: n.body,
        date: n.date,
        read: n.read,
      })),
      enquiries: (enquiryRows as Array<Record<string, unknown>>).map((e) => ({
        subject: e.enquiry_type,
        status: e.status,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        messages: e.messages ?? [],
      })),
      supportTickets: (ticketRows as Array<Record<string, unknown>>).map((t) => ({
        subject: t.subject,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        messages: t.messages ?? [],
      })),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="flagrr-my-data.json"');
    res.status(200).send(JSON.stringify(exportData, null, 2));
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (action === 'contact') {
    const body = req.body as ContactBody;
    const message = body.message?.trim();
    if (!message) {
      throw new HttpError(400, 'message is required');
    }
    const fullName = [body.name?.trim(), body.surname?.trim()].filter(Boolean).join(' ') || authed.firstName;
    const replyEmail = body.email?.trim() || authed.email;
    const enquiryType = body.enquiryType || 'General';

    await sendEmail({
      to: CONTACT_EMAIL,
      subject: `Flaggr enquiry (${enquiryType}) from ${fullName}`,
      html: `
        <p><strong>From:</strong> ${escapeHtml(fullName)} (${escapeHtml(replyEmail)})</p>
        <p><strong>Phone:</strong> ${escapeHtml(body.phone?.trim() || '—')}</p>
        <p><strong>Enquiry type:</strong> ${escapeHtml(enquiryType)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
      `,
    });

    // Also opens a real two-way thread with that member's own club's
    // admin — not just a one-shot email to the central Flagrr inbox.
    const enquiryId = await createEnquiry(authed.courseId, authed.id, enquiryType, message);
    await notifyCourseAdmins(authed.courseId, `New enquiry from ${fullName}`, `(${enquiryType}) ${message}`, { enquiryId });

    res.status(200).json({ ok: true, enquiryId });
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
      requesterType: 'member',
      requesterUserId: authed.id,
      requesterAdminId: null,
      requesterName,
      requesterEmail: authed.email,
      courseId: authed.courseId,
      subject: trimmedSubject,
      message: trimmedMessage,
    });
    await sendEmail({
      to: CONTACT_EMAIL,
      subject: `New support ticket: ${trimmedSubject}`,
      html: `
        <p><strong>From:</strong> ${escapeHtml(requesterName)} (${escapeHtml(authed.email)}) — member</p>
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
    if (!ticketId || !body) {
      throw new HttpError(400, 'ticketId and message are required');
    }
    const owned = (await sql`
      select id from support_tickets where id = ${ticketId} and requester_user_id = ${authed.id}
    `) as Array<{ id: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Ticket not found');

    await addRequesterMessage(ticketId, body);
    res.status(200).json(await listSupportTicketMessages(ticketId));
    return;
  }

  if (action === 'enquiryReply') {
    const { enquiryId, message } = req.body as EnquiryReplyBody;
    const body = message?.trim();
    if (!enquiryId || !body) {
      throw new HttpError(400, 'enquiryId and message are required');
    }
    const owned = (await sql`
      select id from enquiries where id = ${enquiryId} and user_id = ${authed.id}
    `) as Array<{ id: string }>;
    if (owned.length === 0) throw new HttpError(404, 'Enquiry not found');

    await addMemberMessage(enquiryId, body);
    await notifyCourseAdmins(authed.courseId, `${authed.firstName} ${authed.lastName} replied to an enquiry`, body, {
      enquiryId,
    });

    res.status(200).json(await listEnquiryMessages(enquiryId));
    return;
  }

  if (action === 'adClick') {
    const adId = (req.body as AdClickBody).adId;
    if (!adId) {
      throw new HttpError(400, 'adId is required');
    }
    await logAdClick(adId, authed.id, authed.courseId);
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'registerPushToken') {
    const { token, platform } = req.body as RegisterPushTokenBody;
    if (!token || (platform !== 'ios' && platform !== 'android')) {
      throw new HttpError(400, 'token and a valid platform are required');
    }
    await registerPushToken(authed.id, token, platform);
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'changePassword') {
    const { currentPassword, newPassword } = req.body as ChangePasswordBody;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw new HttpError(400, 'Current password and a new password (min. 8 characters) are required');
    }
    const rows = (await sql`select password_hash from users where id = ${authed.id}`) as Array<{ password_hash: string }>;
    if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
      throw new HttpError(401, 'Current password is incorrect');
    }
    const newHash = await hashPassword(newPassword);
    await sql`update users set password_hash = ${newHash} where id = ${authed.id}`;
    res.status(200).json({ ok: true });
    return;
  }

  // Permanent, self-service account deletion — requires the current
  // password (same verify-then-act shape as changePassword) since this
  // can't be undone. Every table with member data (receipts, points,
  // activity, vouchers, enquiries, support tickets, sessions, etc.) already
  // references users(id) on delete cascade, so a single delete here is
  // enough for the database to clean up everything; the deleted session's
  // own token stops authenticating on the very next request.
  if (action === 'deleteAccount') {
    const { password } = req.body as DeleteAccountBody;
    if (!password) {
      throw new HttpError(400, 'Current password is required');
    }
    const rows = (await sql`select password_hash from users where id = ${authed.id}`) as Array<{ password_hash: string }>;
    if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
      throw new HttpError(401, 'Current password is incorrect');
    }
    await sql`delete from users where id = ${authed.id}`;
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'themePreference') {
    const preference = (req.body as ThemePreferenceBody).preference;
    if (preference !== 'system' && preference !== 'light' && preference !== 'dark') {
      throw new HttpError(400, 'preference must be system, light, or dark');
    }
    await sql`update users set theme_preference = ${preference} where id = ${authed.id}`;
    res.status(200).json({ themePreference: preference });
    return;
  }

  if (action === 'changeClub') {
    const courseId = (req.body as ChangeClubBody).courseId;
    if (!courseId) {
      throw new HttpError(400, 'courseId is required');
    }

    const courseRows = (await sql`select id, name from courses where id = ${courseId}`) as Array<{
      id: string;
      name: string;
    }>;
    if (courseRows.length === 0) {
      throw new HttpError(400, 'Unknown course');
    }

    await sql`update users set course_id = ${courseId} where id = ${authed.id}`;
    res.status(200).json({ courseId: courseRows[0].id, homeClub: courseRows[0].name });
    return;
  }

  if (action === 'update') {
    const body = req.body as UpdateProfileBody;
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim() ?? '';
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim() || null;
    const dateOfBirth = body.dateOfBirth?.trim() || null;

    if (!firstName || !email) {
      throw new HttpError(400, 'firstName and email are required');
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new HttpError(400, 'Enter a valid email address');
    }

    let rows: Array<{
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      date_of_birth: string | null;
    }>;
    try {
      rows = (await sql`
        update users
        set first_name = ${firstName}, last_name = ${lastName}, email = ${email}, phone = ${phone}, date_of_birth = ${dateOfBirth}
        where id = ${authed.id}
        returning first_name, last_name, email, phone, date_of_birth
      `) as typeof rows;
    } catch (err) {
      if (err instanceof Error && /unique/i.test(err.message)) {
        throw new HttpError(409, 'An account with this email already exists');
      }
      throw err;
    }

    const u = rows[0];
    res.status(200).json({
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      phone: u.phone,
      dateOfBirth: u.date_of_birth,
    });
    return;
  }

  const body = req.body as UpdateAvatarBody;
  const imageBase64 = body.imageBase64;
  if (!imageBase64 || !DATA_URI_PATTERN.test(imageBase64)) {
    throw new HttpError(400, 'imageBase64 must be a jpeg/png/webp data URI');
  }
  if (imageBase64.length > MAX_AVATAR_BASE64_LENGTH) {
    throw new HttpError(400, 'Image is too large');
  }
  await sql`update users set avatar_url = ${imageBase64} where id = ${authed.id}`;
  res.status(200).json({ avatarUrl: imageBase64 });
});
