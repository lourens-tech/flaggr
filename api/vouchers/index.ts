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
    select id, reward_id, code, status, qr_value, issued_at, expires_at
    from vouchers
    where user_id = ${authed.id}
    order by issued_at desc
  `) as Array<{
    id: string;
    reward_id: string;
    code: string;
    status: string;
    qr_value: string;
    issued_at: string;
    expires_at: string;
  }>;

  res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      rewardId: r.reward_id,
      code: r.code,
      status: r.status,
      qrValue: r.qr_value,
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
    })),
  );
});
