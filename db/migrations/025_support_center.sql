-- Platform-level Support Centre: any member, course_admin, or staff account
-- can log a ticket to the Flagrr team (not their own club's admins — that's
-- what the existing enquiries/enquiry_messages tables already cover). The
-- Flagrr side is handled by super_admin accounts plus a new `support_agent`
-- role: scoped to no single course (like super_admin), but restricted
-- client-side to the support inbox + a basic profile (see
-- SUPPORT_AGENT_ALLOWED_ACTIONS in api/admin/index.ts).

-- Widen the existing role/course_id check constraints to allow 'support_agent'.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'admins'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table admins drop constraint %I', con.conname);
  end loop;
end $$;

alter table admins add constraint admins_role_check check (role in ('super_admin', 'course_admin', 'staff', 'support_agent'));
alter table admins add constraint admins_course_id_required_check check (role in ('super_admin', 'support_agent') or course_id is not null);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_type text not null check (requester_type in ('member', 'course_admin', 'staff')),
  -- Exactly one of these is set, matching requester_type — a member's
  -- requester lives in `users`, a course_admin/staff's in `admins`.
  requester_user_id uuid references users(id) on delete set null,
  requester_admin_id uuid references admins(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  course_id uuid references courses(id) on delete set null,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('requester', 'agent')),
  sender_admin_id uuid references admins(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  read_by_requester boolean not null default false,
  read_by_agent boolean not null default false
);

create index support_tickets_status_idx on support_tickets(status);
create index support_tickets_requester_user_id_idx on support_tickets(requester_user_id);
create index support_tickets_requester_admin_id_idx on support_tickets(requester_admin_id);
create index support_ticket_messages_ticket_id_idx on support_ticket_messages(ticket_id);
