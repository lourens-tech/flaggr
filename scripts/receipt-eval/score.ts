import { similarity, normalize } from '../../api/_lib/matching';
import type { ParsedReceipt } from '../../api/_lib/receiptParser';

// The hand-checked answer for one fixture image. A field that's omitted
// isn't scored; a field set to null means "not printed on this slip", so
// the extractor is correct only if it also returns null.
export interface ExpectedReceipt {
  verified?: boolean;
  notes?: string;
  merchantName?: string | null;
  receiptNumber?: string | null;
  date?: string | null; // YYYY-MM-DD
  time?: string | null; // HH:MM, 24-hour
  items?: Array<{ description: string; quantity: number; price: number }>;
  subtotal?: number | null;
  vat?: number | null;
  grandTotal?: number | null;
}

export const FIELDS = ['merchantName', 'receiptNumber', 'date', 'time', 'subtotal', 'vat', 'grandTotal'] as const;
export type FieldName = (typeof FIELDS)[number];

export interface ItemScore {
  expected: number;
  extracted: number;
  matched: number;
}

export interface ReceiptScore {
  fields: Partial<Record<FieldName, boolean>>;
  items: ItemScore | null;
  allCorrect: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// The Tesseract path returns dates exactly as printed; South African slips
// print them day-first, so an ambiguous d/m/y is read that way.
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS.includes(m[1])) return iso(+m[3], MONTHS.indexOf(m[1]) + 1, +m[2]);
  m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/);
  if (m && MONTHS.includes(m[2])) return iso(+m[3], MONTHS.indexOf(m[2]) + 1, +m[1]);
  return null;
}

export function normalizeTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/);
  if (!m) return null;
  let h = +m[1];
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function normalizeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s || null;
}

function amountsEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) <= 0.01;
}

const MERCHANT_MIN_SIMILARITY = 0.8;
const ITEM_MIN_SIMILARITY = 0.7;

function scoreField(field: FieldName, expected: ExpectedReceipt, got: ParsedReceipt): boolean {
  switch (field) {
    case 'merchantName': {
      const e = expected.merchantName ?? null;
      const g = got.merchantNameGuess;
      if (!e || !g) return !e && !g;
      return similarity(e, g) >= MERCHANT_MIN_SIMILARITY;
    }
    case 'receiptNumber':
      return normalizeId(expected.receiptNumber) === normalizeId(got.receiptNumber);
    case 'date':
      return normalizeDate(expected.date) === normalizeDate(got.date);
    case 'time':
      return normalizeTime(expected.time) === normalizeTime(got.time);
    case 'subtotal':
      return amountsEqual(expected.subtotal, got.subtotal);
    case 'vat':
      return amountsEqual(expected.vat, got.vat);
    case 'grandTotal':
      return amountsEqual(expected.grandTotal, got.grandTotal);
  }
}

// An expected item counts as found when an extracted item has the same
// quantity and price and a close-enough description; each extracted item
// can satisfy only one expected item.
function scoreItems(expected: NonNullable<ExpectedReceipt['items']>, got: ParsedReceipt['items']): ItemScore {
  const used = new Set<number>();
  let matched = 0;
  for (const e of expected) {
    let best = -1;
    let bestSim = ITEM_MIN_SIMILARITY;
    got.forEach((g, i) => {
      if (used.has(i) || g.quantity !== e.quantity || !amountsEqual(g.price, e.price)) return;
      const sim = normalize(g.description) === normalize(e.description) ? 1 : similarity(g.description, e.description);
      if (sim >= bestSim) {
        best = i;
        bestSim = sim;
      }
    });
    if (best >= 0) {
      used.add(best);
      matched++;
    }
  }
  return { expected: expected.length, extracted: got.length, matched };
}

export function scoreReceipt(expected: ExpectedReceipt, got: ParsedReceipt): ReceiptScore {
  const fields: Partial<Record<FieldName, boolean>> = {};
  for (const field of FIELDS) {
    if (field in expected) fields[field] = scoreField(field, expected, got);
  }
  const items = expected.items ? scoreItems(expected.items, got.items) : null;
  const itemsCorrect = !items || (items.matched === items.expected && items.extracted === items.expected);
  return { fields, items, allCorrect: itemsCorrect && Object.values(fields).every(Boolean) };
}
