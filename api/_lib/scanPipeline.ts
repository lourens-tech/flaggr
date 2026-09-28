import type { ParsedReceipt } from './receiptParser';
import { extractReceipt, type ReceiptExtractor } from './receiptExtraction';
import { loadScanExtraction, saveScanExtraction } from './scanCache';
import { hashImageDataUri } from './imageHash';
import { matchAndScoreReceipt, type PointsResult } from './pointsEngine';

export interface ScanPipelineResult {
  imageHash: string;
  ocrConfidence: number;
  parsed: ParsedReceipt;
  scored: PointsResult;
  extractor: ReceiptExtractor;
}

// Shared by the preview endpoint (/api/receipts?action=scan) and the confirm
// endpoint (POST /api/receipts). The confirm step never trusts
// client-supplied extracted data or points — that's what "prevent manual
// editing of extracted receipt data" actually requires; a read-only field in
// the UI is not a security boundary on its own. Instead the preview saves its
// own extraction server-side, keyed by the member and the photo's hash, and
// confirm reuses it for the same photo, so the member is credited exactly
// what they were shown. Without a saved preview (expired, or the cache
// unavailable) confirm reads the photo again. Matching and scoring always
// re-run against the club's current catalog.
// homeCourseId scopes which club's product/activity catalog and Flagrr Cash
// conversion rate are used to score matched items (see pointsEngine.ts).
export async function runScanPipeline(
  imageDataUri: string,
  homeCourseId: string,
  userId: string,
  mode: 'preview' | 'confirm',
): Promise<ScanPipelineResult> {
  const imageHash = hashImageDataUri(imageDataUri);
  let extraction = mode === 'confirm' ? await loadScanExtraction(userId, imageHash) : null;
  if (!extraction) {
    extraction = await extractReceipt(imageDataUri);
    if (mode === 'preview') await saveScanExtraction(userId, imageHash, extraction);
  }
  const { parsed, confidence, extractor } = extraction;
  const scored = await matchAndScoreReceipt(parsed.items, parsed.rawLines, homeCourseId);
  return { imageHash, ocrConfidence: confidence, parsed, scored, extractor };
}
