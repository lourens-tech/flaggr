import { sql } from './db';
import { hasColumn } from './schemaColumns';
import { sendPushToUser } from './pushNotifications';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved';
export const SUPPORT_TICKET_STATUSES: SupportTicketStatus[] = ['open', 'in_progress', 'resolved'];
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export const SUPPORT_TICKET_PRIORITIES: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent'];
export type SupportRequesterType = 'member' | 'course_admin' | 'staff';
export type SupportTicketCategory = 'bug' | 'general_feedback' | 'improvement';
export const SUPPORT_TICKET_CATEGORIES: SupportTicketCategory[] = ['bug', 'general_feedback', 'improvement'];

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
  // Only ever set for a member's "Give Feedback" submission — course_admin
  // and staff tickets ("Log a Ticket") leave this null.
  category?: SupportTicketCategory | null;
}

/** Creates the ticket + its first message (from the requester) — the entry
 * point for every "Log a Ticket" form (member, course_admin, and staff all
 * funnel through this, differing only in requesterType/which id is set).
 * Returns the new ticket's id. */
export async function createSupportTicket(params: CreateSupportTicketParams): Promise<string> {
  const rows = (await sql`
    insert into support_tickets
      (requester_type, requester_user_id, requester_admin_id, requester_name, requester_email, course_id, subject, status, category)
    values
      (${params.requesterType}, ${params.requesterUserId}, ${params.requesterAdminId}, ${params.requesterName},
       ${params.requesterEmail}, ${params.courseId}, ${params.subject}, 'open', ${params.category ?? null})
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
 * means. Doesn't touch an already-'resolved' or manually-set status otherwise.
 * Also auto-claims an unassigned ticket for the replying agent (same idea as
 * the status advance: replying to it is picking it up), without stealing it
 * from whoever already has it. */
export async function addAgentMessage(ticketId: string, agentId: string, body: string): Promise<void> {
  await sql`
    insert into support_ticket_messages (ticket_id, sender_type, sender_admin_id, body, read_by_requester, read_by_agent)
    values (${ticketId}, 'agent', ${agentId}, ${body}, false, true)
  `;
  await sql`
    update support_tickets
    set updated_at = now(),
        status = case when status = 'open' then 'in_progress' else status end,
        assigned_agent_id = coalesce(assigned_agent_id, ${agentId})
    where id = ${ticketId}
  `;
}

export async function markThreadReadByRequester(ticketId: string): Promise<void> {
  await sql`update support_ticket_messages set read_by_requester = true where ticket_id = ${ticketId} and read_by_requester = false`;
}

export async function markThreadReadByAgent(ticketId: string): Promise<void> {
  await sql`update support_ticket_messages set read_by_agent = true where ticket_id = ${ticketId} and read_by_agent = false`;
}

// ── Member side: Give Feedback replies (owner decision, 24 Nov 2026) ──────────
// A member's Give Feedback submission is a support ticket with
// requester_type = 'member'. Members can list their own submissions and read
// the thread with the Flagrr team's replies (api/profile ?action=myFeedback,
// ?action=feedbackThread), and get a notification when an agent replies.

export interface MemberFeedbackSummaryDto {
  id: string;
  category: SupportTicketCategory | null;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  hasUnread: boolean;
}

export async function listMemberFeedback(userId: string): Promise<MemberFeedbackSummaryDto[]> {
  const rows = (await sql`
    select t.id, t.category, t.status, t.created_at, t.updated_at,
           (select body from support_ticket_messages m where m.ticket_id = t.id order by m.created_at desc limit 1) as last_message,
           exists(select 1 from support_ticket_messages m where m.ticket_id = t.id and m.read_by_requester = false) as has_unread
    from support_tickets t
    where t.requester_type = 'member' and t.requester_user_id = ${userId}
    order by t.updated_at desc
  `) as Array<{
    id: string;
    category: SupportTicketCategory | null;
    status: SupportTicketStatus;
    created_at: string;
    updated_at: string;
    last_message: string | null;
    has_unread: boolean;
  }>;
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastMessage: r.last_message,
    hasUnread: r.has_unread,
  }));
}

/** One of the member's own feedback threads, or null if it isn't theirs.
 * Marks the agent's replies read, as opening an enquiry thread does. */
export async function fetchMemberFeedbackThread(ticketId: string, userId: string) {
  const owned = (await sql`
    select id, category, status, created_at from support_tickets
    where id = ${ticketId} and requester_type = 'member' and requester_user_id = ${userId}
  `) as Array<{ id: string; category: SupportTicketCategory | null; status: SupportTicketStatus; created_at: string }>;
  if (owned.length === 0) return null;
  await markThreadReadByRequester(ticketId);
  const t = owned[0];
  return { id: t.id, category: t.category, status: t.status, createdAt: t.created_at, messages: await listSupportTicketMessages(ticketId) };
}

export const FEEDBACK_REPLY_TITLE = 'Reply to your feedback';

/** After an agent replies: if the ticket is a member's feedback, tell the
 * member (in-app notification plus push under "Support replies"), as a club's
 * reply to an enquiry does. Course admin / staff tickets are untouched. */
export async function notifyMemberOfAgentReply(ticketId: string, body: string): Promise<void> {
  const rows = (await sql`
    select requester_user_id from support_tickets
    where id = ${ticketId} and requester_type = 'member' and requester_user_id is not null
  `) as Array<{ requester_user_id: string }>;
  if (rows.length === 0) return;
  const userId = rows[0].requester_user_id;
  const notifBody = `Flagrr Support replied: ${body}`;
  if (await hasColumn('notifications', 'support_ticket_id', '053_notification_support_ticket.sql')) {
    await sql`
      insert into notifications (user_id, title, body, support_ticket_id)
      values (${userId}, ${FEEDBACK_REPLY_TITLE}, ${notifBody}, ${ticketId})
    `;
  } else {
    await sql`insert into notifications (user_id, title, body) values (${userId}, ${FEEDBACK_REPLY_TITLE}, ${notifBody})`;
  }
  await sendPushToUser(userId, { title: FEEDBACK_REPLY_TITLE, body: notifBody }, 'supportReplies');
}
