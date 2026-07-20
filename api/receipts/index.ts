import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';

interface ReceiptLineItem {
  label: string;
  amount: number;
}

interface SubmitReceiptBody {
  imageUri?: string | null;
  courseName?: string;
  items?: ReceiptLineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  pointsAwarded?: number;
}

interface ReceiptRow {
  id: string;
  image_uri: string | null;
  status: string;
  course_name: string;
  items: ReceiptLineItem[];
  subtotal: string;
  tax: string;
  total: string;
  submitted_at: string;
  points_awarded: number | null;
}

function serializeReceipt(r: ReceiptRow) {
  return {
    id: r.id,
    imageUri: r.image_uri,
    status: r.status,
    courseName: r.course_name,
    items: r.items,
    subtotal: Number(r.subtotal),
    tax: Number(r.tax),
    total: Number(r.total),
    submittedAt: r.submitted_at,
    pointsAwarded: r.points_awarded,
  };
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const authed = await requireAuthedUser(req);

  if (req.method === 'GET') {
    const rows = (await sql`
      select id, image_uri, status, course_name, items, subtotal, tax, total, submitted_at, points_awarded
      from receipts
      where user_id = ${authed.id}
      order by submitted_at desc
    `) as ReceiptRow[];

    res.status(200).json(rows.map(serializeReceipt));
    return;
  }

  if (req.method === 'POST') {
    const body = req.body as SubmitReceiptBody;
    const pointsAwarded = body.pointsAwarded ?? 0;
    if (!Number.isFinite(pointsAwarded) || pointsAwarded < 0) {
      throw new HttpError(400, 'pointsAwarded must be a non-negative number');
    }
    const courseName = body.courseName ?? '';

    const results = (await sql.transaction([
      sql`
        insert into receipts (user_id, course_id, course_name, image_uri, status, items, subtotal, tax, total, points_awarded)
        values (
          ${authed.id}, ${authed.courseId}, ${courseName}, ${body.imageUri ?? null}, 'approved',
          ${JSON.stringify(body.items ?? [])}::jsonb,
          ${body.subtotal ?? 0}, ${body.tax ?? 0}, ${body.total ?? 0}, ${pointsAwarded}
        )
        returning id, image_uri, status, course_name, items, subtotal, tax, total, submitted_at, points_awarded
      `,
      sql`
        update points_accounts
        set balance = balance + ${pointsAwarded}, total_earned = total_earned + ${pointsAwarded}
        where user_id = ${authed.id}
      `,
      sql`
        insert into activity (user_id, type, title, subtitle, amount)
        values (${authed.id}, 'earn', 'Receipt scanned', ${courseName}, ${pointsAwarded})
      `,
    ])) as [ReceiptRow[], unknown, unknown];

    res.status(201).json(serializeReceipt(results[0][0]));
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
});
