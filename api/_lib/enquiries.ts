import { sql } from './db';

export type EnquiryStatus = 'pending' | 'in_progress' | 'resolved';
export const ENQUIRY_STATUSES: EnquiryStatus[] = ['pending', 'in_progress', 'resolved'];

export interface EnquiryMessageDto {
  id: string;
  senderType: 'member' | 'admin';
  body: string;
  createdAt: string;
}

function serializeMessage(row: {
  id: string;
  sender_type: 'member' | 'admin';
  body: string;
  created_at: string;
}): EnquiryMessageDto {
  return { id: row.id, senderType: row.sender_type, body: row.body, createdAt: row.created_at };
}

export async function listEnquiryMessages(enquiryId: string): Promise<EnquiryMessageDto[]> {
  const rows = (await sql`
    select id, sender_type, body, created_at
    from enquiry_messages
    where enquiry_id = ${enquiryId}
    order by created_at asc
  `) as Array<{ id: string; sender_type: 'member' | 'admin'; body: string; created_at: string }>;
  return rows.map(serializeMessage);
}

/** Creates the enquiry + its first message (from the member) — the entry
 * point for the Contact Us form. Returns the new enquiry's id. */
export async function createEnquiry(
  courseId: string,
  userId: string,
  enquiryType: string,
  message: string,
): Promise<string> {
  const rows = (await sql`
    insert into enquiries (course_id, user_id, enquiry_type, status)
    values (${courseId}, ${userId}, ${enquiryType}, 'pending')
    returning id
  `) as Array<{ id: string }>;
  const enquiryId = rows[0].id;
  await sql`
    insert into enquiry_messages (enquiry_id, sender_type, body, read_by_member, read_by_admin)
    values (${enquiryId}, 'member', ${message}, true, false)
  `;
  return enquiryId;
}

/** A member's follow-up message on an existing thread. Reopens a resolved
 * thread back to 'pending' — it needs admin attention again. */
export async function addMemberMessage(enquiryId: string, body: string): Promise<void> {
  await sql`
    insert into enquiry_messages (enquiry_id, sender_type, body, read_by_member, read_by_admin)
    values (${enquiryId}, 'member', ${body}, true, false)
  `;
  await sql`
    update enquiries
    set updated_at = now(), status = case when status = 'resolved' then 'pending' else status end
    where id = ${enquiryId}
  `;
}

/** An admin's reply. Auto-advances a still-'pending' thread to
 * 'in_progress' — the admin engaging with it is exactly what that
 * transition means. Doesn't touch an already-'resolved' or manually-set
 * status otherwise. */
export async function addAdminMessage(enquiryId: string, adminId: string, body: string): Promise<void> {
  await sql`
    insert into enquiry_messages (enquiry_id, sender_type, sender_admin_id, body, read_by_member, read_by_admin)
    values (${enquiryId}, 'admin', ${adminId}, ${body}, false, true)
  `;
  await sql`
    update enquiries
    set updated_at = now(), status = case when status = 'pending' then 'in_progress' else status end
    where id = ${enquiryId}
  `;
}

export async function markThreadReadByMember(enquiryId: string): Promise<void> {
  await sql`update enquiry_messages set read_by_member = true where enquiry_id = ${enquiryId} and read_by_member = false`;
}

export async function markThreadReadByAdmin(enquiryId: string): Promise<void> {
  await sql`update enquiry_messages set read_by_admin = true where enquiry_id = ${enquiryId} and read_by_admin = false`;
}
