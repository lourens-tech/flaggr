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

// Phone photos of a receipt can come in at very different resolutions —
// a tight, high-res crop vs. a small preview-quality shot. Tesseract's
// accuracy on small text drops sharply below roughly this size, so a small
// photo is upscaled first; a photo already bigger than this is left alone
// (upscaling an already-large image just wastes time).
const MIN_DIMENSION = 1200;

async function loadImage(imageDataUri: string) {
  const image = await Jimp.read(dataUriToBuffer(imageDataUri));
  const largestSide = Math.max(image.width, image.height);
  if (largestSide > 0 && largestSide < MIN_DIMENSION) {
    image.scale(MIN_DIMENSION / largestSide);
  }
  return image;
}

// Receipts are narrow and low-contrast (thermal print, often photographed at
// a slight angle under uneven lighting) — very different from the full-page
// documents Tesseract's defaults assume. Grayscale + histogram normalization
// gives Tesseract's own internal binarization step a cleaner image to work
// with; this is a deliberately conservative preprocessing pass (no manual
// contrast/threshold tuning) so it doesn't risk overcorrecting an
// already-well-lit photo.
function preprocessConservative(image: Awaited<ReturnType<typeof loadImage>>): Promise<Buffer> {
  return image.clone().greyscale().normalize().getBuffer('image/png');
}

// A second, more aggressive variant tried only when the conservative pass
// above scores low confidence — a real contrast boost recovers faded
// thermal print the plain normalize() above is deliberately too gentle to
// fix on its own, at the cost of being more likely to blow out an
// already-good photo (which is exactly why it's not the default).
function preprocessHighContrast(image: Awaited<ReturnType<typeof loadImage>>): Promise<Buffer> {
  return image.clone().greyscale().normalize().contrast(0.4).getBuffer('image/png');
}

async function ocrPass(imageBuffer: Buffer, pageSegMode: PSM): Promise<OcrResult> {
  const worker = await createWorker('eng');
  try {
    await worker.setParameters({ tessedit_pageseg_mode: pageSegMode });
    const { data } = await worker.recognize(imageBuffer);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

// Below this, it's worth spending a second OCR pass trying to do better
// rather than accepting a low-confidence read outright.
const RETRY_BELOW_CONFIDENCE = 70;

// tesseract.js accepts a data URI directly and decodes it itself, but we
// preprocess first (see above) and hand it a decoded buffer instead. Runs
// entirely in-process (WASM), no external OCR account/API key required; on
// first cold start it fetches the English language model from tesseract.js's
// CDN, which Vercel's serverless runtime can reach even though this repo's
// own dev sandbox can't.
export async function runOcr(imageDataUri: string): Promise<OcrResult> {
  const image = await loadImage(imageDataUri);

  // SINGLE_COLUMN matches a receipt's actual layout — one narrow column of
  // text — far better than the default "fully automatic page segmentation"
  // mode, which is tuned for multi-column documents. This is the fast path
  // and handles the large majority of ordinary slips.
  const first = await ocrPass(await preprocessConservative(image), PSM.SINGLE_COLUMN);
  if (first.confidence >= RETRY_BELOW_CONFIDENCE) return first;

  // Low confidence — try again with a higher-contrast image and SPARSE_TEXT,
  // which (unlike SINGLE_COLUMN) doesn't assume one clean column, so it
  // copes better with layouts a single column mode trips on: a logo or
  // watermark splitting the page, two-column pricing, an unusually short or
  // oddly-cropped slip. Whichever pass actually scored higher wins — this
  // never makes a good first read worse, it only gives a bad one a second
  // chance.
  const second = await ocrPass(await preprocessHighContrast(image), PSM.SPARSE_TEXT);
  return second.confidence > first.confidence ? second : first;
}
