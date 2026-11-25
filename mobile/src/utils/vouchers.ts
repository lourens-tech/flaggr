import type { Voucher, VoucherStatus } from '../data/types';

// The status a member should see. The server only sets "expired" in some
// cases, so an active voucher past its expiry date also counts as expired.
// This matches the club side: staff redeem refuses a voucher past its date
// (api/admin redeem check on expiresAt). Owner decision, 25 Nov 2026.
export function voucherStatus(voucher: Pick<Voucher, 'status' | 'expiresAt'>, now: Date = new Date()): VoucherStatus {
  if (voucher.status !== 'active') return voucher.status;
  const expires = new Date(voucher.expiresAt);
  if (!Number.isNaN(expires.getTime()) && expires < now) return 'expired';
  return 'active';
}
