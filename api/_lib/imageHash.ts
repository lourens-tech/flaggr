import { createHash } from 'node:crypto';

// SHA-256 over the decoded image bytes. This catches byte-for-byte
// resubmission of the exact same photo (screenshot of a previous scan,
// re-uploading the same file under a new account, etc). It does NOT catch a
// photo of the same receipt taken again or lightly edited — that needs
// perceptual/near-duplicate image hashing (e.g. pHash), which is a real
// image-processing feature left for a future enhancement.
export function hashImageDataUri(imageDataUri: string): string {
  const base64 = imageDataUri.includes(',') ? imageDataUri.split(',')[1] : imageDataUri;
  const buffer = Buffer.from(base64, 'base64');
  return createHash('sha256').update(buffer).digest('hex');
}
