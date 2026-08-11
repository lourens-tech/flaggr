import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { hashPassword, verifyPassword } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { getCurrentTierStatus } from '../_lib/tierRewards';
import { sendEmail } from '../_lib/email';
import { consumePasswordResetCode, issuePasswordResetCode } from '../_lib/passwordReset';
import { renderBrandedEmailHtml, emailParagraph } from '../_lib/emailTemplate';

interface LoginBody {
  email?: string;
  password?: string;
}

interface ForgotPasswordBody {
  email?: string;
}

interface ResetPasswordBody {
  email?: string;
  code?: string;
  newPassword?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // --- Self-service password reset — no session required. The response is
  // identical whether or not the email matches an account, so this can't be
  // used to discover which emails are registered. Folded into this file
  // (rather than new route files) to stay within Vercel Hobby's
  // 12-serverless-function cap. ---
  if (req.query.action === 'forgotPassword') {
    const email = (req.body as ForgotPasswordBody).email?.trim().toLowerCase();
    if (!email) throw new HttpError(400, 'email is required');

    const rows = (await sql`select id, first_name from users where email = ${email}`) as Array<{
      id: string;
      first_name: string;
    }>;
    if (rows.length > 0) {
      const code = await issuePasswordResetCode({ userId: rows[0].id });
      await sendEmail({
        to: email,
        subject: 'Your Flagrr password reset code',
        html: renderBrandedEmailHtml({
          eyebrow: 'Password reset',
          heading: `Hi ${rows[0].first_name}, here's your code`,
          bodyHtml: emailParagraph(`Use this code to reset your Flagrr password. It expires in 30 minutes.`),
          code,
          footerNote: `If you didn't request this, you can safely ignore this email — your password won't change unless this code is used.`,
        }),
      });
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (req.query.action === 'resetPassword') {
    const body = req.body as ResetPasswordBody;
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim();
    const newPassword = body.newPassword;
    if (!email || !code || !newPassword || newPassword.length < 8) {
      throw new HttpError(400, 'Email, code, and a new password (min. 8 characters) are required');
    }

    const rows = (await sql`select id from users where email = ${email}`) as Array<{ id: string }>;
    if (rows.length === 0 || !(await consumePasswordResetCode({ userId: rows[0].id }, code))) {
      throw new HttpError(400, 'That code is invalid or has expired');
    }

    const passwordHash = await hashPassword(newPassword);
    await sql`update users set password_hash = ${passwordHash} where id = ${rows[0].id}`;
    res.status(200).json({ ok: true });
    return;
  }

  const body = req.body as LoginBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    throw new HttpError(400, 'email and password are required');
  }

  const rows = (await sql`
    select u.id, u.first_name, u.last_name, u.email, u.phone, u.password_hash,
           u.member_since, u.course_id, u.verified_member, c.name as course_name
    from users u
    join courses c on c.id = u.course_id
    where u.email = ${email}
  `) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    password_hash: string;
    member_since: string;
    course_id: string;
    verified_member: boolean;
    course_name: string;
  }>;

  if (rows.length === 0) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const user = rows[0];
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const sessionRows = (await sql`
    insert into sessions (user_id) values (${user.id}) returning token
  `) as Array<{ token: string }>;

  const tierInfo = await getCurrentTierStatus(user.id);

  res.status(200).json({
    token: sessionRows[0].token,
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      homeClub: user.course_name,
      courseId: user.course_id,
      tier: tierInfo.tier,
      memberSince: user.member_since,
      verifiedMember: user.verified_member,
    },
  });
});
