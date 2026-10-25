// Steps video.html frame by frame and encodes it with ffmpeg.
//
//   node marketing/club-explainer-video/render.mjs                 # full film -> out/flagrr-for-clubs.mp4
//   node marketing/club-explainer-video/render.mjs --stills 1,8.9  # single frames -> out/stills/
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const FPS = 30;

const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const range = args.includes('--range') ? args[args.indexOf('--range') + 1].split(',').map(Number) : null;
const workers = args.includes('--workers') ? Number(args[args.indexOf('--workers') + 1]) : 0;

// --workers N: split the film into N ranges, render them in parallel child
// processes, then join the segments losslessly.
if (workers > 1) {
  fs.mkdirSync(OUT, { recursive: true });
  const DURATION = 62;
  const frames = DURATION * FPS;
  const cuts = Array.from({ length: workers + 1 }, (_, i) => Math.round((frames * i) / workers) / FPS);
  const segs = [];
  await Promise.all(cuts.slice(0, -1).map((from, i) => new Promise((res, rej) => {
    const to = cuts[i + 1];
    segs.push(path.join(OUT, `range-${from}-${to}.mp4`));
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--range', `${from},${to}`], { stdio: 'inherit' });
    child.on('close', (code) => (code === 0 ? res() : rej(new Error(`worker ${i} exited ${code}`))));
  })));
  segs.sort((a, b) => parseFloat(a.split('range-')[1]) - parseFloat(b.split('range-')[1]));
  const list = path.join(OUT, 'segments.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
  const outFile = path.join(OUT, 'flagrr-for-clubs-silent.mp4');
  await new Promise((res) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', outFile], { stdio: 'inherit' }).on('close', res));
  for (const s of segs) fs.unlinkSync(s);
  fs.unlinkSync(list);
  console.log('wrote', outFile);
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(pathToFileURL(path.join(HERE, 'video.html')).href);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const stage = page.locator('#stage');

if (stillsArg) {
  const dir = path.join(OUT, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const t of stillsArg.split(',').map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await stage.screenshot({ path: path.join(dir, `t${t.toFixed(2)}.png`) });
  }
  console.log('stills written to', dir);
} else {
  fs.mkdirSync(OUT, { recursive: true });
  const [from, to] = range || [0, duration];
  const outFile = path.join(OUT, range ? `range-${from}-${to}.mp4` : 'flagrr-for-clubs-silent.mp4');
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round((to - from) * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.render(t), from + i / FPS);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`[${from}-${to}] frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', outFile);
}
await browser.close();
