import { Platform, Share } from 'react-native';

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

// Web: triggers a direct file download. Native has no filesystem download
// prompt to hook into here, so it falls back to the system share sheet —
// the admin can send the CSV text on via Mail, Notes, AirDrop, etc.
export async function exportCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: csv });
}
