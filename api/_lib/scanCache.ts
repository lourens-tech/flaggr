import { sql } from './db';
import type { ExtractionResult, ReceiptExtractor } from './receiptExtraction';
import type { ParsedReceipt } from './receiptParser';

// A preview's extraction stays reusable for this long — plenty for a member
// to look over the preview and tap confirm, short enough that a stale read
// never lingers.
const TTL_MINUTES = 30;

// Every call here is best-effort: a missing table (migration not yet run)
// or a database hiccup must never block a member's scan. Worst case the
// confirm step just reads the photo again, as it did before this cache.

export async function saveScanExtraction(userId: string, imageHash: string, result: ExtractionResult): Promise<void> {
  try {
    await sql`
      delete from receipt_scan_cache
      where user_id = ${userId} and created_at < now() - (${TTL_MINUTES} * interval '1 minute')
    `;
    await sql`
      insert into receipt_scan_cache (user_id, image_hash, extractor, parsed, confidence)
      values (${userId}, ${imageHash}, ${result.extractor}, ${JSON.stringify(result.parsed)}::jsonb, ${result.confidence})
      on conflict (user_id, image_hash) do update
        set extractor = excluded.extractor, parsed = excluded.parsed, confidence = excluded.confidence, created_at = now()
    `;
  } catch (err) {
    console.error('Could not save scan preview extraction', err);
  }
}

export async function loadScanExtraction(userId: string, imageHash: string): Promise<ExtractionResult | null> {
  try {
    const rows = (await sql`
      select extractor, parsed, confidence from receipt_scan_cache
      where user_id = ${userId} and image_hash = ${imageHash}
        and created_at >= now() - (${TTL_MINUTES} * interval '1 minute')
    `) as Array<{ extractor: ReceiptExtractor; parsed: ParsedReceipt; confidence: string }>;
    if (rows.length === 0) return null;
    return { extractor: rows[0].extractor, parsed: rows[0].parsed, confidence: Number(rows[0].confidence) };
  } catch (err) {
    console.error('Could not load scan preview extraction', err);
    return null;
  }
}

export async function clearScanExtraction(userId: string, imageHash: string): Promise<void> {
  try {
    await sql`delete from receipt_scan_cache where user_id = ${userId} and image_hash = ${imageHash}`;
  } catch (err) {
    console.error('Could not clear scan preview extraction', err);
  }
}
