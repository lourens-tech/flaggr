-- Per-category push notification opt-out for members — previously all-or-
-- nothing (the OS-level toggle was the only lever). Defaults preserve
-- today's behavior (everything on) for every existing member.
alter table users
  add column notify_account_activity boolean not null default true, -- receipts earned/flagged, redemptions, tier/streak bonuses
  add column notify_support_replies boolean not null default true, -- replies to an enquiry you sent your club
  add column notify_announcements boolean not null default true; -- club or platform-wide broadcasts
