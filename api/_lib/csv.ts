// Minimal CSV serialization for the course-admin "pull a report" export —
// RFC 4180 quoting (wrap in quotes, double up any embedded quotes) for any
// cell containing a comma, quote, or newline.
export function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  const escapeCell = (cell: string | number | null): string => {
    const s = cell === null || cell === undefined ? '' : String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return lines.join('\r\n');
}
