import Anthropic from '@anthropic-ai/sdk';
import type { ParsedReceipt } from './receiptParser';

// Reads a receipt photo with Claude's vision model and returns the same
// ParsedReceipt shape the Tesseract + regex path produces, so everything
// downstream (pointsEngine matching, duplicate checks, fraud checks) is
// unchanged. Enabled by RECEIPT_EXTRACTOR=claude (see scanPipeline.ts);
// scanPipeline falls back to Tesseract whenever this throws.

const DEFAULT_MODEL = 'claude-opus-5';

// Claude gives a legibility judgement rather than a numeric OCR score;
// these map it onto the 0-100 scale fraudChecks.ts's LOW_CONFIDENCE_THRESHOLD
// (55) was written for, so a hard-to-read slip still gets flagged for review.
const LEGIBILITY_CONFIDENCE: Record<Legibility, number> = { high: 95, medium: 70, low: 35 };

type Legibility = 'high' | 'medium' | 'low';

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };

const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'is_receipt',
    'legibility',
    'merchant_name',
    'lines',
    'receipt_number',
    'transaction_number',
    'till_number',
    'date',
    'time',
    'items',
    'subtotal',
    'vat',
    'grand_total',
  ],
  properties: {
    is_receipt: { type: 'boolean' },
    legibility: { type: 'string', enum: ['high', 'medium', 'low'] },
    merchant_name: nullableString,
    lines: { type: 'array', items: { type: 'string' } },
    receipt_number: nullableString,
    transaction_number: nullableString,
    till_number: nullableString,
    date: nullableString,
    time: nullableString,
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'quantity', 'price'],
        properties: {
          description: { type: 'string' },
          quantity: { type: 'number' },
          price: { type: 'number' },
        },
      },
    },
    subtotal: nullableNumber,
    vat: nullableNumber,
    grand_total: nullableNumber,
  },
} as const;

interface ClaudeReceiptJson {
  is_receipt: boolean;
  legibility: Legibility;
  merchant_name: string | null;
  lines: string[];
  receipt_number: string | null;
  transaction_number: string | null;
  till_number: string | null;
  date: string | null;
  time: string | null;
  items: Array<{ description: string; quantity: number; price: number }>;
  subtotal: number | null;
  vat: number | null;
  grand_total: number | null;
}

const SYSTEM_PROMPT = `You read photos of till slips from South African golf clubs (pro shops, halfway houses, bars, restaurants) and transcribe them into structured data. The data decides how many loyalty points a member earns, so only report what is actually printed on the slip — never guess or invent a value.

Field guidance:
- is_receipt: false if the image is not a purchase receipt or slip at all. legibility: how confidently you could read the slip overall.
- merchant_name: the venue or business name as printed (usually near the top), not the address or a generic header like "TAX INVOICE".
- lines: every printed line of text, top to bottom, exactly as printed.
- receipt_number: the receipt, invoice or slip number (labels vary: "Invoice No", "Tax Invoice Nr", "Receipt #", "Slip No"). transaction_number and till_number likewise, when printed.
- date as YYYY-MM-DD and time as HH:MM (24-hour). South African slips usually print dates day-first.
- items: each purchased line item. quantity defaults to 1. price is the line total in Rand for that item, as a number. A leading number that is part of the product name ("9 Hole Round", "3 Wood", "56 Wedge") is not a quantity. An item marked PAID, PREPAID, COMP or charged to a member account has price 0.
- Do not list totals, VAT, tenders, change, card or payment lines, tips or loyalty/points lines as items.
- subtotal, vat and grand_total as numbers when printed, else null. grand_total is the amount due, never the cash tendered.
- Use null for anything not printed or not legible.`;

export class ClaudeExtractionError extends Error {}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

const DATA_URI = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/s;

export interface ClaudeReceiptResult {
  parsed: ParsedReceipt;
  confidence: number; // 0-100, mapped from Claude's legibility judgement
  isReceipt: boolean;
  model: string;
}

export async function extractReceiptWithClaude(imageDataUri: string): Promise<ClaudeReceiptResult> {
  const match = imageDataUri.match(DATA_URI);
  if (!match) throw new ClaudeExtractionError('Unsupported image data URI');
  const mediaType = (match[1] === 'image/jpg' ? 'image/jpeg' : match[1]) as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

  const model = process.env.RECEIPT_EXTRACTION_MODEL || DEFAULT_MODEL;
  const response = await getClient().beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: (process.env.RECEIPT_EXTRACTION_EFFORT as 'low' | 'medium' | 'high' | undefined) || 'medium',
      format: { type: 'json_schema', schema: RECEIPT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: match[2] } },
          { type: 'text', text: 'Transcribe this slip.' },
        ],
      },
    ],
  },
  // api/receipts runs with a 60s maxDuration (vercel.json) — capping the
  // call (no retries — a retried timeout would double it) leaves room for
  // the Tesseract fallback if Claude is slow or unavailable.
  { timeout: 25_000, maxRetries: 0 });

  if (response.stop_reason !== 'end_turn') {
    throw new ClaudeExtractionError(`Claude extraction stopped early: ${response.stop_reason}`);
  }
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new ClaudeExtractionError('Claude returned no text block');

  let json: ClaudeReceiptJson;
  try {
    json = JSON.parse(text.text) as ClaudeReceiptJson;
  } catch {
    throw new ClaudeExtractionError('Claude returned invalid JSON');
  }

  const lines = json.lines.map((l) => l.trim()).filter(Boolean);
  const parsed: ParsedReceipt = {
    merchantNameGuess: json.merchant_name,
    rawLines: lines,
    receiptNumber: json.receipt_number,
    transactionNumber: json.transaction_number,
    tillNumber: json.till_number,
    date: json.date,
    time: json.time,
    items: json.is_receipt
      ? json.items
          .map((i) => ({ description: i.description.trim(), quantity: i.quantity > 0 ? i.quantity : 1, price: i.price }))
          .filter((i) => i.description.length >= 2 && Number.isFinite(i.price))
      : [],
    subtotal: json.subtotal,
    vat: json.vat,
    grandTotal: json.is_receipt ? json.grand_total : null,
  };

  return { parsed, confidence: LEGIBILITY_CONFIDENCE[json.legibility] ?? 35, isReceipt: json.is_receipt, model: response.model };
}
