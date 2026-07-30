-- Replace the unused Stripe-shaped billing columns with PayFast equivalents,
-- and add grace-period tracking for the marketing-site subscribe/pay flow.
alter table courses drop column if exists stripe_customer_id;
alter table courses drop column if exists stripe_subscription_id;

alter table courses add column if not exists payfast_token text;
alter table courses add column if not exists next_billing_date date;
alter table courses add column if not exists past_due_since timestamptz;
alter table courses add column if not exists past_due_reminders_sent int not null default 0;

-- Staging row for a club signup started on the marketing site, before the
-- course (and its course_admin) exists — created once PayFast confirms the
-- first payment via ITN. Keyed by the m_payment_id we generate and hand to
-- PayFast at checkout, since that's the one identifier PayFast hands back
-- unchanged on the notification.
create table pending_club_signups (
  id uuid primary key default gen_random_uuid(),
  m_payment_id text not null unique,
  course_name text not null,
  contact_email citext not null,
  contact_phone text,
  admin_first_name text not null,
  admin_last_name text not null,
  admin_email citext not null,
  amount numeric(10, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index pending_club_signups_status_idx on pending_club_signups (status);
