import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { hashPassword } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { computeQuarterlyTierInfo } from '../_lib/tiers';
import { sendEmail } from '../_lib/email';
import { renderWelcomeEmailHtml, renderWelcomeEmailSubject } from '../_lib/welcomeEmail';

const APP_URL = process.env.APP_URL || 'https://flagrr-loyalty.vercel.app';

interface SignupBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  courseId?: string;
  password?: string;
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as SignupBody;
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim() ?? '';
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim() || null;
  const dateOfBirth = body.dateOfBirth?.trim() || null;
  const courseId = body.courseId?.trim();
  const password = body.password;

  if (!firstName || !email || !courseId || !password) {
    throw new HttpError(400, 'firstName, email, courseId, and password are required');
  }
  if (password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  const courseRows = (await sql`select id, name from courses where id = ${courseId}`) as Array<{
    id: string;
    name: string;
  }>;
  if (courseRows.length === 0) {
    throw new HttpError(400, 'Unknown course');
  }
  const course = courseRows[0];

  const passwordHash = await hashPassword(password);

  let userRows: Array<{
    id: string;
    course_id: string;
    first_name: string;
    last_name: string;
    email: string;
    date_of_birth: string | null;
    member_since: string;
  }>;
  try {
    userRows = (await sql`
      insert into users (course_id, first_name, last_name, email, phone, date_of_birth, password_hash)
      values (${courseId}, ${firstName}, ${lastName}, ${email}, ${phone}, ${dateOfBirth}, ${passwordHash})
      returning id, course_id, first_name, last_name, email, date_of_birth, member_since
    `) as typeof userRows;
  } catch (err) {
    if (err instanceof Error && /unique/i.test(err.message)) {
      throw new HttpError(409, 'An account with this email already exists');
    }
    throw err;
  }

  const user = userRows[0];

  const sessionRows = (await sql.transaction([
    sql`insert into points_accounts (user_id) values (${user.id})`,
    sql`insert into streaks (user_id) values (${user.id})`,
    sql`insert into user_stats (user_id) values (${user.id})`,
    sql`insert into sessions (user_id) values (${user.id}) returning token`,
  ])) as [unknown, unknown, unknown, Array<{ token: string }>];

  const token = sessionRows[3][0].token;
  // Brand new account: no activity yet this quarter or last, so this is
  // always Bronze — no need to query.
  const tierInfo = computeQuarterlyTierInfo(0, 0);

  // Never let a slow/failed email provider block or fail account creation —
  // sendEmail already logs and swallows its own errors.
  await sendEmail({
    to: user.email,
    subject: renderWelcomeEmailSubject(user.first_name),
    html: renderWelcomeEmailHtml({ firstName: user.first_name, homeClub: course.name, appUrl: APP_URL }),
  });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone,
      dateOfBirth: user.date_of_birth,
      homeClub: course.name,
      courseId: user.course_id,
      tier: tierInfo.tier,
      memberSince: user.member_since,
    },
  });
});
