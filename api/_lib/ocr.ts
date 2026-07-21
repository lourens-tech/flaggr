import { recognize } from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number; // 0-100
}

// tesseract.js accepts a data URI directly and decodes it itself — no manual
// base64->Buffer step needed. Runs entirely in-process (WASM), no external
// OCR account/API key required; on first cold start it fetches the English
// language model from tesseract.js's CDN, which Vercel's serverless runtime
// can reach even though this repo's own dev sandbox can't.
export async function runOcr(imageDataUri: string): Promise<OcrResult> {
  const { data } = await recognize(imageDataUri, 'eng');
  return { text: data.text, confidence: data.confidence };
}
