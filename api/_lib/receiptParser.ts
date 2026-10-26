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
  // Where grandTotal came from: the slip's own TOTAL line, or — when OCR
  // couldn't read one — worked out from how it was paid (amount tendered
  // less change, or the card/account/cash payment lines), or the "Taxable
  // Total" line as a last resort. null when no total could be found at all.
  totalSource: 'total' | 'payment' | 'taxable' | null;
}

// Matches an amount with cents in either "1,779.05" (thousands=comma,
// decimal=period) or "1.779,05" (thousands=period, decimal=comma) form —
// South African tills print both depending on the POS system's locale.
// Whichever separator immediately precedes the final 2 digits is the
// decimal point; parseAmount below relies on that. Amounts of R1000+ printed
// without grouping ("R1280.00") take the second branch — with only the first,
// the match skipped the leading digit and read 280.
const PRICE = /(\d{1,3}(?:[,.\s]\d{3})+[.,]\d{2}|\d+[.,]\d{2})/;

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
  /^\s*(?:sub\s*-?\s*total|vat\s*no|vat|tax|grand\s*total|nett?\s*total|amount|balance\s*due|total\s*due|total|receipt|invoice|trans|till|register|thank you|change|cash|card|visa|mastercard|eft|debit|credit|balance|account|on\s*account|acc\.?\s*no|member\s*(?:no|number)?|loyalty|points?\s*earned|signature|approved|auth(?:oris|oriz)ation|operator|cashier|served\s*by|waiter|table|covers|customer|copy|duplicate|original|qty\s+description|description\s+amount|date|time|tel|www\.|reg(?:istration)?\s*no|tip|gratuity|service\s*charge|delivery|levy|surcharge|round(?:ing)?|tender|terminal|merchant\s*copy|rate\b|discount|current|previous|new\s+account|voucher|credits?\s*used|valid\s*on|player\s*name|tee-?\s*off|starting\s*hole)/i;

// Payment, balance and VAT lines whose keyword isn't the first word — "Amount
// Tendered", "Current Account Balance", "Gratuity Paid", "VAT Included",
// "Taxable Total", "Discount Received" — and OCR misreads of them ("Anount
// Tendered"). Checked anywhere in the line: none of these phrases is ever part
// of a real product name, and on real slips every one of them was being read
// as an extra purchase, so a R40 slip could score R40 for the item plus R40
// again for "Amount Tendered".
const nonItemAnywherePattern =
  /\b(?:tender\w*|amount\s*paid|gratuity|vat\s*incl\w*|incl\w*\s*vat|taxable|discount|account\s*bal\w*|balance|on\s*account|voucher\w*|credits?\s*used|snapscan|zapper|speedpoint|yoco|handicap)\b/i;

// A line that carries a full date ("Wednesday, 02 September 2026",
// "02/09/2026") is a header or a voucher's validity line, never an item —
// even when OCR glues a stray amount onto the end of it.
const fullDatePattern =
  /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b|\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/i;

const isNonItemLine = (line: string) =>
  skipLinePattern.test(line) || nonItemAnywherePattern.test(line) || fullDatePattern.test(line);

// Some tills print an "R" / "ZAR" / "$" right against the amount instead of
// leaving it implicit — consumed here so it never leaks into the item
// description or breaks a price-only line from being recognised as one.
const CURRENCY_PREFIX = /(?:R|ZAR|\$)\s*/;
const itemLinePattern = new RegExp(`^(.+?)\\s+(?:${CURRENCY_PREFIX.source})?${PRICE.source}$`);
const priceOnlyLinePattern = new RegExp(`^(?:${CURRENCY_PREFIX.source})?${PRICE.source}$`);

// Some tills mark an already-settled item with a word instead of a "0.00"
// amount — a round paid for in advance, or comped by the pro shop. Checked
// only as a fallback once the numeric patterns above have had first shot, so
// a line that happens to include one of these words *and* a real price
// (rare, but possible) still scores off the real price.
const PAID_MARKER = /(?:pre-?paid|paid|comp(?:limentary)?|n\/c|no\s*charge)/i;
const itemPaidLinePattern = new RegExp(`^(.+?)\\s+${PAID_MARKER.source}\\s*$`, 'i');
const paidOnlyLinePattern = new RegExp(`^${PAID_MARKER.source}\\s*$`, 'i');

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
  // price === 0 is a valid, meaningful read (a pre-paid round, or an item
  // billed to the member's course account) — only a price that failed to
  // parse at all should drop the item. Points come from the slip's total
  // whenever one can be read (see finalizePoints in pointsEngine.ts); line
  // items only decide points on a slip with no readable total.
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
    if (isNonItemLine(line)) {
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

    const paidSameLine = line.match(itemPaidLinePattern);
    if (paidSameLine) {
      const item = toItem(paidSameLine[1], '0.00');
      if (item) items.push(item);
      pendingDescription = null;
      continue;
    }

    if (paidOnlyLinePattern.test(line)) {
      if (pendingDescription) {
        const item = toItem(pendingDescription, '0.00');
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
// price-0 item instead. These only affect points on a slip with no readable
// total at all (see finalizePoints in pointsEngine.ts), and an unmatched line
// scores 0, so a stray non-item line slipping through here can't inflate
// points, only add a harmless zero-point row.
function extractNameOnlyItems(lines: string[], merchantNameGuess: string | null): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];
  for (const line of lines) {
    if (line === merchantNameGuess) continue;
    if (isNonItemLine(line)) continue;
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

// OCR of thermal slips often splits an amount around its decimal point —
// "TOTAL R40 .00", "Total R285 . 00", "40. 00" — which no amount pattern can
// read. On the pilot club's slips that hid the TOTAL line on most receipts, so
// points fell back to adding up every amount on the slip. Rejoined here
// before anything else reads the line, along with the "S" OCR reads for a 5
// straight after the Rand sign ("Amount Tendered: RS50.00" for R550.00).
function repairAmounts(line: string): string {
  return line
    .replace(/(\d)\s+([.,])\s*(\d{2})(?!\d)/g, '$1$2$3')
    .replace(/(\d[.,])\s+(\d{2})(?!\d)/g, '$1$2')
    .replace(/\bR[Ss](\d)/g, 'R5$1');
}

const PRICE_GLOBAL = new RegExp(PRICE.source, 'g');
// A line that is only an amount, give or take a currency prefix and a stray
// OCR mark — what follows a label whose amount the till printed (or OCR
// split) onto the next line, e.g. "TOTAL:" then "R285.00".
const AMOUNT_ONLY_LINE = new RegExp(`^\\W{0,3}(?:${CURRENCY_PREFIX.source})?${PRICE.source}\\W{0,3}$`);

// A Rand amount whose cents OCR couldn't read ("Total R757 (0)").
const WHOLE_RAND = /(?:^|[^a-z0-9])R\s?(\d{2,5})(?![\d.,])/i;

// The amount belonging to the first line that matches `label` (and not
// `exclude`): the last amount printed after the label on that line, or failing
// that an amount-only line directly below it. With `wholeRand`, an "R757"
// with unreadable cents on the label's own line counts too.
function findLabeledAmount(lines: string[], label: RegExp, exclude?: RegExp, wholeRand = false): number | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(label);
    if (!m || exclude?.test(line)) continue;
    const after = line.slice((m.index ?? 0) + m[0].length);
    const onLine = after.match(PRICE_GLOBAL);
    if (onLine) return parseAmount(onLine[onLine.length - 1]);
    const whole = wholeRand ? after.match(WHOLE_RAND) : null;
    if (whole) return Number(whole[1]);
    for (const next of lines.slice(i + 1, i + 3)) {
      const below = next.match(AMOUNT_ONLY_LINE);
      if (below) return parseAmount(below[1]);
    }
  }
  return null;
}

// "TOTAL", "Grand Total", "Nett Total", "Amount Due", "Balance Due", "To Pay"
// — at the start of the line, so "Taxable Total" and "Sub Total" don't count.
// The first branch tolerates the OCR misreads of "Total" seen on real slips
// ("fotal", "loti", "T0tal", "tota1").
const TOTAL_LABEL = /^\W*(?:(?:grand|nett?)\s*)?[tfl1][o0][t1l][a@i1l][l1i]?\b|^\W*(?:amount|balance|total)\s*due\b|^\W*to\s*pay\b/i;
// Total-labelled lines that aren't the bill: cash handed over, or a
// VAT/quantity/savings breakdown.
const NOT_THE_TOTAL = /t[o0]t[a@]l\s*(?:amount\s*)?tender|t[o0]t[a@]l\s*(?:excl|vat|tax|items?|qty|quantity|savings?|discount|points)/i;

// The amount actually paid for this slip — the figure points are based on.
// The TOTAL line is used whenever OCR can read it. Without one, it's worked
// out from how the slip was paid: amount tendered less change, or the
// card/account/cash payment lines. "Taxable Total" is a last resort: it never
// exceeds the bill, so it can only under-award, never over-award.
//
// Payment lines are where OCR slips most ("Tendered: RE40.00" for R640.00), so
// a payment-derived figure below what the slip's 15% VAT implies was taxed is
// discarded — nobody pays less than the taxable amount.
function findTotal(lines: string[], vat: number | null): { value: number; source: ParsedReceipt['totalSource'] } | null {
  const total = findLabeledAmount(lines, TOTAL_LABEL, NOT_THE_TOTAL, true);
  if (total !== null) return { value: total, source: 'total' };

  const change = findLabeledAmount(lines, /^\W*change\b/i) ?? 0;
  const taxedAtLeast = vat !== null ? (vat * 115) / 15 - 1 : 0;
  const plausible = (paid: number) => paid >= 0 && paid >= taxedAtLeast;

  const tendered = findLabeledAmount(lines, /tender\w*/i);
  if (tendered !== null && plausible(tendered - change)) return { value: tendered - change, source: 'payment' };

  const payments = [
    findLabeledAmount(lines, /^\W*(?:credit\s*|debit\s*)?(?:card|visa|mastercard|eft)\b/i),
    findLabeledAmount(lines, /^\W*(?:on\s*)?account\b/i, /balance|no\b|number/i),
    findLabeledAmount(lines, /^\W*cash\b/i),
  ].filter((v): v is number => v !== null);
  if (payments.length > 0) {
    const paid = payments.reduce((sum, v) => sum + v, 0) - change;
    if (plausible(paid)) return { value: paid, source: 'payment' };
  }

  const taxable = findLabeledAmount(lines, /^\W*taxable\s*t[o0]t[a@]l\b/i);
  if (taxable !== null) return { value: taxable, source: 'taxable' };
  return null;
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split('\n')
    .map((l) => repairAmounts(l.trim()))
    .filter(Boolean);
  const text = lines.join('\n');

  // "Invoice No" / "Tax Invoice Nr" is at least as common as "Receipt No" on
  // South African tills — this used to only look for "receipt"/"slip",
  // which meant an invoice-numbered slip never got a receipt_number at all
  // (so it could never be blocked from being redeemed twice) and the
  // invoice-number line itself often got swept up as the "merchant name"
  // guess instead, garbled and all. "nr" (Afrikaans/common local
  // abbreviation for "number") is accepted anywhere "no" is.
  const NUMBER_LABEL = '(?:no\\.?|number|nr\\.?|#)';
  // The number must sit on the same line as its label ([ \t], not \s, so a
  // bare "TAX INVOICE" header can't reach down to the next line) and must
  // contain a digit — otherwise the header's own next word ("Invoice No: …")
  // or a word like "APPROVED" gets read as the number.
  const ID = '((?=[A-Z0-9\\-\\/]*\\d)[A-Z0-9][A-Z0-9\\-\\/]{3,})';
  const SHORT_ID = '((?=[A-Z0-9\\-\\/]*\\d)[A-Z0-9\\-\\/]{2,})';
  const receiptNumber = firstMatch(text, [
    new RegExp(`(?:tax[ \\t]*)?invoice[ \\t]*${NUMBER_LABEL}?[ \\t]*[:\\-]?[ \\t]*${ID}`, 'i'),
    new RegExp(`receipt[ \\t]*${NUMBER_LABEL}?[ \\t]*[:\\-]?[ \\t]*${ID}`, 'i'),
    new RegExp(`slip[ \\t]*${NUMBER_LABEL}?[ \\t]*[:\\-]?[ \\t]*${ID}`, 'i'),
  ]);

  const transactionNumber = firstMatch(text, [
    new RegExp(`trans(?:action)?[ \\t]*${NUMBER_LABEL}?[ \\t]*[:\\-]?[ \\t]*${SHORT_ID}`, 'i'),
  ]);

  const tillNumber = firstMatch(text, [/till\s*(?:no\.?|number|#)?\s*[:\-]?\s*(\d+)/i, /register\s*[:\-]?\s*(\d+)/i]);

  const date = firstMatch(text, [
    /\b(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b/,
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/,
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i,
  ]);

  const time = firstMatch(text, [/\b(\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm|AM|PM)?)\b/]);

  const subtotal = findAmount(text, [new RegExp(`sub\\s*-?\\s*total[^\\d\\n]{0,30}${PRICE.source}`, 'i')]);
  // SA slips usually print the rate before the amount ("VAT 15% 271.37",
  // "VAT @ 15.00% 271.37", "VAT (15%) 271.37") — skip an optional rate so
  // its digits don't stop the match short of the actual VAT amount.
  const VAT_RATE = '(?:[^\\d\\n]{0,30}?\\d{1,2}(?:[.,]\\d+)?[ \\t]*%)?';
  // "Included @ 15% 78.26" counts too: OCR often drops the "VAT" before it.
  const vat = findAmount(text, [
    new RegExp(`\\b(?:vat|tax)\\b${VAT_RATE}[^\\d\\n]{0,30}${PRICE.source}`, 'i'),
    new RegExp(`\\bincl\\w*\\W{0,4}15\\s*%[^\\d\\n]{0,30}${PRICE.source}`, 'i'),
  ]);
  const total = findTotal(lines, vat);

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
    grandTotal: total?.value ?? null,
    totalSource: total?.source ?? null,
  };
}
