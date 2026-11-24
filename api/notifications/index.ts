import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { hasColumn } from '../_lib/schemaColumns';

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

  // support_ticket_id (migration 053) is returned when the column exists, else null.
  const ticketLink = await hasColumn('notifications', 'support_ticket_id', '053_notification_support_ticket.sql');
  const rows = (await sql`
    select id, title, body, date, read, enquiry_id,
      ${ticketLink ? sql`support_ticket_id` : sql`null::uuid as support_ticket_id`}
    from notifications
    where user_id = ${authed.id}
    order by date desc
  `) as Array<{ id: string; title: string; body: string; date: string; read: boolean; enquiry_id: string | null; support_ticket_id: string | null }>;

  res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      date: r.date,
      read: r.read,
      enquiryId: r.enquiry_id,
      supportTicketId: r.support_ticket_id,
    })),
  );
});
