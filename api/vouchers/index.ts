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
    select v.id, v.reward_id, r.title as reward_title, v.variant_label, v.cost,
           v.code, v.status, v.qr_value, v.issued_at, v.expires_at
    from vouchers v
    left join rewards r on r.id = v.reward_id
    where v.user_id = ${authed.id}
    order by v.issued_at desc
  `) as Array<{
    id: string;
    reward_id: string;
    reward_title: string | null;
    variant_label: string;
    cost: number;
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
      rewardTitle: r.reward_title ?? '',
      variantLabel: r.variant_label,
      cost: r.cost,
      code: r.code,
      status: r.status,
      qrValue: r.qr_value,
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
    })),
  );
});
