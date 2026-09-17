-- Referral program: every member can generate one permanent unique code
-- (see getOrCreateReferralCode in api/_lib/referrals.ts), shared with
-- friends and clubs. Redeeming it credits the referrer's Flagrr Cash via
-- the existing giftFlagrrCash() path — see api/auth/signup.ts (member
-- referrals) and api/courses/index.ts (club referrals, credited only once
-- the club's first payment actually clears).
alter table users add column if not exists referral_code text;
create unique index if not exists users_referral_code_idx on users(referral_code) where referral_code is not null;

-- One row per successful referral payout — the audit trail, and the
-- source of truth for a referrer's lifetime cap (MAX_REFERRALS_PER_MEMBER
-- in api/_lib/referrals.ts).
create table referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references users(id) on delete cascade,
  referred_type text not null check (referred_type in ('member', 'course')),
  referred_user_id uuid references users(id) on delete set null,
  referred_course_id uuid references courses(id) on delete set null,
  amount integer not null,
  created_at timestamptz not null default now()
);
create index referral_redemptions_referrer_idx on referral_redemptions(referrer_user_id);

-- Carries a referral code from the marketing site's signup form through
-- Payfast checkout to the payment-confirmation webhook, where the club
-- (and the referral payout) actually happens — see provisionCourseFromSignup
-- and payfastNotify in api/courses/index.ts.
alter table pending_club_signups add column if not exists referral_code text;
