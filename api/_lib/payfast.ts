import crypto from 'crypto';

// Sandbox by default so nothing accidentally goes live without an explicit
// opt-in once real merchant credentials exist.
const PAYFAST_MODE = process.env.PAYFAST_MODE === 'live' ? 'live' : 'sandbox';
const PAYFAST_HOST = PAYFAST_MODE === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';

export const PAYFAST_PROCESS_URL = `https://${PAYFAST_HOST}/eng/process`;
const PAYFAST_VALIDATE_URL = `https://${PAYFAST_HOST}/eng/query/validate`;

// Sandbox defaults from Payfast's own docs — safe to fall back to while
// developing, replaced by real values once the merchant account exists.
export const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '10000100';
export const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a';
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';

// Published Payfast ITN sender ranges (developers.payfast.co.za, "IP
// Addresses" section) — checked as defense-in-depth alongside the signature
// and the /eng/query/validate server-to-server confirmation, never alone.
const PAYFAST_IP_RANGES: Array<[string, number]> = [
  ['197.97.145.144', 28],
  ['41.74.179.192', 27],
  ['102.216.36.0', 28],
  ['102.216.36.128', 28],
];

function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const v = Number(part);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

export function isPayfastSourceIp(ip: string): boolean {
  const target = ipToInt(ip);
  if (target === null) return false;
  return PAYFAST_IP_RANGES.some(([base, bits]) => {
    const baseInt = ipToInt(base);
    if (baseInt === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (target & mask) === (baseInt & mask);
  });
}

/** Payfast's signature rule: url-encode each field's value (spaces as '+'),
 * join as key=value pairs in the order the fields were set, append the
 * passphrase if one is configured (required for Subscriptions), then MD5 the
 * whole string. Applies identically to building a checkout request and to
 * verifying an incoming ITN. */
export function payfastSignature(fields: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}`);
  }
  let paramString = parts.join('&');
  if (PAYFAST_PASSPHRASE) {
    paramString += `&passphrase=${encodeURIComponent(PAYFAST_PASSPHRASE).replace(/%20/g, '+')}`;
  }
  return crypto.createHash('md5').update(paramString).digest('hex');
}

/** Server-to-server confirmation that an ITN's payload actually came from
 * Payfast, beyond just the signature match — posts the exact received body
 * back to Payfast and expects the literal response "VALID". */
export async function confirmItnWithPayfast(rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(PAYFAST_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    return text === 'VALID';
  } catch {
    return false;
  }
}

export interface SubscriptionCheckoutParams {
  mPaymentId: string;
  amount: number;
  itemName: string;
  itemDescription: string;
  nameFirst: string;
  nameLast: string;
  emailAddress: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

/** Builds the field set (in the exact order the signature must be generated
 * over) for a monthly, indefinite (cycles=0) Payfast Subscription checkout. */
export function buildSubscriptionCheckoutFields(params: SubscriptionCheckoutParams): Record<string, string> {
  const amount = params.amount.toFixed(2);
  const fields: Record<string, string> = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    name_first: params.nameFirst,
    name_last: params.nameLast,
    email_address: params.emailAddress,
    m_payment_id: params.mPaymentId,
    amount,
    item_name: params.itemName,
    item_description: params.itemDescription,
    subscription_type: '1',
    recurring_amount: amount,
    frequency: '3', // Monthly
    cycles: '0', // Indefinite — runs until cancelled
  };
  return { ...fields, signature: payfastSignature(fields) };
}
