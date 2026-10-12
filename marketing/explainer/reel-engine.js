/*
 * Shared engine for the Flagrr reels (member-reel.html, club-reel.html).
 *
 * Load this as a classic <script> before a reel's own script. Everything
 * here is a global the reel's shots draw with: the canvas context `g`,
 * text helpers, generative pieces, the cue sheet, and shot().
 * startReel(cfg) runs it all.
 *
 * Every frame is a pure function of time: render(t) paints the whole
 * picture from scratch, so render.cjs can seek to any frame and screenshot
 * it for a frame-perfect MP4.
 *
 * ?format=landscape (default) is 1920x1080, ?format=portrait is 1080x1920.
 */

// ================================================================
// format + canvases
// ================================================================
const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const PORT = params.get('format') === 'portrait';
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080;
const renderMode = params.has('render');
if (renderMode) document.body.classList.add('render');
const canvas = $('#c');
canvas.width = W; canvas.height = H;
const main = canvas.getContext('2d');
const mkCanvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const bufA = mkCanvas(), bufB = mkCanvas(), bufC = mkCanvas(), fxR = mkCanvas(), fxG = mkCanvas(), fxB = mkCanvas();
let g = bufA.getContext('2d'); // the context every draw helper paints into

// layout constants shared by both formats
const L = PORT ? { pad: 70, hud: 22 } : { pad: 56, hud: 16 };

// ================================================================
// palette: Flagrr brand, pushed to flat poster colours
// ================================================================
const C = {
  ink: '#0D1A14', dark: '#1F4234', club: '#00805A', lime: '#CDDE5C', cream: '#F1EEE3', white: '#FFFFFF',
  bronze: '#C27B44', silver: '#C9D1CD', gold: '#E8B931', plat: '#EEF2DF',
};
const isLight = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) > 140; };

// ================================================================
// math
// ================================================================
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const E = {
  lin: k => k,
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inCubic: k => k * k * k,
  inOutCubic: k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outExpo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inExpo: k => (k <= 0 ? 0 : Math.pow(2, 10 * k - 10)),
  outBack: k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  outElastic: k => (k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -9 * k) * Math.sin((k * 10 - .75) * (2 * Math.PI) / 3.2) + 1),
};
const P = (t, start, dur, ease = E.outCubic) => ease(clamp((t - start) / dur));
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const decay = (t, t0, rate) => (t < t0 ? 0 : Math.exp(-(t - t0) * rate));
const fmt = n => Math.round(n).toLocaleString('en-US');
const within = (t, ranges) => ranges.some(([a, b]) => t >= a && t < b);

// ================================================================
// type: wide grotesque for shouting, italic serif for talking, mono for the frame
// ================================================================
const FONTS = {
  wide: ['900', 'Archivo', 'ultra-expanded'],
  wide8: ['800', 'Archivo', 'ultra-expanded'],
  serif: ['italic 600', 'Fraunces', 'normal'],
  mono: ['500', '"JetBrains Mono"', 'normal'],
  monoB: ['700', '"JetBrains Mono"', 'normal'],
  sans: ['600', 'Archivo', 'normal'],
  sansR: ['400', 'Archivo', 'normal'],
};
function font(kind, px) {
  const [w, fam, st] = FONTS[kind];
  g.fontStretch = st;
  g.font = `${w} ${px}px ${fam}`;
  g.letterSpacing = kind.startsWith('wide') ? `${-px * .02}px` : kind.startsWith('mono') ? `${px * .06}px` : '0px';
}
const fitCache = new Map();
function fit(str, kind, maxW, maxH = Infinity) {
  const key = str + kind + maxW + maxH;
  if (!fitCache.has(key)) {
    font(kind, 100);
    const w = g.measureText(str).width;
    fitCache.set(key, Math.min(maxW / w * 100, maxH / .74));
  }
  return fitCache.get(key);
}
function measure(str, kind, px) { font(kind, px); return g.measureText(str).width; }
// draws text centred on (x, y) by cap height; mb = motion-blur vector in px
function text(str, x, y, px, kind, color, { align = 'center', mb = null, alpha = 1, base = 'cap' } = {}) {
  font(kind, px);
  g.textAlign = align; g.textBaseline = 'alphabetic';
  const yy = base === 'cap' ? y + px * .36 : y;
  g.fillStyle = color;
  if (mb && Math.hypot(mb[0], mb[1]) > 1) {
    const n = Math.min(24, 6 + Math.round(Math.hypot(mb[0], mb[1]) / 12));
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      g.globalAlpha = alpha * Math.min(.22, 2.4 / n);
      g.fillText(str, x - mb[0] * (1 - k), yy - mb[1] * (1 - k));
    }
    g.globalAlpha = alpha * .55;
  } else g.globalAlpha = alpha;
  g.fillText(str, x, yy);
  g.globalAlpha = 1;
}
// wraps a paragraph into lines no wider than maxW; returns the lines
function wrap(str, kind, px, maxW) {
  font(kind, px);
  const out = []; let line = '';
  str.split(' ').forEach(w => {
    const tryL = line ? line + ' ' + w : w;
    if (g.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL;
  });
  if (line) out.push(line);
  return out;
}
// a giant word that slams in on its beat: drops in with blur, overshoots, settles
function slam(str, t, t0, color, { y = H / 2, maxW = W * .88, maxH = H * .5, kind = 'wide', from = 'up', alpha = 1 } = {}) {
  if (t < t0) return 0;
  const px = fit(str, kind, maxW, maxH);
  const k = P(t, t0, .22, E.outBack), lin = clamp((t - t0) / .12);
  const d = (1 - k) * (from === 'up' ? -1 : 1) * H * .18;
  const vel = (1 - lin) * (from === 'up' ? -1 : 1) * H * .25;
  const sc = lerp(1.12, 1, P(t, t0, .3, E.outExpo));
  g.save(); g.translate(W / 2, y + d); g.scale(sc, sc);
  text(str, 0, 0, px, kind, color, { mb: [0, vel], alpha });
  g.restore();
  return px;
}
// a calmer entrance for corporate copy: rises a little, fades in, no overshoot
function rise(str, x, y, px, kind, color, t, t0, { align = 'left', dur = .45, dist = 40 } = {}) {
  if (t < t0) return;
  const k = P(t, t0, dur, E.outExpo);
  text(str, x, y + (1 - k) * dist, px, kind, color, { align, alpha: clamp(k * 1.4) });
}
function wipeText(str, x, y, px, kind, color, t, t0, dur = .5, align = 'left') {
  // characters type on left to right, mono style
  if (t < t0) return;
  const n = Math.floor(str.length * clamp((t - t0) / dur));
  text(str.slice(0, n) + (n < str.length && Math.floor(t * 12) % 2 ? '▍' : ''), x, y, px, kind, color, { align });
}

// ================================================================
// generative pieces
// ================================================================
// golf ball as a 3D point cloud: fibonacci sphere, ~400 dimples
const SPHERE = (() => {
  const N = 420, pts = [], r = rng(5), ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * (i + .5) / N, rad = Math.sqrt(1 - y * y), th = ga * i;
    pts.push({ x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, sx: (r() - .5) * 5, sy: (r() - .5) * 5, d: r() });
  }
  return pts;
})();
function sphere(cx, cy, R, t, { form = 1, color = C.lime, burst = 0, spin = .9 } = {}) {
  const a = t * spin, ca = Math.cos(a), sa = Math.sin(a), tilt = .38, ct = Math.cos(tilt), st = Math.sin(tilt);
  g.fillStyle = color;
  for (const p of SPHERE) {
    let x = p.x * ca + p.z * sa, z = -p.x * sa + p.z * ca, y = p.y;
    const y2 = y * ct - z * st; z = y * st + z * ct; y = y2;
    const k = E.outExpo(clamp(form * 1.6 - p.d * .6));
    const bx = lerp(p.sx, x, k) * (1 + burst * (1.5 + p.d * 3)), by = lerp(p.sy, y, k) * (1 + burst * (1.5 + p.d * 3));
    const depth = (z + 1) / 2;
    g.globalAlpha = clamp((.25 + .75 * depth) * (1 - burst));
    const s = R * .022 * (.5 + depth * .8);
    g.beginPath(); g.arc(cx + bx * R, cy + by * R, s, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
// shape morphing: every shape sampled at the same 180 angles so they interpolate
const NS = 180;
function polar(verts) {
  const out = [];
  for (let i = 0; i < NS; i++) {
    const th = i / NS * Math.PI * 2, dx = Math.cos(th), dy = Math.sin(th);
    let best = 1;
    for (let j = 0; j < verts.length; j++) {
      const [x1, y1] = verts[j], [x2, y2] = verts[(j + 1) % verts.length];
      const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const u = (x1 * ey - y1 * ex) / den, v = (x1 * dy - y1 * dx) / den;
      if (u > 0 && v >= 0 && v <= 1) best = u;
    }
    out.push(best);
  }
  return out;
}
const ngon = (n, r = 1, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [Math.cos(rot + i / n * Math.PI * 2) * r, Math.sin(rot + i / n * Math.PI * 2) * r]);
const starPts = (n, r1, r2) => Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + i / (n * 2) * Math.PI * 2, r = i % 2 ? r2 : r1; return [Math.cos(a) * r, Math.sin(a) * r]; });
const SHAPES = [Array(NS).fill(.92), polar(ngon(3, 1.15)), polar(starPts(5, 1.12, .5)), polar(ngon(6, 1))];
function morph(cx, cy, R, from, to, k, rot, color) {
  g.fillStyle = color; g.beginPath();
  for (let i = 0; i < NS; i++) {
    const r = lerp(SHAPES[from][i], SHAPES[to][i], k) * R, th = i / NS * Math.PI * 2 + rot;
    i ? g.lineTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r) : g.moveTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r);
  }
  g.closePath(); g.fill();
}
// truchet tiles: quarter-arcs that flip at the times pushed into tile.flips
const TRU = (() => {
  const s = PORT ? 108 : 120, cols = Math.ceil(W / s) + 1, rows = Math.ceil(H / s) + 1, r = rng(77), tiles = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) tiles.push({ x, y, o: r() < .5 ? 0 : 1, flips: [] });
  return { s, tiles };
})();
function truchet(t, color, lw) {
  const s = TRU.s;
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'butt';
  for (const tl of TRU.tiles) {
    let ang = tl.o * 90;
    tl.flips.forEach(ft => { ang += 90 * E.outBack(clamp((t - ft) / .16)); });
    g.save(); g.translate(tl.x * s + s / 2, tl.y * s + s / 2); g.rotate(ang * Math.PI / 180);
    g.beginPath(); g.arc(-s / 2, -s / 2, s / 2, 0, Math.PI / 2); g.stroke();
    g.beginPath(); g.arc(s / 2, s / 2, s / 2, Math.PI, Math.PI * 1.5); g.stroke();
    g.restore();
  }
}
// decorative (non-scannable) QR-style pattern
const QR = (() => {
  const N = 25, r = rng(1234), cells = [];
  const inF = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inF(x, y) && r() > .52) cells.push([x, y]);
  return { N, cells };
})();
function qr(x, y, size, color, bg) {
  const u = size / (QR.N + 2);
  g.fillStyle = bg; g.fillRect(x, y, size, size);
  g.fillStyle = color;
  QR.cells.forEach(([cx, cy]) => g.fillRect(x + (cx + 1) * u, y + (cy + 1) * u, u + .5, u + .5));
  [[0, 0], [QR.N - 7, 0], [0, QR.N - 7]].forEach(([fx, fy]) => {
    g.fillStyle = color; g.fillRect(x + (fx + 1) * u, y + (fy + 1) * u, 7 * u, 7 * u);
    g.fillStyle = bg; g.fillRect(x + (fx + 2) * u, y + (fy + 2) * u, 5 * u, 5 * u);
    g.fillStyle = color; g.fillRect(x + (fx + 3) * u, y + (fy + 3) * u, 3 * u, 3 * u);
  });
}
function rrect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// images
const IMG = {};
const loadImg = (k, src) => new Promise(res => { const i = new Image(); i.onload = () => res(); i.onerror = () => res(); i.src = src; IMG[k] = i; });
function cover(img, x, y, w, h, zoom = 1) {
  if (!img || !img.width) return;
  const s = Math.max(w / img.width, h / img.height) * zoom, iw = img.width * s, ih = img.height * s;
  g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
const APPLE = new Path2D('M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.8c.6-.8 1.1-1.8 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3z');
const PLAY = [
  ['M3.5 2.2 L13.2 12 L3.5 21.8 C3.2 21.6 3 21.2 3 20.7 V3.3 C3 2.8 3.2 2.4 3.5 2.2Z', '#00C3FF'],
  ['M3.5 2.2 C3.9 2 4.4 2 4.9 2.3 L16.6 8.9 L13.2 12 Z', '#00E676'],
  ['M3.5 21.8 L13.2 12 L16.6 15.1 L4.9 21.7 C4.4 22 3.9 22 3.5 21.8Z', '#FF3D57'],
  ['M16.6 8.9 L20.3 11 C21.1 11.5 21.1 12.5 20.3 13 L16.6 15.1 L13.2 12 Z', '#FFC400'],
].map(([d, c]) => [new Path2D(d), c]);
function storePill(x, y, w, h, kind, sh) {
  g.save();
  g.fillStyle = '#050806'; rrect(x, y, w, h, h / 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.stroke();
  const isz = h * .46;
  g.translate(x + h * .38, y + (h - isz) / 2); g.scale(isz / 24, isz / 24);
  if (kind === 'apple') { g.fillStyle = '#fff'; g.fill(APPLE); } else PLAY.forEach(([p, c]) => { g.fillStyle = c; g.fill(p); });
  g.restore();
  const tx = x + h * .38 + isz + h * .2;
  text(kind === 'apple' ? 'Download on the' : 'GET IT ON', tx, y + h * .34, h * .14, 'sans', 'rgba(255,255,255,.8)', { align: 'left' });
  text(kind === 'apple' ? 'App Store' : 'Google Play', tx, y + h * .62, h * .3, 'sans', '#fff', { align: 'left' });
  if (sh > 0 && sh < 1) {
    g.save(); rrect(x, y, w, h, h / 2); g.clip();
    const gx = x + lerp(-w * .3, w * 1.3, sh), gr = g.createLinearGradient(gx - 80, 0, gx + 80, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore();
  }
}

// ================================================================
// cue sheet + visual events, filled in by the reel's shots
// ================================================================
const CUES = [];
const cue = (t, type, o = {}) => CUES.push({ t: Math.round(t * 1000) / 1000, type, ...o });
const GLITCH = [];   // [t, dur, amount]
const FLASH = [];    // [t, strength]
const PUNCH = [];    // [t, amount] extra zoom punches beyond the drums
const glitch = (t, dur = .12, amt = 1) => { GLITCH.push([t, dur, amt]); cue(t, 'glitch', { dur, gain: amt }); };
const SHOTS = [];
// tin: optional transition into this shot: { type: 'iris' } or { type: 'push', dur }
const shot = (t0, t1, sec, bg, draw, tin = null) => SHOTS.push({ t0, t1, sec, bg, draw, tin });

// the reel's settings, filled by startReel()
let REEL = null;

// ================================================================
// the frame: corners, labels, timecode, beat light
// ================================================================
function hud(t, bg) {
  const ink = isLight(bg) ? C.ink : C.cream, p = L.pad * .55, k = P(t, .05, .4, E.outExpo), s = L.hud;
  g.strokeStyle = ink; g.lineWidth = 2; g.globalAlpha = .9;
  const cl = 26 * k;
  [[p, p, 1, 1], [W - p, p, -1, 1], [p, H - p, 1, -1], [W - p, H - p, -1, -1]].forEach(([x, y, sx, sy]) => {
    g.beginPath(); g.moveTo(x, y + sy * cl); g.lineTo(x, y); g.lineTo(x + sx * cl, y); g.stroke();
  });
  g.globalAlpha = 1;
  const ty = p + s * 1.6, by = H - p - s * .9;
  wipeText('FLAGRR', p + 34, ty, s, 'monoB', ink, t, .15, .25, 'left');
  font('monoB', s); const fw = g.measureText('FLAGRR ').width;
  wipeText(REEL.title, p + 34 + fw + 16, ty, s, 'mono', ink, t, .35, .4, 'left');
  const shotNow = SHOTS.find(sh => t >= sh.t0 && t < sh.t1) || SHOTS[SHOTS.length - 1];
  if (t > .6) text(shotNow.sec, W - p - 34, ty, s, 'monoB', ink, { align: 'right' });
  const f = Math.floor(t * 30), tc = `TC 00:00:${String(Math.floor(t)).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`;
  if (t > .6) text(tc, p + 34, by, s, 'mono', ink, { align: 'left', alpha: .75 });
  if (t > .6) {
    const lastK = REEL.kicks.filter(k2 => k2.t <= t).pop(), lit = lastK ? decay(t, lastK.t, 9) : 0;
    text(`${REEL.bpm} BPM`, W - p - 34, by, s, 'mono', ink, { align: 'right', alpha: .75 });
    font('mono', s); const bw = g.measureText(`${REEL.bpm} BPM`).width;
    g.fillStyle = C.lime; g.globalAlpha = .25 + lit * .75; g.beginPath(); g.arc(W - p - 34 - bw - 18, by - s * .3, s * .38, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  }
  if (!PORT && t > .6) {
    const x0 = W * .32, x1 = W * .68, py = by - s * .3;
    g.fillStyle = ink; g.globalAlpha = .25; g.fillRect(x0, py, x1 - x0, 2); g.globalAlpha = .9;
    g.fillRect(x0, py, (x1 - x0) * t / REEL.duration, 2);
    REEL.sections.forEach(st => g.fillRect(x0 + (x1 - x0) * st / REEL.duration, py - 5, 2, 12));
    g.globalAlpha = 1;
  }
}

// ================================================================
// post: punch-zoom on the drums, glitch, flash, grain
// ================================================================
const grainTile = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), img = x.createImageData(256, 256), r = rng(99);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0); return c;
})();
let grainPat = null;
function punchAt(t) {
  let z = 0;
  const pk = REEL.punch;
  REEL.kicks.forEach(k => { if (t >= k.t && t - k.t < .3 && within(k.t, REEL.groove)) z = Math.max(z, pk.kick * decay(t, k.t, 14)); });
  REEL.snares.forEach(s => { if (t >= s && t - s < .3) z = Math.max(z, pk.snare * decay(t, s, 16)); });
  PUNCH.forEach(([pt, a]) => { if (t >= pt && t - pt < .6) z = Math.max(z, a * decay(t, pt, 8)); });
  return z;
}
function glitchAt(t) {
  let a = 0;
  GLITCH.forEach(([gt, d, amt]) => { if (t >= gt && t < gt + d) a = Math.max(a, amt * (1 - (t - gt) / d * .5)); });
  return a;
}
function tint(dst, src, color) {
  const x = dst.getContext('2d');
  x.globalCompositeOperation = 'source-over'; x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
}
function post(t, src) {
  const z = punchAt(t), ga = glitchAt(t), frame = Math.floor(t * 30), r = rng(frame * 7 + 3);
  main.save();
  main.fillStyle = '#000'; main.fillRect(0, 0, W, H);
  main.translate(W / 2, H / 2); main.scale(1 + z, 1 + z); main.translate(-W / 2, -H / 2);
  if (ga > 0) {
    const d = 14 * ga;
    tint(fxR, src, '#ff0000'); tint(fxG, src, '#00ff00'); tint(fxB, src, '#0000ff');
    main.globalCompositeOperation = 'lighter';
    main.drawImage(fxR, d, 0); main.drawImage(fxG, 0, d * .3); main.drawImage(fxB, -d, 0);
    main.globalCompositeOperation = 'source-over';
    const n = 5 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const sy = r() * H, sh = 8 + r() * H * .08, dx = (r() - .5) * 140 * ga;
      main.drawImage(src, 0, sy, W, sh, dx, sy, W, sh);
    }
  } else main.drawImage(src, 0, 0);
  main.restore();
  let fl = 0; FLASH.forEach(([ft, s]) => { if (t >= ft) fl = Math.max(fl, s * decay(t, ft, 14)); });
  if (fl > .01) { main.fillStyle = `rgba(255,255,255,${fl})`; main.fillRect(0, 0, W, H); }
  if (!grainPat) grainPat = main.createPattern(grainTile, 'repeat');
  main.save(); main.globalAlpha = REEL.grain; main.globalCompositeOperation = 'overlay';
  main.translate(Math.floor(r() * 256), Math.floor(r() * 256)); main.fillStyle = grainPat; main.fillRect(-256, -256, W + 512, H + 512);
  main.restore();
}

// ================================================================
// render
// ================================================================
function drawShot(sh, t, cv) {
  g = cv.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = sh.bg; g.fillRect(0, 0, W, H);
  sh.draw(t - sh.t0, t);
  g.restore();
}
function render(t) {
  t = clamp(t, 0, REEL.duration);
  const i = SHOTS.findIndex(sh => t >= sh.t0 && t < sh.t1);
  const idx = i < 0 ? SHOTS.length - 1 : i, sh = SHOTS[idx];
  drawShot(sh, t, bufA);
  let out = bufA;
  const tin = sh.tin;
  if (tin && idx > 0) {
    const prev = SHOTS[idx - 1];
    if (tin.type === 'iris' && t - sh.t0 < .35) {
      // the new shot opens out of the centre over the old one
      drawShot(prev, sh.t0 - .001, bufB);
      const x = bufB.getContext('2d'), k = P(t, sh.t0, .35, E.outExpo);
      x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(W / 2, H / 2, k * Math.hypot(W, H) / 2 + 1, 0, Math.PI * 2); x.fill(); x.restore();
      bufA.getContext('2d').drawImage(bufB, 0, 0);
    }
    const pd = tin.dur || .4;
    if (tin.type === 'push' && t - sh.t0 < pd) {
      // the old shot is pushed out sideways by the new one, with motion blur
      drawShot(prev, sh.t0 - .001, bufB);
      const k = P(t, sh.t0, pd, E.inOutCubic), kp = P(t - 1 / 60, sh.t0, pd, E.inOutCubic);
      const off = -k * W, vel = (k - kp) * W, x = bufC.getContext('2d');
      x.fillStyle = sh.bg; x.fillRect(0, 0, W, H);
      const n = vel > 4 ? 6 : 1;
      for (let j = 0; j < n; j++) {
        const o = vel * (j / Math.max(1, n - 1)) * 1.5;
        x.globalAlpha = n > 1 ? .28 : 1;
        x.drawImage(bufB, off + o, 0); x.drawImage(bufA, off + W + o, 0);
      }
      x.globalAlpha = 1;
      out = bufC;
    }
  }
  post(t, out);
  g = main; hud(t, sh.bg);
}

// ================================================================
// playback + start
// ================================================================
function startReel(cfg) {
  REEL = Object.assign({ punch: { kick: .022, snare: .012 }, grain: .07, preload: [], audio: {} }, cfg);
  function fitView() {
    if (renderMode) { canvas.style.transform = 'none'; return; }
    const vp = $('#viewport');
    canvas.style.transform = `scale(${Math.min(vp.clientWidth / W, vp.clientHeight / H)})`;
  }
  addEventListener('resize', fitView); fitView();
  let now = +(params.get('t') || 0), playing = false, last = null;
  const scrub = $('#scrub'), clock = $('#clock'), btn = $('#play'), aud = $('#aud');
  scrub.max = REEL.duration;
  $('#fmt').textContent = PORT ? 'Switch to 16:9' : 'Switch to 9:16';
  $('#fmt').href = '?format=' + (PORT ? 'landscape' : 'portrait');
  const show = () => { render(now); scrub.value = now; clock.textContent = `${now.toFixed(2)} / ${REEL.duration.toFixed(2)}`; btn.innerHTML = playing ? '&#10073;&#10073;' : '&#9654;'; };
  const syncAudio = () => { try { aud.currentTime = now; if (playing) aud.play().catch(() => {}); else aud.pause(); } catch (e) { /* no soundtrack rendered yet */ } };
  function tick(ts) {
    if (playing) {
      if (last !== null) now += (ts - last) / 1000;
      if (!aud.paused && Math.abs(aud.currentTime - now) > .08) now = aud.currentTime;
      if (now >= REEL.duration) { now = REEL.duration; playing = false; syncAudio(); }
      show();
    }
    last = ts;
    requestAnimationFrame(tick);
  }
  btn.onclick = () => { if (now >= REEL.duration) now = 0; playing = !playing; last = null; syncAudio(); show(); };
  scrub.oninput = () => { now = +scrub.value; syncAudio(); show(); };
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); btn.onclick(); }
    if (e.code === 'ArrowRight') { now = Math.min(REEL.duration, now + 1); syncAudio(); show(); }
    if (e.code === 'ArrowLeft') { now = Math.max(0, now - 1); syncAudio(); show(); }
  });

  window.FLAGRR = { DURATION: REEL.duration, seek: s => { now = s; render(s); } };
  Promise.all([
    document.fonts.load('900 100px Archivo'), document.fonts.load('600 100px Archivo'), document.fonts.load('800 100px Archivo'), document.fonts.load('400 100px Archivo'),
    document.fonts.load('500 20px "JetBrains Mono"'), document.fonts.load('700 20px "JetBrains Mono"'),
    document.fonts.load('italic 600 60px Fraunces'),
    ...REEL.preload.map(([k, src]) => loadImg(k, src)),
  ]).then(() => {
    CUES.sort((a, b) => a.t - b.t);
    window.FLAGRR.AUDIO = Object.assign({
      duration: REEL.duration, bpm: REEL.bpm, groove: REEL.groove, kicks: REEL.kicks, snares: REEL.snares, cues: CUES,
    }, REEL.audio);
    show();
    if (!renderMode) requestAnimationFrame(tick);
    window.FLAGRR.ready = true;
  });
}
