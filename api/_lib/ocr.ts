import { createWorker, PSM } from 'tesseract.js';
import { Jimp } from 'jimp';

export interface OcrResult {
  text: string;
  confidence: number; // 0-100
}

function dataUriToBuffer(dataUri: string): Buffer {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  return Buffer.from(base64, 'base64');
}

// Receipts are narrow and low-contrast (thermal print, often photographed at
// a slight angle under uneven lighting) — very different from the full-page
// documents Tesseract's defaults assume. Grayscale + histogram normalization
// gives Tesseract's own internal binarization step a cleaner image to work
// with; this is a deliberately conservative preprocessing pass (no manual
// contrast/threshold tuning) so it doesn't risk overcorrecting an
// already-well-lit photo.
async function preprocess(imageDataUri: string): Promise<Buffer> {
  const image = await Jimp.read(dataUriToBuffer(imageDataUri));
  image.greyscale().normalize();
  return image.getBuffer('image/png');
}

// tesseract.js accepts a data URI directly and decodes it itself, but we
// preprocess first (see above) and hand it a decoded buffer instead. Runs
// entirely in-process (WASM), no external OCR account/API key required; on
// first cold start it fetches the English language model from tesseract.js's
// CDN, which Vercel's serverless runtime can reach even though this repo's
// own dev sandbox can't.
export async function runOcr(imageDataUri: string): Promise<OcrResult> {
  const preprocessed = await preprocess(imageDataUri);
  const worker = await createWorker('eng');
  try {
    // SINGLE_COLUMN matches a receipt's actual layout — one narrow column of
    // text — far better than the default "fully automatic page segmentation"
    // mode, which is tuned for multi-column documents.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    const { data } = await worker.recognize(preprocessed);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}
