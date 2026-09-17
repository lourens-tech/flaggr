import crypto from 'node:crypto';
import { sql } from './db';
import { giftFlagrrCash } from './giftFlagrrCash';

export const MEMBER_REFERRAL_BONUS = 15;
export const COURSE_REFERRAL_BONUS = 500;
export const MAX_REFERRALS_PER_MEMBER = 10;

// No ambiguous characters (0/O, 1/I/L) — this gets read aloud and typed by
// hand, unlike a voucher code that's usually scanned as a QR code.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 20;

function generateReferralCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
}

function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && /duplicate key value/i.test(err.message);
}

/** Every member gets one permanent code, generated the first time it's
 * needed — an existing member's first visit to "Refer a Friend" works the
 * same way a brand-new signup's would, no separate backfill required. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = (await sql`select referral_code from users where id = ${userId}`) as Array<{
    referral_code: string | null;
  }>;
  if (existing.length === 0) throw new Error('User not found');
  if (existing[0].referral_code) return existing[0].referral_code;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateReferralCode();
    try {
      await sql`update users set referral_code = ${code} where id = ${userId}`;
      return code;
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < MAX_CODE_ATTEMPTS - 1) continue;
      throw err;
    }
  }
  throw new Error('Could not generate a unique referral code — try again');
}

interface ReferrerLookup {
  id: string;
  firstName: string;
  lastName: string;
}

export async function findReferrerByCode(code: string): Promise<ReferrerLookup | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const rows = (await sql`
    select id, first_name, last_name from users where referral_code = ${trimmed}
  `) as Array<{ id: string; first_name: string; last_name: string }>;
  if (rows.length === 0) return null;
  return { id: rows[0].id, firstName: rows[0].first_name, lastName: rows[0].last_name };
}

export async function countReferralRedemptions(referrerUserId: string): Promise<number> {
  const rows = (await sql`
    select count(*)::int as count from referral_redemptions where referrer_user_id = ${referrerUserId}
  `) as Array<{ count: number }>;
  return rows[0].count;
}

// A bad/unknown code, or a referrer who's already hit their lifetime cap,
// should never block the referred signup itself — both grant functions
// silently no-op rather than throwing. The cap check-then-credit isn't
// transactionally locked, so two referrals landing in the same instant for
// a referrer right at the cap could in theory let one extra through — an
// acceptable, very low-stakes race given how infrequent referral signups
// are, not worth a row lock for.

/** Credits a referrer when a new member signs up with their code. */
export async function grantMemberReferralBonus(
  code: string,
  newMember: { id: string; firstName: string; lastName: string },
): Promise<void> {
  const referrer = await findReferrerByCode(code);
  if (!referrer) return;
  if (referrer.id === newMember.id) return; // structurally impossible today (new user has no code yet), kept as a defensive guard
  if ((await countReferralRedemptions(referrer.id)) >= MAX_REFERRALS_PER_MEMBER) return;

  await giftFlagrrCash({
    userId: referrer.id,
    amount: MEMBER_REFERRAL_BONUS,
    reason: `${newMember.firstName} ${newMember.lastName} joined Flagrr using your referral code`,
  });
  await sql`
    insert into referral_redemptions (referrer_user_id, referred_type, referred_user_id, amount)
    values (${referrer.id}, 'member', ${newMember.id}, ${MEMBER_REFERRAL_BONUS})
  `;
}

/** Same idea for a golf club's signup — called once the club is actually
 * provisioned (first payment confirmed via Payfast ITN), never at the
 * initial signup form, so nothing is paid out for a club that abandons
 * checkout. */
export async function grantCourseReferralBonus(code: string, newCourse: { id: string; name: string }): Promise<void> {
  const referrer = await findReferrerByCode(code);
  if (!referrer) return;
  if ((await countReferralRedemptions(referrer.id)) >= MAX_REFERRALS_PER_MEMBER) return;

  await giftFlagrrCash({
    userId: referrer.id,
    amount: COURSE_REFERRAL_BONUS,
    reason: `${newCourse.name} joined Flagrr using your referral code`,
  });
  await sql`
    insert into referral_redemptions (referrer_user_id, referred_type, referred_course_id, amount)
    values (${referrer.id}, 'course', ${newCourse.id}, ${COURSE_REFERRAL_BONUS})
  `;
}
