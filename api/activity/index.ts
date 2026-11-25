import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { withErrorHandling } from '../_lib/http';
import { activityHasReceiptId } from '../_lib/activityReceiptLink';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authed = await requireAuthedUser(req);

  // receipt_id (migration 052) is returned when the column exists, else null.
  const linkReceipt = await activityHasReceiptId();
  const rows = (await sql`
    select id, type, title, subtitle, amount, voucher_id,
      ${linkReceipt ? sql`receipt_id` : sql`null::uuid as receipt_id`}, date
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
    voucher_id: string | null;
    receipt_id: string | null;
    date: string;
  }>;

  res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      subtitle: r.subtitle,
      amount: r.amount,
      voucherId: r.voucher_id,
      receiptId: r.receipt_id,
      date: r.date,
    })),
  );
});
