#!/usr/bin/env node
/*
 * Renders flagrr-explainer.html to MP4, with its synthesised soundtrack.
 *
 * The page exposes window.FLAGRR.seek(t), and every frame is a pure function
 * of t, so seeking and screenshotting gives a frame-perfect video however
 * long each screenshot takes. Frames are split across several browser pages
 * in parallel. The page also exposes window.FLAGRR.AUDIO (BPM, arrangement
 * and a cue for every sound effect), which audio.py turns into the WAV that
 * ffmpeg muxes in.
 *
 * Needs Playwright (with Chromium), ffmpeg, and python3 with numpy:
 *   npm i -g playwright && npx playwright install chromium
 *
 * Usage:
 *   node marketing/explainer/render.cjs                      # 16:9  -> marketing/dist/flagrr-explainer-16x9.mp4
 *   node marketing/explainer/render.cjs --format portrait    # 9:16  -> marketing/dist/flagrr-explainer-9x16.mp4
 *   node marketing/explainer/render.cjs --audio-only         # just marketing/dist/flagrr-explainer.wav (for the browser preview)
 *   options: [out.mp4] [--fps 30] [--workers 4] [--from 0] [--to 68] [--no-audio]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = name => args.includes('--' + name);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i === -1 ? def : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--audio-only', '--no-audio'].includes(args[i - 1])));

const HERE = __dirname;
const DIST = path.join(HERE, '..', 'dist');
const FORMAT = opt('format', 'landscape');
const PORT = FORMAT === 'portrait';
const VIEWPORT = PORT ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const OUT = path.resolve(positional[0] || path.join(DIST, `flagrr-explainer-${PORT ? '9x16' : '16x9'}.mp4`));
const WAV = path.join(DIST, 'flagrr-explainer.wav');
const FPS = Number(opt('fps', 30));
const WORKERS = Number(opt('workers', Math.max(1, Math.min(6, os.cpus().length))));
const PAGE = 'file://' + path.join(HERE, 'flagrr-explainer.html') + `?render=1&format=${FORMAT}`;

async function open(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.FLAGRR && window.FLAGRR.ready, null, { timeout: 60000 });
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  return page;
}

function renderAudio(spec) {
  fs.mkdirSync(DIST, { recursive: true });
  const json = path.join(os.tmpdir(), `flagrr-audio-${process.pid}.json`);
  fs.writeFileSync(json, JSON.stringify(spec));
  execFileSync('python3', [path.join(HERE, 'audio.py'), json, WAV], { stdio: 'inherit' });
  fs.rmSync(json, { force: true });
}

(async () => {
  const browser = await chromium.launch();
  let frameDir = null, duration, first, total;
  try {
    // The page is the source of truth for timing, picture and sound alike.
    const probe = await open(browser);
    duration = await probe.evaluate(() => window.FLAGRR.DURATION);
    const audioSpec = await probe.evaluate(() => window.FLAGRR.AUDIO);
    await probe.close();

    if (!flag('no-audio')) renderAudio(audioSpec);
    if (flag('audio-only')) return;

    frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagrr-frames-'));
    const from = Number(opt('from', 0)), to = Number(opt('to', duration));
    first = Math.round(from * FPS);
    const last = Math.min(Math.round(to * FPS), Math.round(duration * FPS) - 1);
    total = last - first + 1;
    console.log(`Rendering ${total} ${FORMAT} frames (${from}s–${to}s @ ${FPS}fps) with ${WORKERS} workers…`);

    let done = 0;
    const started = Date.now();
    await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const page = await open(browser);
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
  if (flag('audio-only')) { console.log('Wrote ' + path.relative(process.cwd(), WAV)); return; }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const audioIn = flag('no-audio') ? [] : ['-ss', String(first / FPS), '-i', WAV];
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(frameDir, 'f%05d.jpg'),
    ...audioIn,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'film', '-pix_fmt', 'yuv420p',
    ...(audioIn.length ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-movflags', '+faststart', OUT,
  ], { stdio: 'inherit' });
  fs.rmSync(frameDir, { recursive: true, force: true });
  console.log('Wrote ' + path.relative(process.cwd(), OUT));
})().catch(err => { console.error(err); process.exit(1); });
