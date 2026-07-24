import * as DocumentPicker from 'expo-document-picker';

const CSV_MIME_TYPES = ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain', 'application/vnd.ms-excel'];
const MAX_FILE_BYTES = 2_000_000;

export class MemberRosterFileError extends Error {}

export interface PickedRosterFile {
  fileName: string;
  content: string;
}

// Reads the picked file's text content via fetch(uri) rather than
// expo-file-system — the picker's uri is a blob: URL on web and a file://
// URI on native, and RN's fetch polyfill can read both directly.
export async function pickMemberRosterCsv(): Promise<PickedRosterFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: CSV_MIME_TYPES });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (typeof asset.size === 'number' && asset.size > MAX_FILE_BYTES) {
    throw new MemberRosterFileError('That file is too large — please upload a CSV under 2MB.');
  }

  const content = await (await fetch(asset.uri)).text();
  return { fileName: asset.name, content };
}
