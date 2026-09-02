import { sql } from './db';
import { sendPushToUser } from './pushNotifications';

export const LOW_CONFIDENCE_THRESHOLD = 55; // tesseract.js confidence is 0-100
export const HIGH_POINTS_REVIEW_THRESHOLD = 500;
export const RAPID_SUBMISSION_WINDOW_MINUTES = 10;
export const RAPID_SUBMISSION_MAX_COUNT = 5;

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
}

// Best-effort — recording the attempt should never block the duplicate
// rejection itself from working.
async function logDuplicateAttempt(
  userId: string,
  courseId: string,
  matchType: 'receipt_number' | 'image_hash',
  matchedReceiptId: string,
): Promise<void> {
  try {
    await sql`
      insert into receipt_duplicate_attempts (user_id, course_id, match_type, matched_receipt_id)
      values (${userId}, ${courseId}, ${matchType}, ${matchedReceiptId})
    `;
  } catch {
    // best-effort
  }
}

// A receipt number, once redeemed, can never be redeemed again — by anyone.
// The image hash catches an identical image resubmitted even without (or
// with a different) receipt number. Every rejection is also logged to
// receipt_duplicate_attempts — the same receipt or image showing up at a
// *different* club is the clearest cross-club fraud signal the app has, and
// it used to be discarded the moment it was caught.
export async function checkDuplicateReceipt(
  receiptNumber: string | null,
  imageHash: string,
  userId: string,
  courseId: string,
): Promise<DuplicateCheckResult> {
  if (receiptNumber) {
    const byNumber = (await sql`
      select id from receipts where receipt_number = ${receiptNumber} limit 1
    `) as Array<{ id: string }>;
    if (byNumber.length > 0) {
      await logDuplicateAttempt(userId, courseId, 'receipt_number', byNumber[0].id);
      return { isDuplicate: true, reason: 'This receipt has already been redeemed.' };
    }
  }

  const byHash = (await sql`select id from receipts where image_hash = ${imageHash} limit 1`) as Array<{ id: string }>;
  if (byHash.length > 0) {
    await logDuplicateAttempt(userId, courseId, 'image_hash', byHash[0].id);
    return { isDuplicate: true, reason: 'This receipt has already been redeemed.' };
  }

  return { isDuplicate: false };
}

export interface FraudFlags {
  flagged: boolean;
  reasons: string[];
}

const REASON_LABELS: Record<string, string> = {
  low_ocr_confidence: 'low OCR confidence',
  unusually_high_points: 'unusually high Flagrr Cash awarded',
  rapid_repeat_submissions: 'rapid repeat submissions',
};

/** Human-readable summary of flag reason codes, for the admin notification
 * feed — e.g. "low OCR confidence, unusually high Flagrr Cash awarded". */
export function describeFraudReasons(reasons: string[]): string {
  return reasons.map((r) => REASON_LABELS[r] ?? r).join(', ');
}

// Heuristic checks run at submit time; a flagged receipt still gets its
// points (blocking a legitimate golfer over a false positive is worse UX
// than a rare fraudulent claim slipping through for manual review), but is
// marked for a human to look at later.
export async function evaluateFraudSignals(params: {
  userId: string;
  ocrConfidence: number;
  totalPointsAwarded: number;
}): Promise<FraudFlags> {
  const reasons: string[] = [];

  if (params.ocrConfidence < LOW_CONFIDENCE_THRESHOLD) {
    reasons.push('low_ocr_confidence');
  }
  if (params.totalPointsAwarded > HIGH_POINTS_REVIEW_THRESHOLD) {
    reasons.push('unusually_high_points');
  }

  const recentRows = (await sql`
    select count(*)::int as count
    from receipts
    where user_id = ${params.userId}
      and submitted_at > now() - make_interval(mins => ${RAPID_SUBMISSION_WINDOW_MINUTES})
  `) as Array<{ count: number }>;
  if ((recentRows[0]?.count ?? 0) >= RAPID_SUBMISSION_MAX_COUNT) {
    reasons.push('rapid_repeat_submissions');
  }

  return { flagged: reasons.length > 0, reasons };
}

export type FraudResolution = 'confirmed' | 'cleared';

export interface ResolvedFlaggedReceipt {
  userId: string;
  pointsAwarded: number | null;
  courseName: string;
  total: number;
  submittedAt: string;
  // Whether this receipt's Flagrr Cash was already credited *before* this
  // resolution. New flagged receipts hold points until approved (see
  // api/receipts/index.ts), so this is false for them — 'confirmed' then
  // has nothing to claw back, and 'cleared' (Approve) is what credits the
  // points for the first time. A receipt flagged before this held-points
  // behavior shipped already got its points at submission (points_credited
  // defaults to true), so it's treated the old way: 'confirmed' claws back,
  // 'cleared'/Approve just closes the review with nothing left to credit.
  alreadyCredited: boolean;
}

// Resolves a flagged receipt's fraud review. 'confirmed' rejects the receipt
// (side effects — points claw-back if applicable, member notification — are
// the caller's job, via applyFraudConfirmationEffects below); 'cleared'
// (Approve) closes it out as a false positive and credits any held points
// (via applyApprovalEffects). Scoped to `courseId` for a course_admin acting
// on their own club; omitted for super_admin, who can resolve any club's
// flagged receipt. Returns null if the receipt doesn't exist, isn't
// flagged, is out of scope, or was already resolved — a stale/duplicate
// review-queue tap is a no-op, not an error.
export async function resolveFlaggedReceipt(params: {
  receiptId: string;
  courseId?: string;
  resolution: FraudResolution;
  adminId: string;
}): Promise<ResolvedFlaggedReceipt | null> {
  // Read the pre-resolution state first — once the UPDATE below lands,
  // points_credited may already read true even for a receipt that's only
  // being credited *by* this same call (see the 'cleared' branch), so
  // alreadyCredited has to be captured before that happens.
  const existingRows = (await sql`
    select user_id, points_awarded, course_name, total, submitted_at, points_credited
    from receipts
    where id = ${params.receiptId} and flagged = true and fraud_status = 'pending'
      ${params.courseId ? sql`and course_id = ${params.courseId}` : sql``}
  `) as Array<{
    user_id: string;
    points_awarded: number | null;
    course_name: string;
    total: string;
    submitted_at: string;
    points_credited: boolean;
  }>;
  if (existingRows.length === 0) return null;
  const existing = existingRows[0];

  const updatedRows = (await sql`
    update receipts
    set fraud_status = ${params.resolution},
        fraud_resolved_at = now(),
        fraud_resolved_by = ${params.adminId},
        status = case
          when ${params.resolution} = 'confirmed' then 'rejected'
          when ${params.resolution} = 'cleared' and points_credited = false then 'approved'
          else status
        end,
        points_credited = case when ${params.resolution} = 'cleared' then true else points_credited end
    where id = ${params.receiptId} and flagged = true and fraud_status = 'pending'
      ${params.courseId ? sql`and course_id = ${params.courseId}` : sql``}
    returning id
  `) as Array<{ id: string }>;
  // Resolved by someone else in the gap between the two queries above — an
  // exceedingly small window for a human clicking a button, but the WHERE
  // guard makes it safe either way: treat it the same as already-resolved.
  if (updatedRows.length === 0) return null;

  return {
    userId: existing.user_id,
    pointsAwarded: existing.points_awarded,
    courseName: existing.course_name,
    total: Number(existing.total),
    submittedAt: existing.submitted_at,
    alreadyCredited: existing.points_credited,
  };
}

// Claws back the points a confirmed-fraudulent receipt awarded (only if it
// actually got any — see alreadyCredited), bumps the member's permanent
// fraud-confirmed count (repeat-offender tracking, separate from the "times
// flagged" count which includes false positives), and lets the member know
// via notification + push, including the admin's own reason.
export async function applyFraudConfirmationEffects(receipt: ResolvedFlaggedReceipt, reason: string): Promise<void> {
  const points = receipt.alreadyCredited ? (receipt.pointsAwarded ?? 0) : 0;
  if (points > 0) {
    await sql`
      update points_accounts
      set balance = balance - ${points}, total_earned = greatest(total_earned - ${points}, 0)
      where user_id = ${receipt.userId}
    `;
    await sql`
      insert into activity (user_id, type, title, subtitle, amount)
      values (${receipt.userId}, 'redeem', 'Receipt rejected', 'Flagrr Cash reversed', ${-points})
    `;
  }
  await sql`update users set fraud_confirmed_count = fraud_confirmed_count + 1 where id = ${receipt.userId}`;

  const body =
    `A receipt you submitted${receipt.courseName ? ` at ${receipt.courseName}` : ''} was confirmed as fraudulent: ${reason}` +
    (points > 0 ? ` ${points} Flagrr Cash awarded for it has been reversed from your balance.` : '');
  await sql`insert into notifications (user_id, title, body) values (${receipt.userId}, 'Receipt rejected', ${body})`;
  await sendPushToUser(receipt.userId, { title: 'Receipt rejected', body }, 'accountActivity');
}

// Credits the Flagrr Cash a flagged receipt was holding, now that it's been
// approved as legitimate — a no-op if it was already credited at submission
// (a receipt flagged before the held-points behavior shipped). Mirrors the
// crediting side effects in api/receipts/index.ts's submit flow, attributed
// to the month the receipt was actually submitted (not the review date) so
// tier/reporting numbers land in the period the purchase happened.
export async function applyApprovalEffects(receipt: ResolvedFlaggedReceipt): Promise<void> {
  if (receipt.alreadyCredited) return;
  const points = receipt.pointsAwarded ?? 0;
  if (points === 0) return;

  const submitted = new Date(receipt.submittedAt);
  await sql`
    update points_accounts
    set balance = balance + ${points}, total_earned = total_earned + ${points}
    where user_id = ${receipt.userId}
  `;
  await sql`
    insert into monthly_points (user_id, year, month, value)
    values (${receipt.userId}, ${submitted.getFullYear()}, ${submitted.getMonth() + 1}, ${points})
    on conflict (user_id, year, month) do update set value = monthly_points.value + excluded.value
  `;
  await sql`
    insert into activity (user_id, type, title, subtitle, amount)
    values (${receipt.userId}, 'earn', 'Receipt scanned', ${receipt.courseName || null}, ${points})
  `;

  const body =
    `Your receipt${receipt.courseName ? ` at ${receipt.courseName}` : ''} was reviewed and approved. ` +
    `${points} Flagrr Cash has been added to your balance.`;
  await sql`insert into notifications (user_id, title, body) values (${receipt.userId}, 'Receipt approved', ${body})`;
  await sendPushToUser(receipt.userId, { title: 'Receipt approved', body }, 'accountActivity');
}
