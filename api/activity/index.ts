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
    select id, type, title, subtitle, amount, date
    from activity
    where user_id = ${authed.id}
    order by date desc
    limit 100
  `) as Array<{
    id: string;
    type: string;
    title: string;
    subtitle: string;
    amount: number;
    date: string;
  }>;

  res.status(200).json(rows);
});
