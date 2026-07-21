import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthedUser } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';
import { checkDuplicateReceipt } from '../_lib/fraudChecks';
import { runScanPipeline } from '../_lib/scanPipeline';

const DATA_URI_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,/;
const MAX_BASE64_LENGTH = 7_000_000; // ~5MB decoded

interface ScanBody {
  imageBase64?: string;
}

// Preview-only: runs OCR, parses, matches products/activities/merchant, and
// precomputes points and a duplicate check — but writes nothing to the
// database. The client shows this to the golfer to confirm; POST /api/receipts
// re-runs the whole pipeline from the same image and actually persists it
// (never trusts this preview's numbers directly).
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  await requireAuthedUser(req);

  const body = req.body as ScanBody;
  const imageBase64 = body.imageBase64;
  if (!imageBase64 || !DATA_URI_PATTERN.test(imageBase64)) {
    throw new HttpError(400, 'imageBase64 must be a jpeg/png/webp data URI');
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    throw new HttpError(400, 'Image is too large');
  }

  const { imageHash, ocrConfidence, parsed, scored } = await runScanPipeline(imageBase64);

  const duplicate = await checkDuplicateReceipt(parsed.receiptNumber, imageHash);
  if (duplicate.isDuplicate) {
    res.status(200).json({ isDuplicate: true, reason: duplicate.reason });
    return;
  }

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
    totalPointsAwarded: scored.totalPointsAwarded,
  });
});
