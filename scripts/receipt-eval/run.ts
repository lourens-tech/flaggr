// Scores the receipt extractors against hand-checked fixtures.
//
//   npm run eval:receipts                       # both extractors
//   npm run eval:receipts -- --extractor claude
//   npm run eval:receipts -- --include-unverified --dir path/to/fixtures
//
// See scripts/receipt-eval/README.md for the fixture format.

import fs from 'node:fs';
import path from 'node:path';
import { extractReceipt, type ReceiptExtractor } from '../../api/_lib/receiptExtraction';
import { extractReceiptWithClaude } from '../../api/_lib/claudeReceipt';
import type { ParsedReceipt } from '../../api/_lib/receiptParser';
import { FIELDS, scoreReceipt, type ExpectedReceipt, type ReceiptScore } from './score';

const IMAGE_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const dir = path.resolve(arg('dir') ?? 'scripts/receipt-eval/fixtures');
const extractorArg = arg('extractor') ?? 'both';
const extractors: ReceiptExtractor[] = extractorArg === 'both' ? ['tesseract', 'claude'] : [extractorArg as ReceiptExtractor];
const includeUnverified = process.argv.includes('--include-unverified');
const outPath = path.resolve(arg('out') ?? path.join(dir, '..', 'results.json'));

interface Fixture {
  name: string;
  dataUri: string;
  expected: ExpectedReceipt;
}

function loadFixtures(): Fixture[] {
  if (!fs.existsSync(dir)) {
    console.error(`No fixtures directory at ${dir} — see scripts/receipt-eval/README.md`);
    process.exit(1);
  }
  const fixtures: Fixture[] = [];
  let skipped = 0;
  for (const file of fs.readdirSync(dir).sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_TYPES[ext]) continue;
    const name = path.basename(file, path.extname(file));
    const expectedPath = path.join(dir, `${name}.expected.json`);
    if (!fs.existsSync(expectedPath)) {
      console.warn(`skipping ${file}: no ${name}.expected.json`);
      continue;
    }
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8')) as ExpectedReceipt;
    if (!expected.verified && !includeUnverified) {
      skipped++;
      continue;
    }
    const data = fs.readFileSync(path.join(dir, file)).toString('base64');
    fixtures.push({ name, dataUri: `data:${IMAGE_TYPES[ext]};base64,${data}`, expected });
  }
  if (skipped) console.warn(`${skipped} unverified fixture(s) skipped (pass --include-unverified to score them anyway)`);
  return fixtures;
}

interface RunRecord {
  fixture: string;
  extractor: ReceiptExtractor;
  ok: boolean;
  error?: string;
  ms: number;
  score?: ReceiptScore;
  got?: Omit<ParsedReceipt, 'rawLines'>;
}

async function runOne(fixture: Fixture, extractor: ReceiptExtractor): Promise<RunRecord> {
  const started = Date.now();
  try {
    // Claude is called directly (not via extractReceipt) so a failure shows
    // up as a failure here instead of silently falling back to Tesseract.
    const parsed =
      extractor === 'claude'
        ? (await extractReceiptWithClaude(fixture.dataUri)).parsed
        : (await extractReceipt(fixture.dataUri, 'tesseract')).parsed;
    const ms = Date.now() - started;
    const { rawLines: _rawLines, ...got } = parsed;
    return { fixture: fixture.name, extractor, ok: true, ms, score: scoreReceipt(fixture.expected, parsed), got };
  } catch (err) {
    return { fixture: fixture.name, extractor, ok: false, error: String(err), ms: Date.now() - started };
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${((n / d) * 100).toFixed(0)}% (${n}/${d})`;
}

function summarize(records: RunRecord[]) {
  const rows: Record<string, Record<string, string>> = {};
  for (const extractor of extractors) {
    const runs = records.filter((r) => r.extractor === extractor);
    const scored = runs.filter((r) => r.ok && r.score);
    const row: Record<string, string> = {};
    for (const field of FIELDS) {
      const withField = scored.filter((r) => r.score!.fields[field] !== undefined);
      row[field] = pct(withField.filter((r) => r.score!.fields[field]).length, withField.length);
    }
    const items = scored.map((r) => r.score!.items).filter((i) => i !== null);
    const matched = items.reduce((s, i) => s + i!.matched, 0);
    row['items recall'] = pct(matched, items.reduce((s, i) => s + i!.expected, 0));
    row['items precision'] = pct(matched, items.reduce((s, i) => s + i!.extracted, 0));
    row['fully correct'] = pct(scored.filter((r) => r.score!.allCorrect).length, runs.length);
    row['failures'] = String(runs.length - scored.length);
    row['avg seconds'] = runs.length ? (runs.reduce((s, r) => s + r.ms, 0) / runs.length / 1000).toFixed(1) : '—';
    rows[extractor] = row;
  }
  console.table(rows);
}

async function main() {
  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.error('No verified fixtures to score.');
    process.exit(1);
  }
  console.log(`Scoring ${fixtures.length} receipt(s) with: ${extractors.join(', ')}`);
  const records: RunRecord[] = [];
  for (const fixture of fixtures) {
    for (const extractor of extractors) {
      const record = await runOne(fixture, extractor);
      records.push(record);
      const status = !record.ok ? `FAILED (${record.error})` : record.score!.allCorrect ? 'all correct' : 'mismatches';
      console.log(`  ${fixture.name} [${extractor}] ${status} — ${(record.ms / 1000).toFixed(1)}s`);
    }
  }
  summarize(records);
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
  console.log(`Per-receipt details written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
