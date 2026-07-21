// Best-effort structured extraction from raw OCR text. Receipt layouts vary
// wildly and OCR output is noisy, so every field here is a heuristic — when
// nothing matches, the field comes back null/empty rather than throwing, and
// the caller decides how to handle a low-confidence or partial parse.

export interface ParsedLineItem {
  description: string;
  quantity: number;
  price: number;
}

export interface ParsedReceipt {
  merchantNameGuess: string | null;
  receiptNumber: string | null;
  transactionNumber: string | null;
  tillNumber: string | null;
  date: string | null;
  time: string | null;
  items: ParsedLineItem[];
  subtotal: number | null;
  vat: number | null;
  grandTotal: number | null;
}

// Matches both thousands-separated ("1,779.05") and plain ("1779.05") forms.
const PRICE = /(\d+(?:[,\s]\d{3})*(?:\.\d{2}))/;

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseAmount(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function findAmount(text: string, keywordPatterns: RegExp[]): number | null {
  for (const pattern of keywordPatterns) {
    const m = text.match(pattern);
    if (m?.[1]) return parseAmount(m[1]);
  }
  return null;
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const text = rawText;

  const receiptNumber = firstMatch(text, [
    /receipt\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/i,
    /slip\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/i,
  ]);

  const transactionNumber = firstMatch(text, [
    /trans(?:action)?\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9\-\/]{2,})/i,
  ]);

  const tillNumber = firstMatch(text, [/till\s*(?:no\.?|number|#)?\s*[:\-]?\s*(\d+)/i, /register\s*[:\-]?\s*(\d+)/i]);

  const date = firstMatch(text, [
    /\b(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b/,
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/,
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i,
  ]);

  const time = firstMatch(text, [/\b(\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm|AM|PM)?)\b/]);

  const subtotal = findAmount(text, [new RegExp(`sub\\s*-?\\s*total[^\\d\\n]{0,30}${PRICE.source}`, 'i')]);
  const vat = findAmount(text, [new RegExp(`\\b(?:vat|tax)\\b[^\\d\\n]{0,30}${PRICE.source}`, 'i')]);
  const grandTotal = findAmount(text, [
    new RegExp(`grand\\s*total[^\\d\\n]{0,30}${PRICE.source}`, 'i'),
    new RegExp(`\\btotal\\b[^\\d\\n]{0,30}${PRICE.source}`, 'i'),
  ]);

  const skipLinePattern = /sub\s*-?\s*total|\bvat\b|\btax\b|grand\s*total|\btotal\b|receipt|trans|till|thank you|change|cash|card|visa|mastercard/i;
  const itemLinePattern = new RegExp(`^(.+?)\\s+${PRICE.source}$`);

  // A leading number is a quantity prefix ("2 FootJoy Glove") UNLESS it's
  // immediately followed by "hole" — "9 Hole Round" / "18 Hole Round" are
  // golf activity names where the number isn't a multiplier.
  function splitQuantity(raw: string): { quantity: number; description: string } {
    const m = raw.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (m && !/^holes?\b/i.test(m[2])) {
      return { quantity: Number(m[1]), description: m[2] };
    }
    return { quantity: 1, description: raw };
  }

  const items: ParsedLineItem[] = [];
  for (const line of lines) {
    if (skipLinePattern.test(line)) continue;
    const m = line.match(itemLinePattern);
    if (!m) continue;
    const [, descriptionRaw, priceRaw] = m;
    const price = parseAmount(priceRaw);
    const { quantity, description: splitDescription } = splitQuantity(descriptionRaw);
    const description = splitDescription.replace(/\s{2,}/g, ' ').trim();
    if (!price || !description || description.length < 2) continue;
    items.push({ description, quantity, price });
  }

  // First non-empty line is usually the store/course name on most receipt
  // layouts — used as a fallback when it doesn't fuzzy-match a known merchant.
  const merchantNameGuess = lines[0] ?? null;

  return {
    merchantNameGuess,
    receiptNumber,
    transactionNumber,
    tillNumber,
    date,
    time,
    items,
    subtotal,
    vat,
    grandTotal,
  };
}
