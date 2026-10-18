#!/usr/bin/env node
/**
 * Renders a mailer to a single JPEG, for a club whose email tool can't hold
 * the design at all — they paste the plain text and attach this picture.
 *
 * Needs a Chromium and playwright-core. In an environment that already has a
 * browser (CI images, this project's sandbox) set PLAYWRIGHT_CHROMIUM to its
 * executable; otherwise `npx playwright install chromium` first.
 *
 * Usage:
 *   npm i --no-save playwright-core
 *   node marketing/render-jpeg.mjs
 *   -> marketing/strand-flagrr-announcement.jpg
 */
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAILER = join(HERE, 'strand-golf-club-pilot-launch.html');
const OUT = join(HERE, 'strand-flagrr-announcement.jpg');

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(root)) {
    const found = execSync(`find ${root} -name chrome -type f | head -1`).toString().trim();
    if (found) return found;
  }
  return undefined; // let playwright resolve its own download
}

// The images must be embedded, not linked: the JPEG is rendered from a local
// file, and a hosted <img> would need the network. make-preview.py inlines
// them as data URIs, which is exactly what's wanted here.
const inlined = join(HERE, 'strand-golf-club-pilot-launch.forjpeg.html');
execSync(`python3 ${join(HERE, 'make-preview.py')} ${MAILER} ${inlined}`, { stdio: 'ignore' });

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
// 640 CSS px: the 600px table plus its 16px side gutters, so nothing crops.
// deviceScaleFactor 2 keeps the QR codes sharp enough to scan off a screen.
const page = await browser.newPage({ viewport: { width: 640, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(`file://${inlined}`);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 82, fullPage: true });
await browser.close();
unlinkSync(inlined);

console.log(OUT);
console.log('Re-check that both QR codes still decode from the JPEG after any change.');
