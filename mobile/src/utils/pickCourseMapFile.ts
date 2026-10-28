import * as DocumentPicker from 'expo-document-picker';

// A course map file is mostly coordinates; Strand's is about 120 KB.
const MAX_FILE_BYTES = 3_000_000;

export class CourseMapFileError extends Error {}

/** Lets a super admin choose a course map file (course-maps/<slug>.json, made
 * by scripts/course-maps/build.ts) and returns its text. */
export async function pickCourseMapFile(): Promise<{ fileName: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'] });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (typeof asset.size === 'number' && asset.size > MAX_FILE_BYTES) {
    throw new CourseMapFileError('That file is too large to be a course map.');
  }
  // The picker's uri is a blob: URL on web and a file:// URI on native; RN's fetch reads both.
  const text = await (await fetch(asset.uri)).text();
  return { fileName: asset.name, text };
}
