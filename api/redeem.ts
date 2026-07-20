import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_lib/db';
import { requireAuthedUser } from './_lib/auth';
import { HttpError, withErrorHandling } from './_lib/http';

interface RedeemBody {
  rewardId?: string;
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
  const rewardId = (req.body as RedeemBody).rewardId;
  if (!rewardId) {
    throw new HttpError(400, 'rewardId is required');
  }

  const rewardRows = (await sql`
    select id, title, cost from rewards
    where id = ${rewardId} and course_id = ${authed.courseId} and active = true
  `) as Array<{ id: string; title: string; cost: number }>;
  if (rewardRows.length === 0) {
    throw new HttpError(404, 'Reward not found');
  }
  const reward = rewardRows[0];

  const deducted = (await sql`
    update points_accounts
    set balance = balance - ${reward.cost}, total_redeemed = total_redeemed + ${reward.cost}
    where user_id = ${authed.id} and balance >= ${reward.cost}
    returning balance
  `) as Array<{ balance: number }>;

  if (deducted.length === 0) {
    throw new HttpError(400, 'Not enough Flagrr Bucks');
  }

  const code = generateVoucherCode();
  const results = (await sql.transaction([
    sql`
      insert into vouchers (user_id, reward_id, code, qr_value)
      values (${authed.id}, ${reward.id}, ${code}, ${`flagrr://voucher/${code}`})
      returning id, reward_id, code, status, qr_value, issued_at, expires_at
    `,
    sql`
      insert into activity (user_id, type, title, subtitle, amount)
      values (${authed.id}, 'redeem', ${`${reward.title} redeemed`}, 'Reward voucher', ${-reward.cost})
    `,
  ])) as [
    Array<{
      id: string;
      reward_id: string;
      code: string;
      status: string;
      qr_value: string;
      issued_at: string;
      expires_at: string;
    }>,
    unknown,
  ];

  const voucher = results[0][0];
  res.status(201).json({
    id: voucher.id,
    rewardId: voucher.reward_id,
    code: voucher.code,
    status: voucher.status,
    qrValue: voucher.qr_value,
    issuedAt: voucher.issued_at,
    expiresAt: voucher.expires_at,
    balance: deducted[0].balance,
  });
});
