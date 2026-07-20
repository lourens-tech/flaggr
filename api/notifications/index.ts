import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { withErrorHandling } from '../_lib/http';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authed = await requireAuthedUser(req);

  const rows = (await sql`
    select id, title, body, date, read
    from notifications
    where user_id = ${authed.id}
    order by date desc
  `) as Array<{ id: string; title: string; body: string; date: string; read: boolean }>;

  res.status(200).json(rows);
});
