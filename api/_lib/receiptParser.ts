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
  // Every OCR'd line, trimmed of blanks — used by pointsEngine.ts to search
  // the whole slip for a known club's name rather than trust a single
  // positional guess (see matchMerchantAcrossLines there).
  rawLines: string[];
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

// Summary/payment/metadata lines conventionally lead with their keyword
// ("TOTAL:", "VAT 15%", "CASH TENDERED", "VISA **** 1234", "MEMBER NO:",
// "BALANCE DUE") — anchoring to the start of the line (rather than matching
// the keyword anywhere) means a real item that merely mentions one of these
// words later in its name, e.g. a "Titleist Card Holder", isn't mistaken for
// a summary line and dropped. The list is deliberately broad — it only ever
// suppresses a line from being read as a purchasable item, so a false
// positive here just means one fewer noise line getting misread as an item,
// never a real item being scored wrong.
const skipLinePattern =
  /^\s*(?:sub\s*-?\s*total|vat\s*no|vat|tax|grand\s*total|nett?\s*total|amount\s*due|balance\s*due|total\s*due|total|receipt|invoice|trans|till|register|thank you|change|cash|card|visa|mastercard|eft|debit|credit|balance|account|acc\.?\s*no|member\s*(?:no|number)?|loyalty|points?\s*earned|signature|approved|auth(?:oris|oriz)ation|operator|cashier|served\s*by|waiter|table|covers|customer|copy|duplicate|original|qty\s+description|description\s+amount|date|time|tel|www\.|reg(?:istration)?\s*no|tip|gratuity|service\s*charge|delivery|levy|surcharge|round(?:ing)?|tender|terminal|merchant\s*copy)/i;

// Some tills print an "R" / "ZAR" / "$" right against the amount instead of
// leaving it implicit — consumed here so it never leaks into the item
// description or breaks a price-only line from being recognised as one.
const CURRENCY_PREFIX = /(?:R|ZAR|\$)\s*/;
const itemLinePattern = new RegExp(`^(.+?)\\s+(?:${CURRENCY_PREFIX.source})?${PRICE.source}$`);
const priceOnlyLinePattern = new RegExp(`^(?:${CURRENCY_PREFIX.source})?${PRICE.source}$`);

// A leading number is usually a quantity prefix ("2 FootJoy Glove") UNLESS
// what follows names something where the number is part of the product
// itself, not a multiplier — hole counts ("9 Hole Round") and club/loft
// descriptors ("3 Wood", "56 Wedge", "10.5 Degree Driver") are the common
// golf-specific cases that would otherwise wildly inflate a matched
// product's points.
const QUANTITY_EXCEPTION = /^(?:holes?|irons?|woods?|wedges?|hybrids?|degrees?)\b/i;

function splitQuantity(raw: string): { quantity: number; description: string } {
  const leading = raw.match(/^(\d+)\s*[xX]?\s+(.+)$/);
  if (leading && !QUANTITY_EXCEPTION.test(leading[2])) {
    return { quantity: Number(leading[1]), description: leading[2] };
  }
  // Some POS layouts print the multiplier after the name instead of before
  // it: "Titleist Pro V1 Dozen x2" / "Titleist Pro V1 Dozen (2)".
  const trailing = raw.match(/^(.+?)\s*(?:[xX]\s*(\d+)|\((\d+)\))$/);
  if (trailing) {
    const qty = Number(trailing[2] ?? trailing[3]);
    if (qty > 0 && trailing[1].trim().length >= 2) {
      return { quantity: qty, description: trailing[1].trim() };
    }
  }
  return { quantity: 1, description: raw };
}

function toItem(descriptionRaw: string, priceRaw: string): ParsedLineItem | null {
  const price = parseAmount(priceRaw);
  const { quantity, description: splitDescription } = splitQuantity(descriptionRaw);
  const description = splitDescription.replace(/\s{2,}/g, ' ').trim();
  // price === 0 is a valid, meaningful read (a member billed the item to
  // their course account rather than paying at the till) — only a price
  // that failed to parse at all should drop the item. Scoring never uses
  // price anyway (see pointsEngine.ts): a matched catalog item earns its own
  // fixed/per-unit points regardless of what was actually paid for it.
  if (price === null || !description || description.length < 2) return null;
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

// A line that's entirely a date or a time (nothing else on it) — excluded
// from the name-only fallback below so a lone "03 Sep 2026" line, which does
// contain letters ("Sep"), doesn't get mistaken for an item name.
const DATE_OR_TIME_ONLY_LINE =
  /^\s*(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?)\s*$/i;

// Some clubs let a member charge their round/pro-shop items straight to
// their course account instead of paying at the till — the slip totals
// R0.00 and no line has a price on it at all, so extractItems (which needs
// a price to recognise a line as an item) naturally finds nothing. This
// fallback only runs when that happens: every remaining line that looks
// like a real item name, rather than a header/summary/date line, becomes a
// price-0 item instead. Scoring is unaffected either way — a matched
// catalog item earns its own fixed/per-unit points value, never derived
// from what (if anything) was actually paid for it (see pointsEngine.ts) —
// and an unmatched line just scores 0, so a stray non-item line slipping
// through here can't inflate points, only add a harmless zero-point row.
function extractNameOnlyItems(lines: string[], merchantNameGuess: string | null): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];
  for (const line of lines) {
    if (line === merchantNameGuess) continue;
    if (skipLinePattern.test(line)) continue;
    if (GENERIC_HEADER_LINE.test(line)) continue;
    if (DATE_OR_TIME_ONLY_LINE.test(line)) continue;
    if (!/[a-z]{2,}/i.test(line)) continue;

    const { quantity, description: splitDescription } = splitQuantity(line);
    const description = splitDescription.replace(/\s{2,}/g, ' ').trim();
    if (description.length < 2) continue;
    items.push({ description, quantity, price: 0 });
  }
  return items;
}

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

  // "Invoice No" / "Tax Invoice Nr" is at least as common as "Receipt No" on
  // South African tills — this used to only look for "receipt"/"slip",
  // which meant an invoice-numbered slip never got a receipt_number at all
  // (so it could never be blocked from being redeemed twice) and the
  // invoice-number line itself often got swept up as the "merchant name"
  // guess instead, garbled and all. "nr" (Afrikaans/common local
  // abbreviation for "number") is accepted anywhere "no" is.
  const NUMBER_LABEL = '(?:no\\.?|number|nr\\.?|#)';
  const receiptNumber = firstMatch(text, [
    new RegExp(`(?:tax\\s*)?invoice\\s*${NUMBER_LABEL}?\\s*[:\\-]?\\s*([A-Z0-9][A-Z0-9\\-\\/]{3,})`, 'i'),
    new RegExp(`receipt\\s*${NUMBER_LABEL}?\\s*[:\\-]?\\s*([A-Z0-9][A-Z0-9\\-\\/]{3,})`, 'i'),
    new RegExp(`slip\\s*${NUMBER_LABEL}?\\s*[:\\-]?\\s*([A-Z0-9][A-Z0-9\\-\\/]{3,})`, 'i'),
  ]);

  const transactionNumber = firstMatch(text, [new RegExp(`trans(?:action)?\\s*${NUMBER_LABEL}?\\s*[:\\-]?\\s*([A-Z0-9\\-\\/]{2,})`, 'i')]);

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
    new RegExp(`(?:nett?\\s*total|amount\\s*due|balance\\s*due|total\\s*due)[^\\d\\n]{0,30}${PRICE.source}`, 'i'),
    new RegExp(`\\btotal\\b[^\\d\\n]{0,30}${PRICE.source}`, 'i'),
  ]);

  const merchantNameGuess = guessMerchantName(lines);
  const items = extractItems(lines);
  const finalItems = items.length > 0 ? items : extractNameOnlyItems(lines, merchantNameGuess);

  return {
    merchantNameGuess,
    rawLines: lines,
    receiptNumber,
    transactionNumber,
    tillNumber,
    date,
    time,
    items: finalItems,
    subtotal,
    vat,
    grandTotal,
  };
}
