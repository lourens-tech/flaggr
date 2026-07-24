import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { csvToTable, parseMemberRosterTable, type MemberRosterRow } from './memberRoster';

// Kept in its own module, separate from memberRoster.ts, so the heavy
// xlsx/pdf-parse dependencies only get bundled into the admin route that
// actually handles file uploads — not into api/auth/signup.ts, which only
// needs memberRoster.ts's plain DB-backed matchesRoster().
export type RosterFileFormat = 'csv' | 'xlsx' | 'pdf';

const EXTENSION_FORMAT: Record<string, RosterFileFormat> = {
  csv: 'csv',
  xlsx: 'xlsx',
  xls: 'xlsx',
  pdf: 'pdf',
};

export function detectRosterFileFormat(fileName: string): RosterFileFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_FORMAT[ext] ?? null;
}

function xlsxBufferToTable(buffer: Buffer): string[][] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' });
  return rows.map((row) => row.map((cell) => String(cell ?? '').trim()));
}

function largestTable(tables: string[][][]): string[][] {
  return tables.reduce((best, t) => (t.length > best.length ? t : best), [] as string[][]);
}

// PDFs have no real "cells" — pdf-parse's getTable() only finds rows when
// the PDF has actual drawn table borders/gridlines (common for a roster
// "printed to PDF" with gridlines shown). When that fails (plain text-flow
// PDF, no borders), fall back to getText() and treat it as comma-delimited —
// works when the roster's columns were comma-separated in the source, but
// not for space-aligned columns without commas, since PDF text extraction
// collapses runs of whitespace and loses per-cell layout.
async function pdfBufferToTable(buffer: Buffer): Promise<string[][]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const tableResult = await parser.getTable();
    const merged = largestTable(tableResult.mergedTables ?? []);
    if (merged.length > 1) return merged;

    const textResult = await parser.getText();
    return csvToTable(textResult.text);
  } finally {
    await parser.destroy();
  }
}

export async function parseMemberRosterFile(fileName: string, fileBase64: string): Promise<MemberRosterRow[]> {
  const format = detectRosterFileFormat(fileName);
  if (!format) {
    throw new Error('Unsupported file type — please upload a CSV, Excel (.xlsx), or PDF file.');
  }
  const buffer = Buffer.from(fileBase64, 'base64');

  let table: string[][];
  if (format === 'csv') {
    table = csvToTable(buffer.toString('utf-8'));
  } else if (format === 'xlsx') {
    table = xlsxBufferToTable(buffer);
  } else {
    table = await pdfBufferToTable(buffer);
    if (table.length === 0) {
      throw new Error("Couldn't find a table in that PDF — try a PDF with visible table borders, or export as CSV or Excel instead.");
    }
  }
  return parseMemberRosterTable(table);
}
