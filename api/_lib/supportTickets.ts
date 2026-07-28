import { sql } from './db';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved';
export const SUPPORT_TICKET_STATUSES: SupportTicketStatus[] = ['open', 'in_progress', 'resolved'];
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export const SUPPORT_TICKET_PRIORITIES: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent'];
export type SupportRequesterType = 'member' | 'course_admin' | 'staff';

export interface SupportTicketMessageDto {
  id: string;
  senderType: 'requester' | 'agent';
  body: string;
  createdAt: string;
}

function serializeMessage(row: {
  id: string;
  sender_type: 'requester' | 'agent';
  body: string;
  created_at: string;
}): SupportTicketMessageDto {
  return { id: row.id, senderType: row.sender_type, body: row.body, createdAt: row.created_at };
}

export async function listSupportTicketMessages(ticketId: string): Promise<SupportTicketMessageDto[]> {
  const rows = (await sql`
    select id, sender_type, body, created_at
    from support_ticket_messages
    where ticket_id = ${ticketId}
    order by created_at asc
  `) as Array<{ id: string; sender_type: 'requester' | 'agent'; body: string; created_at: string }>;
  return rows.map(serializeMessage);
}

interface CreateSupportTicketParams {
  requesterType: SupportRequesterType;
  requesterUserId: string | null;
  requesterAdminId: string | null;
  requesterName: string;
  requesterEmail: string;
  courseId: string | null;
  subject: string;
  message: string;
}

/** Creates the ticket + its first message (from the requester) — the entry
 * point for every "Log a Ticket" form (member, course_admin, and staff all
 * funnel through this, differing only in requesterType/which id is set).
 * Returns the new ticket's id. */
export async function createSupportTicket(params: CreateSupportTicketParams): Promise<string> {
  const rows = (await sql`
    insert into support_tickets
      (requester_type, requester_user_id, requester_admin_id, requester_name, requester_email, course_id, subject, status)
    values
      (${params.requesterType}, ${params.requesterUserId}, ${params.requesterAdminId}, ${params.requesterName},
       ${params.requesterEmail}, ${params.courseId}, ${params.subject}, 'open')
    returning id
  `) as Array<{ id: string }>;
  const ticketId = rows[0].id;
  await sql`
    insert into support_ticket_messages (ticket_id, sender_type, body, read_by_requester, read_by_agent)
    values (${ticketId}, 'requester', ${params.message}, true, false)
  `;
  return ticketId;
}

/** A requester's follow-up message. Reopens a resolved thread back to
 * 'open' — it needs the support team's attention again. */
export async function addRequesterMessage(ticketId: string, body: string): Promise<void> {
  await sql`
    insert into support_ticket_messages (ticket_id, sender_type, body, read_by_requester, read_by_agent)
    values (${ticketId}, 'requester', ${body}, true, false)
  `;
  await sql`
    update support_tickets
    set updated_at = now(), status = case when status = 'resolved' then 'open' else status end
    where id = ${ticketId}
  `;
}

/** A support agent's (or super_admin's) reply. Auto-advances a still-'open'
 * thread to 'in_progress' — replying to it is exactly what that transition
 * means. Doesn't touch an already-'resolved' or manually-set status otherwise. */
export async function addAgentMessage(ticketId: string, agentId: string, body: string): Promise<void> {
  await sql`
    insert into support_ticket_messages (ticket_id, sender_type, sender_admin_id, body, read_by_requester, read_by_agent)
    values (${ticketId}, 'agent', ${agentId}, ${body}, false, true)
  `;
  await sql`
    update support_tickets
    set updated_at = now(), status = case when status = 'open' then 'in_progress' else status end
    where id = ${ticketId}
  `;
}

export async function markThreadReadByRequester(ticketId: string): Promise<void> {
  await sql`update support_ticket_messages set read_by_requester = true where ticket_id = ${ticketId} and read_by_requester = false`;
}

export async function markThreadReadByAgent(ticketId: string): Promise<void> {
  await sql`update support_ticket_messages set read_by_agent = true where ticket_id = ${ticketId} and read_by_agent = false`;
}
