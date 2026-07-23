import { sql } from './db';

/** Inserts an admin-facing notification, scoped to a course rather than an
 * individual admin — any course_admin for that club sees the same feed. Best-
 * effort by convention of every other notification helper in this app: call
 * sites don't await-fail on this. */
export async function notifyCourseAdmins(
  courseId: string,
  title: string,
  body: string,
  options: { receiptId?: string | null; enquiryId?: string | null } = {},
): Promise<void> {
  await sql`
    insert into admin_notifications (course_id, title, body, receipt_id, enquiry_id)
    values (${courseId}, ${title}, ${body}, ${options.receiptId ?? null}, ${options.enquiryId ?? null})
  `;
}
