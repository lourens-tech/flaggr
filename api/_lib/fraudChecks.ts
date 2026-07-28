import { sql } from './db';

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
