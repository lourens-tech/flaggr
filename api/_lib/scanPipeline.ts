import { runOcr } from './ocr';
import { parseReceiptText, type ParsedReceipt } from './receiptParser';
import { hashImageDataUri } from './imageHash';
import { matchAndScoreReceipt, type PointsResult } from './pointsEngine';

export interface ScanPipelineResult {
  imageHash: string;
  ocrConfidence: number;
  parsed: ParsedReceipt;
  scored: PointsResult;
}

// Shared by the preview endpoint (/api/receipts/scan) and the confirm
// endpoint (POST /api/receipts). The confirm step re-runs this from the same
// image rather than trusting client-supplied extracted data/points — that's
// what "prevent manual editing of extracted receipt data" actually requires;
// a read-only field in the UI is not a security boundary on its own.
export async function runScanPipeline(imageDataUri: string): Promise<ScanPipelineResult> {
  const imageHash = hashImageDataUri(imageDataUri);
  const ocr = await runOcr(imageDataUri);
  const parsed = parseReceiptText(ocr.text);
  const scored = await matchAndScoreReceipt(parsed.items, parsed.merchantNameGuess);
  return { imageHash, ocrConfidence: ocr.confidence, parsed, scored };
}
