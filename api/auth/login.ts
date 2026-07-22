import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { verifyPassword } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { getCurrentTierStatus } from '../_lib/tierRewards';

interface LoginBody {
  email?: string;
  password?: string;
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
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
           u.member_since, c.name as course_name
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
      tier: tierInfo.tier,
      memberSince: user.member_since,
    },
  });
});
