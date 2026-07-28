-- Lets a support agent (or super_admin) triage the shared Support Centre
-- inbox by urgency — internal to the support team, never shown to the
-- requester (member/course_admin/staff), same as the requester never
-- seeing internal fraud-review detail.
alter table support_tickets
  add column priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent'));

create index support_tickets_priority_idx on support_tickets(priority);
