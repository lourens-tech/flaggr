import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';

interface MarkReadBody {
  id?: string;
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authed = await requireAuthedUser(req);
  const id = (req.body as MarkReadBody).id;
  if (!id) {
    throw new HttpError(400, 'id is required');
  }

  await sql`
    update notifications set read = true
    where id = ${id} and user_id = ${authed.id}
  `;

  res.status(200).json({ ok: true });
});
