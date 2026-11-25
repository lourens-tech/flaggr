-- Members can read support's replies to Give Feedback (2026-11-24).
-- Owner decision for the 1.1.0 member app: a member sees their Give Feedback
-- submissions (support tickets with requester_type = 'member') and the
-- Flagrr team's replies, and gets a "Reply to your feedback" notification
-- when an agent replies. That notification records which ticket it is about,
-- so tapping it can open the thread (as notifications.enquiry_id does for a
-- club's reply to an enquiry).
--
-- The API checks for this column (api/_lib/schemaColumns.ts) and keeps
-- working without it, so this can be applied before or after the deploy.
alter table notifications add column if not exists support_ticket_id uuid references support_tickets(id) on delete cascade;

create index if not exists notifications_support_ticket_id_idx on notifications(support_ticket_id);
