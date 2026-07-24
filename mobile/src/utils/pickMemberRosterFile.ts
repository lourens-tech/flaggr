import * as DocumentPicker from 'expo-document-picker';

const ROSTER_MIME_TYPES = [
  // CSV
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'text/plain',
  // Excel
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
const MAX_FILE_BYTES = 3_000_000;
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export class MemberRosterFileError extends Error {}

export interface PickedRosterFile {
  fileName: string;
  base64: string;
}

// Pure-JS base64 encoder (no reliance on `btoa`, which isn't guaranteed
// available in the React Native JS engine) so this works identically on web
// and native.
function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const chunk = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    result += BASE64_CHARS[(chunk >> 18) & 0x3f];
    result += BASE64_CHARS[(chunk >> 12) & 0x3f];
    result += b1 !== undefined ? BASE64_CHARS[(chunk >> 6) & 0x3f] : '=';
    result += b2 !== undefined ? BASE64_CHARS[chunk & 0x3f] : '=';
  }
  return result;
}

// Reads the picked file's raw bytes via fetch(uri) — the picker's uri is a
// blob: URL on web and a file:// URI on native, and RN's fetch polyfill can
// read both directly — then base64-encodes them ourselves rather than
// relying on the picker's own (web-only) base64 option, so the same code
// path works for both CSV and Excel on every platform.
export async function pickMemberRosterFile(): Promise<PickedRosterFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ROSTER_MIME_TYPES });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (typeof asset.size === 'number' && asset.size > MAX_FILE_BYTES) {
    throw new MemberRosterFileError('That file is too large — please upload a file under 3MB.');
  }

  const buffer = await (await fetch(asset.uri)).arrayBuffer();
  return { fileName: asset.name, base64: bytesToBase64(new Uint8Array(buffer)) };
}
