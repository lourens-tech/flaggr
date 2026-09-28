import { runOcr } from './ocr';
import { parseReceiptText, type ParsedReceipt } from './receiptParser';
import { extractReceiptWithClaude } from './claudeReceipt';

export type ReceiptExtractor = 'tesseract' | 'claude';

// RECEIPT_EXTRACTOR=claude switches extraction to Claude vision
// (claudeReceipt.ts); anything else, or unset, keeps Tesseract + regex.
export function configuredExtractor(): ReceiptExtractor {
  return process.env.RECEIPT_EXTRACTOR === 'claude' ? 'claude' : 'tesseract';
}

export interface ExtractionResult {
  parsed: ParsedReceipt;
  confidence: number; // 0-100
  // Which extractor actually produced the result — 'tesseract' when Claude
  // was requested but failed and the fallback ran.
  extractor: ReceiptExtractor;
}

// Kept free of any database import so scripts/receipt-eval can run it
// against local fixture images without a DATABASE_URL.
export async function extractReceipt(
  imageDataUri: string,
  extractor: ReceiptExtractor = configuredExtractor(),
): Promise<ExtractionResult> {
  if (extractor === 'claude') {
    try {
      const result = await extractReceiptWithClaude(imageDataUri);
      return { parsed: result.parsed, confidence: result.confidence, extractor: 'claude' };
    } catch (err) {
      // An API outage, missing key or unreadable response shouldn't block a
      // member's scan — fall back to the in-process Tesseract path.
      console.error('Claude receipt extraction failed, falling back to Tesseract', err);
    }
  }
  const ocr = await runOcr(imageDataUri);
  return { parsed: parseReceiptText(ocr.text), confidence: ocr.confidence, extractor: 'tesseract' };
}
