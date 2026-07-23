-- Turns a member's Contact Us enquiry into a real two-way thread with a
-- course admin, instead of a one-shot email + notification ping. See
-- api/profile/index.ts (member side) and api/admin/index.ts (admin side).
create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  enquiry_type text not null default 'General',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists enquiry_messages (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  sender_type text not null check (sender_type in ('member', 'admin')),
  sender_admin_id uuid references admins(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  read_by_member boolean not null default false,
  read_by_admin boolean not null default false
);

create index if not exists enquiries_course_id_idx on enquiries(course_id);
create index if not exists enquiries_user_id_idx on enquiries(user_id);
create index if not exists enquiry_messages_enquiry_id_idx on enquiry_messages(enquiry_id);

-- admin_notifications/notifications already have a receipt_id link column
-- (see migration 014) — reuse the same idea for enquiries so tapping a
-- notification can open the right thread.
alter table admin_notifications add column if not exists enquiry_id uuid references enquiries(id) on delete cascade;
alter table notifications add column if not exists enquiry_id uuid references enquiries(id) on delete cascade;
