-- Lets a member's "Give Feedback" submission carry a category tag (bug /
-- general feedback / improvement) alongside the existing support-ticket
-- fields. Reuses the same table/thread/email-to-team plumbing as a
-- course_admin's "Log a Ticket" (see api/_lib/supportTickets.ts) — a member
-- feedback submission is just a support ticket with requester_type =
-- 'member' and a category set. Nullable: only member feedback sets it,
-- course_admin/staff tickets never do.
alter table support_tickets
  add column category text check (category in ('bug', 'general_feedback', 'improvement'));
