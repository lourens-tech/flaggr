-- Lets a support agent claim a ticket (explicitly, or implicitly by
-- replying to it) so two agents don't double-work the same
-- conversation — previously "any agent can pick up and reply to any
-- ticket, no per-ticket assignment" per the inbox's own code comment.
alter table support_tickets
  add column assigned_agent_id uuid references admins(id) on delete set null;

create index support_tickets_assigned_agent_id_idx on support_tickets(assigned_agent_id);
