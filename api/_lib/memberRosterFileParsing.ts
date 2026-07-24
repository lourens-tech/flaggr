import * as XLSX from 'xlsx';
import { csvToTable, parseMemberRosterTable, type MemberRosterRow } from './memberRoster';

// Kept in its own module, separate from memberRoster.ts, so the xlsx
// dependency only gets bundled into the admin route that actually handles
// file uploads — not into api/auth/signup.ts, which only needs
// memberRoster.ts's plain DB-backed matchesRoster().
export type RosterFileFormat = 'csv' | 'xlsx';

const EXTENSION_FORMAT: Record<string, RosterFileFormat> = {
  csv: 'csv',
  xlsx: 'xlsx',
  xls: 'xlsx',
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

export async function parseMemberRosterFile(fileName: string, fileBase64: string): Promise<MemberRosterRow[]> {
  const format = detectRosterFileFormat(fileName);
  if (!format) {
    throw new Error('Unsupported file type — please upload a CSV or Excel (.xlsx) file.');
  }
  const buffer = Buffer.from(fileBase64, 'base64');

  const table = format === 'csv' ? csvToTable(buffer.toString('utf-8')) : xlsxBufferToTable(buffer);
  return parseMemberRosterTable(table);
}
