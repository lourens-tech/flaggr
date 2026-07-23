import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { checkDuplicateReceipt, describeFraudReasons, evaluateFraudSignals } from '../_lib/fraudChecks';
import { runScanPipeline } from '../_lib/scanPipeline';
import { hashImageDataUri } from '../_lib/imageHash';
import { finalizePoints, type MatchedItem } from '../_lib/pointsEngine';
import { getCurrentTierStatus } from '../_lib/tierRewards';
import { sendPushToUser } from '../_lib/pushNotifications';
import { notifyCourseAdmins } from '../_lib/adminNotifications';

const DATA_URI_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,/;
const MAX_BASE64_LENGTH = 7_000_000; // ~5MB decoded
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface SubmitReceiptBody {
  imageBase64?: string;
  imageUri?: string | null; // local device uri, kept only for on-device display
}

interface ReceiptRow {
  id: string;
  image_uri: string | null;
  status: string;
  course_name: string;
  items: MatchedItem[];
  subtotal: string;
  tax: string;
  total: string;
  submitted_at: string;
  points_awarded: number | null;
  receipt_number: string | null;
  transaction_number: string | null;
  till_number: string | null;
  receipt_time: string | null;
  ocr_confidence: string | null;
  flagged: boolean;
  flag_reason: string | null;
}

function serializeReceipt(r: ReceiptRow) {
  return {
    id: r.id,
    imageUri: r.image_uri,
    status: r.status,
    courseName: r.course_name,
    items: r.items,
    subtotal: Number(r.subtotal),
    tax: Number(r.tax),
    total: Number(r.total),
    submittedAt: r.submitted_at,
    pointsAwarded: r.points_awarded,
    receiptNumber: r.receipt_number,
    transactionNumber: r.transaction_number,
    tillNumber: r.till_number,
    receiptTime: r.receipt_time,
    ocrConfidence: r.ocr_confidence !== null ? Number(r.ocr_confidence) : null,
    flagged: r.flagged,
    flagReason: r.flag_reason,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /duplicate key value/i.test(err.message);
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const authed = await requireAuthedUser(req);

  if (req.method === 'GET') {
    const rows = (await sql`
      select id, image_uri, status, course_name, items, subtotal, tax, total, submitted_at, points_awarded,
             receipt_number, transaction_number, till_number, receipt_time, ocr_confidence, flagged, flag_reason
      from receipts
      where user_id = ${authed.id}
      order by submitted_at desc
    `) as ReceiptRow[];

    res.status(200).json(rows.map(serializeReceipt));
    return;
  }

  if (req.method === 'POST') {
    const body = req.body as SubmitReceiptBody;
    const imageBase64 = body.imageBase64;
    if (!imageBase64 || !DATA_URI_PATTERN.test(imageBase64)) {
      throw new HttpError(400, 'imageBase64 must be a jpeg/png/webp data URI');
    }
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      throw new HttpError(400, 'Image is too large');
    }

    // ?action=scan is a preview: same OCR/match/score pipeline, no DB write.
    // Folded into this route (rather than its own file) to stay within
    // Vercel's per-deployment serverless function cap on the Hobby plan.
    if (req.query.action === 'scan') {
      const { ocrConfidence, parsed, scored } = await runScanPipeline(imageBase64);
      const previewHash = hashImageDataUri(imageBase64);
      const duplicate = await checkDuplicateReceipt(parsed.receiptNumber, previewHash);
      if (duplicate.isDuplicate) {
        res.status(200).json({ isDuplicate: true, reason: duplicate.reason });
        return;
      }
      const tierStatus = await getCurrentTierStatus(authed.id);
      const { finalPointsAwarded, awayClub } = finalizePoints(
        scored,
        { subtotal: parsed.subtotal, grandTotal: parsed.grandTotal },
        authed.courseId,
        tierStatus.multiplier,
      );
      res.status(200).json({
        isDuplicate: false,
        ocrConfidence,
        merchantNameGuess: parsed.merchantNameGuess,
        merchant: scored.merchant,
        receiptNumber: parsed.receiptNumber,
        transactionNumber: parsed.transactionNumber,
        tillNumber: parsed.tillNumber,
        date: parsed.date,
        time: parsed.time,
        items: scored.items,
        subtotal: parsed.subtotal,
        vat: parsed.vat,
        grandTotal: parsed.grandTotal,
        subtotalPoints: scored.subtotalPoints,
        totalPointsAwarded: finalPointsAwarded,
        tier: tierStatus.tier,
        tierMultiplier: tierStatus.multiplier,
        awayClub,
      });
      return;
    }

    // Re-run the full pipeline server-side from the original image rather
    // than trusting any client-supplied extracted data or point totals —
    // the scan preview is a UI convenience, not the source of truth.
    const { imageHash, ocrConfidence, parsed, scored } = await runScanPipeline(imageBase64);

    const duplicate = await checkDuplicateReceipt(parsed.receiptNumber, imageHash);
    if (duplicate.isDuplicate) {
      throw new HttpError(409, duplicate.reason ?? 'This receipt has already been redeemed.');
    }

    // Tier multiplier uses the tier as of before this receipt (points earned
    // so far this quarter, not including it), so a receipt's own points
    // can't retroactively change the multiplier applied to itself.
    const tierStatus = await getCurrentTierStatus(authed.id);
    const { finalPointsAwarded, awayClub } = finalizePoints(
      scored,
      { subtotal: parsed.subtotal, grandTotal: parsed.grandTotal },
      authed.courseId,
      tierStatus.multiplier,
    );

    const fraud = await evaluateFraudSignals({
      userId: authed.id,
      ocrConfidence,
      totalPointsAwarded: finalPointsAwarded,
    });

    const courseName = scored.merchant?.name ?? parsed.merchantNameGuess ?? '';
    const itemsSnapshot = scored.items.map((i) => ({ label: i.description, amount: i.price }));
    const receiptId = randomUUID();
    const notificationBody =
      `You earned ${finalPointsAwarded} Flagrr Cash from your receipt${courseName ? ` at ${courseName}` : ''}.` +
      (awayClub ? ' Earned at the standard away-club rate of R1 = 1 Flagrr Cash.' : '');

    let insertedRows: ReceiptRow[];
    try {
      insertedRows = (await sql`
        insert into receipts (
          id, user_id, course_id, course_name, image_uri, status, items, subtotal, tax, total, points_awarded,
          receipt_number, merchant_id, transaction_number, till_number, receipt_time, image_hash, ocr_confidence,
          flagged, flag_reason
        )
        values (
          ${receiptId}, ${authed.id}, ${authed.courseId}, ${courseName}, ${body.imageUri ?? null}, 'approved',
          ${JSON.stringify(itemsSnapshot)}::jsonb,
          ${parsed.subtotal ?? 0}, ${parsed.vat ?? 0}, ${parsed.grandTotal ?? 0}, ${finalPointsAwarded},
          ${parsed.receiptNumber}, ${scored.merchant?.id ?? null}, ${parsed.transactionNumber}, ${parsed.tillNumber},
          ${parsed.time}, ${imageHash}, ${ocrConfidence},
          ${fraud.flagged}, ${fraud.flagged ? fraud.reasons.join(', ') : null}
        )
        returning id, image_uri, status, course_name, items, subtotal, tax, total, submitted_at, points_awarded,
                  receipt_number, transaction_number, till_number, receipt_time, ocr_confidence, flagged, flag_reason
      `) as ReceiptRow[];
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, 'This receipt has already been redeemed.');
      }
      throw err;
    }

    const monthLetter = MONTH_LETTERS[new Date().getMonth()];

    await sql.transaction([
      ...scored.items.map(
        (i) => sql`
          insert into receipt_items (receipt_id, description, quantity, price, matched_product_id, matched_activity_id, points_awarded)
          values (${receiptId}, ${i.description}, ${i.quantity}, ${i.price}, ${i.matchedProductId}, ${i.matchedActivityId}, ${i.pointsAwarded})
        `,
      ),
      sql`
        update points_accounts
        set balance = balance + ${finalPointsAwarded}, total_earned = total_earned + ${finalPointsAwarded}
        where user_id = ${authed.id}
      `,
      sql`
        update user_stats
        set total_receipts_scanned = total_receipts_scanned + 1,
            last_scan_date = now()
        where user_id = ${authed.id}
      `,
      sql`
        insert into monthly_points (user_id, year, month, value)
        values (${authed.id}, extract(year from now())::int, ${monthLetter}, ${finalPointsAwarded})
        on conflict (user_id, year, month) do update set value = monthly_points.value + excluded.value
      `,
      sql`
        insert into activity (user_id, type, title, subtitle, amount)
        values (${authed.id}, 'earn', 'Receipt scanned', ${courseName}, ${finalPointsAwarded})
      `,
      sql`
        insert into notifications (user_id, title, body)
        values (${authed.id}, 'Flagrr Cash earned', ${notificationBody})
      `,
    ]);
    await sendPushToUser(authed.id, { title: 'Flagrr Cash earned', body: notificationBody });

    if (fraud.flagged) {
      await notifyCourseAdmins(
        authed.courseId,
        'Receipt flagged for review',
        `${authed.firstName} ${authed.lastName}'s receipt${courseName ? ` at ${courseName}` : ''} was flagged: ` +
          `${describeFraudReasons(fraud.reasons)}. ${finalPointsAwarded} Flagrr Cash awarded.`,
        receiptId,
      );
    }

    res.status(201).json(serializeReceipt(insertedRows[0]));
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
});
