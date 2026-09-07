import * as XLSX from 'xlsx';

// The report-export equivalent of the old csv.ts's toCsv — every
// course-admin/super-admin "download this report" button produces a real
// .xlsx workbook (via the same `xlsx` library already used to *read*
// uploaded member rosters, see memberRosterFileParsing.ts) rather than a
// plain-text CSV, so it opens straight into Excel with no import step.
export function toXlsxBuffer(
  header: string[],
  rows: Array<Array<string | number | null>>,
  sheetName: string = 'Report',
): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    header,
    ...rows.map((row) => row.map((cell) => (cell === null ? '' : cell))),
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
