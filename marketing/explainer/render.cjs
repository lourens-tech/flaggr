#!/usr/bin/env node
/*
 * Renders flagrr-explainer.html to an MP4, frame by frame.
 *
 * The page exposes window.FLAGRR.seek(t); every frame is a pure function of t,
 * so seeking + screenshotting gives a frame-perfect video regardless of how
 * long each screenshot takes. Frames are split across several browser pages
 * in parallel, then stitched with ffmpeg.
 *
 * Needs Playwright (with Chromium) and ffmpeg on PATH:
 *   npm i -g playwright && npx playwright install chromium
 *
 * Usage:
 *   node marketing/explainer/render.cjs [out.mp4] [--fps 30] [--workers 4] [--from 0] [--to 64]
 *
 * Default output: marketing/dist/flagrr-explainer.mp4 (gitignored).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i === -1 ? def : Number(args[i + 1]);
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));

const HERE = __dirname;
const OUT = path.resolve(positional[0] || path.join(HERE, '..', 'dist', 'flagrr-explainer.mp4'));
const FPS = opt('fps', 30);
const WORKERS = opt('workers', Math.max(1, Math.min(6, os.cpus().length)));
const PAGE = 'file://' + path.join(HERE, 'flagrr-explainer.html') + '?render=1';

(async () => {
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagrr-frames-'));
  const browser = await chromium.launch();
  try {
    // Probe the duration from the page itself so the two never drift.
    const probe = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await probe.goto(PAGE);
    await probe.waitForFunction(() => window.FLAGRR && window.FLAGRR.ready);
    const duration = await probe.evaluate(() => window.FLAGRR.DURATION);
    await probe.close();

    const from = opt('from', 0), to = opt('to', duration);
    const first = Math.round(from * FPS), last = Math.round(to * FPS);
    const total = last - first + 1;
    console.log(`Rendering ${total} frames (${from}s–${to}s @ ${FPS}fps) with ${WORKERS} workers…`);

    let done = 0;
    const started = Date.now();
    await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(PAGE);
      await page.waitForFunction(() => window.FLAGRR && window.FLAGRR.ready);
      // Make sure every image has decoded before the first capture.
      await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
      for (let f = first + w; f <= last; f += WORKERS) {
        await page.evaluate(t => window.FLAGRR.seek(t), f / FPS);
        // CSS background images (rewards, course photos) load lazily on first use.
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.screenshot({ path: path.join(frameDir, `f${String(f - first).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
        if (++done % 60 === 0 || done === total) {
          const rate = done / ((Date.now() - started) / 1000);
          process.stdout.write(`\r  ${done}/${total} frames  (${rate.toFixed(1)} fps, ~${Math.round((total - done) / rate)}s left)   `);
        }
      }
      await page.close();
    }));
    console.log();
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(frameDir, 'f%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', OUT,
  ], { stdio: 'inherit' });
  fs.rmSync(frameDir, { recursive: true, force: true });
  console.log('Wrote ' + path.relative(process.cwd(), OUT));
})().catch(err => { console.error(err); process.exit(1); });
