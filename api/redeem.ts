import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_lib/db';
import { requireAuthedUser } from './_lib/auth';
import { HttpError, withErrorHandling } from './_lib/http';
import { sendPushToUser } from './_lib/pushNotifications';

interface RedeemBody {
  rewardId?: string;
  variantId?: string;
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const part = () =>
    Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  return `FLGR-${part()}-${part()}`;
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authed = await requireAuthedUser(req);
  const { rewardId, variantId } = req.body as RedeemBody;
  if (!rewardId || !variantId) {
    throw new HttpError(400, 'rewardId and variantId are required');
  }

  const variantRows = (await sql`
    select r.id as reward_id, r.title, v.id as variant_id, v.label, v.cost
    from reward_variants v
    join rewards r on r.id = v.reward_id
    where v.id = ${variantId} and r.id = ${rewardId}
      and r.course_id = ${authed.courseId} and r.active = true and v.active = true
  `) as Array<{ reward_id: string; title: string; variant_id: string; label: string; cost: number }>;
  if (variantRows.length === 0) {
    throw new HttpError(404, 'Reward not found');
  }
  const { title, variant_id: rewardVariantId, label, cost } = variantRows[0];

  const deducted = (await sql`
    update points_accounts
    set balance = balance - ${cost}, total_redeemed = total_redeemed + ${cost}
    where user_id = ${authed.id} and balance >= ${cost}
    returning balance
  `) as Array<{ balance: number }>;

  if (deducted.length === 0) {
    throw new HttpError(400, 'Not enough Flagrr Cash');
  }

  const code = generateVoucherCode();
  const voucherId = crypto.randomUUID();
  const displayName = label === 'Standard' ? title : `${title} (${label})`;
  const notificationBody = `Your ${displayName} voucher is ready — show its QR code at the club to claim it.`;
  const results = (await sql.transaction([
    sql`
      insert into vouchers (id, user_id, reward_id, reward_variant_id, variant_label, cost, code, qr_value)
      values (${voucherId}, ${authed.id}, ${rewardId}, ${rewardVariantId}, ${label}, ${cost}, ${code}, ${`flagrr://voucher/${code}`})
      returning id, reward_id, variant_label, cost, code, status, qr_value, issued_at, expires_at
    `,
    sql`
      insert into activity (user_id, type, title, subtitle, amount, voucher_id)
      values (${authed.id}, 'redeem', ${`${displayName} redeemed`}, 'Reward voucher', ${-cost}, ${voucherId})
    `,
    sql`
      insert into notifications (user_id, title, body)
      values (${authed.id}, 'Reward redeemed', ${notificationBody})
    `,
  ])) as [
    Array<{
      id: string;
      reward_id: string;
      variant_label: string;
      cost: number;
      code: string;
      status: string;
      qr_value: string;
      issued_at: string;
      expires_at: string;
    }>,
    unknown,
    unknown,
  ];

  const voucher = results[0][0];
  await sendPushToUser(authed.id, { title: 'Reward redeemed', body: notificationBody });
  res.status(201).json({
    id: voucher.id,
    rewardId: voucher.reward_id,
    rewardTitle: title,
    variantLabel: voucher.variant_label,
    cost: voucher.cost,
    code: voucher.code,
    status: voucher.status,
    qrValue: voucher.qr_value,
    issuedAt: voucher.issued_at,
    expiresAt: voucher.expires_at,
    balance: deducted[0].balance,
  });
});
