import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';

interface MarkReadBody {
  id?: string;
}

// GET lists notifications; POST ?action=read marks one as read. Folded into
// one file (same ?action= dispatch pattern as api/profile/index.ts) to stay
// within Vercel Hobby's 12-serverless-function cap.
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const authed = await requireAuthedUser(req);

  if (req.method === 'POST' && req.query.action === 'read') {
    const id = (req.body as MarkReadBody).id;
    if (!id) {
      throw new HttpError(400, 'id is required');
    }
    await sql`
      update notifications set read = true
      where id = ${id} and user_id = ${authed.id}
    `;
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rows = (await sql`
    select id, title, body, date, read
    from notifications
    where user_id = ${authed.id}
    order by date desc
  `) as Array<{ id: string; title: string; body: string; date: string; read: boolean }>;

  res.status(200).json(rows);
});
