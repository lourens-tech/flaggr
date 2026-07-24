import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
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
