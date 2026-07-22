import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { sendEmail } from '../_lib/email';
import { logAdClick } from '../_lib/ads';

// Folded avatar update, profile field editing, the contact form's send, and
// ad-click logging into one file (dispatched by ?action=) to stay within
// Vercel Hobby's 12-serverless-function cap — same pattern as
// POST /api/receipts?action=scan.

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authed = await requireAuthedUser(req);
  const action = req.query.action;

  if (action === 'contact') {
    const body = req.body as ContactBody;
    const message = body.message?.trim();
    if (!message) {
      throw new HttpError(400, 'message is required');
    }
    const fullName = [body.name?.trim(), body.surname?.trim()].filter(Boolean).join(' ') || authed.firstName;
    const replyEmail = body.email?.trim() || authed.email;

    await sendEmail({
      to: CONTACT_EMAIL,
      subject: `Flaggr enquiry (${body.enquiryType || 'General'}) from ${fullName}`,
      html: `
        <p><strong>From:</strong> ${escapeHtml(fullName)} (${escapeHtml(replyEmail)})</p>
        <p><strong>Phone:</strong> ${escapeHtml(body.phone?.trim() || '—')}</p>
        <p><strong>Enquiry type:</strong> ${escapeHtml(body.enquiryType || 'General')}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
      `,
    });

    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'adClick') {
    const adId = (req.body as AdClickBody).adId;
    if (!adId) {
      throw new HttpError(400, 'adId is required');
    }
    await logAdClick(adId, authed.id);
    res.status(200).json({ ok: true });
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
