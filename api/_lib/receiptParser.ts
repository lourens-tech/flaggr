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

// Matches an amount with cents in either "1,779.05" (thousands=comma,
// decimal=period) or "1.779,05" (thousands=period, decimal=comma) form —
// South African tills print both depending on the POS system's locale.
// Whichever separator immediately precedes the final 2 digits is the
// decimal point; parseAmount below relies on that.
const PRICE = /(\d{1,3}(?:[,.\s]\d{3})*[.,]\d{2})/;

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseAmount(raw: string | null): number | null {
  if (!raw) return null;
  // The PRICE regex guarantees the string ends in [.,]\d{2} — treat that as
  // the decimal point and strip every other separator (thousands grouping,
  // in either comma, period, or space form) from what's left.
  const m = raw.match(/^(.*)[,.](\d{2})$/);
  if (!m) return null;
  const integerPart = m[1].replace(/[,.\s]/g, '');
  const value = Number(`${integerPart}.${m[2]}`);
  return Number.isFinite(value) ? value : null;
}

function findAmount(text: string, keywordPatterns: RegExp[]): number | null {
  for (const pattern of keywordPatterns) {
    const m = text.match(pattern);
    if (m?.[1]) return parseAmount(m[1]);
  }
  return null;
}

// Summary/payment lines conventionally lead with their keyword ("TOTAL:",
// "VAT 15%", "CASH TENDERED", "VISA **** 1234") — anchoring to the start of
// the line (rather than matching the keyword anywhere) means a real item
// that merely mentions one of these words later in its name, e.g. a
// "Titleist Card Holder", isn't mistaken for a summary line and dropped.
const skipLinePattern =
  /^\s*(?:sub\s*-?\s*total|vat|tax|grand\s*total|total|receipt|trans|till|thank you|change|cash|card|visa|mastercard)/i;
const itemLinePattern = new RegExp(`^(.+?)\\s+${PRICE.source}$`);
const priceOnlyLinePattern = new RegExp(`^${PRICE.source}$`);

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

function toItem(descriptionRaw: string, priceRaw: string): ParsedLineItem | null {
  const price = parseAmount(priceRaw);
  const { quantity, description: splitDescription } = splitQuantity(descriptionRaw);
  const description = splitDescription.replace(/\s{2,}/g, ' ').trim();
  if (!price || !description || description.length < 2) return null;
  return { description, quantity, price };
}

// Some POS layouts right-align the price in a column far enough from the
// description that OCR renders it as its own line rather than trailing the
// description on the same line — the description and its price end up as
// two consecutive lines instead of one. Carrying the last description-only
// line forward and pairing it with the next price-only line recovers those
// items instead of silently dropping both halves.
function extractItems(lines: string[]): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];
  let pendingDescription: string | null = null;

  for (const line of lines) {
    if (skipLinePattern.test(line)) {
      pendingDescription = null;
      continue;
    }

    const sameLine = line.match(itemLinePattern);
    if (sameLine) {
      const [, descriptionRaw, priceRaw] = sameLine;
      const item = toItem(descriptionRaw, priceRaw);
      if (item) items.push(item);
      pendingDescription = null;
      continue;
    }

    const priceOnly = line.match(priceOnlyLinePattern);
    if (priceOnly) {
      if (pendingDescription) {
        const item = toItem(pendingDescription, priceOnly[1]);
        if (item) items.push(item);
      }
      pendingDescription = null;
      continue;
    }

    // A plausible wrapped description: has some letters, isn't just noise.
    pendingDescription = /[a-z]{2,}/i.test(line) ? line : null;
  }

  return items;
}

// Real receipts often lead with a logo (no OCR text), an address, or a
// generic header ("TAX INVOICE", "*** COPY ***") before the actual venue
// name — blindly taking the first line is wrong often enough to be worth
// skipping past obvious non-name noise first.
const GENERIC_HEADER_LINE = /^[\s*_=-]*(?:tax\s*invoice|invoice|receipt|slip|copy|original|duplicate)[\s*_=-]*$/i;

function guessMerchantName(lines: string[]): string | null {
  for (const line of lines) {
    if (line.length < 3) continue;
    if (!/[a-z]{2,}/i.test(line)) continue; // needs real letters, not just digits/symbols
    if (GENERIC_HEADER_LINE.test(line)) continue;
    return line;
  }
  return lines[0] ?? null;
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

  const items = extractItems(lines);
  const merchantNameGuess = guessMerchantName(lines);

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
