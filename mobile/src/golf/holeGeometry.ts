// Geometry for the in-round hole view: each hole turned so the tee is at the
// bottom and the green at the top, the hazards near it, distances to the
// green, and the suggested shot for the member's own club distances.

import type { CourseMapFile, FeatureKind, Gender, Pt } from './courseMap';

export interface Club {
  name: string;
  carry: number; // metres
}

export const DEFAULT_BAG: Club[] = [
  { name: 'Driver', carry: 230 },
  { name: '3 Wood', carry: 210 },
  { name: '5 Hybrid', carry: 192 },
  { name: '5 Iron', carry: 178 },
  { name: '6 Iron', carry: 167 },
  { name: '7 Iron', carry: 156 },
  { name: '8 Iron', carry: 145 },
  { name: '9 Iron', carry: 133 },
  { name: 'PW', carry: 120 },
  { name: 'GW', carry: 106 },
  { name: 'SW', carry: 92 },
  { name: 'LW', carry: 75 },
];

export type HazardKind = 'bunker' | 'water' | 'trees';

export interface Hazard {
  kind: HazardKind;
  pts?: Pt[]; // area outline
  line?: Pt[]; // tree row
  edge: Pt[]; // outline sampled every few metres, for reach / carry
  x: number;
  y: number;
}

export interface DrawFeature {
  k: FeatureKind;
  r?: Pt[][];
  l?: Pt[];
}

export interface HoleView {
  n: number;
  par: number;
  si: number | null;
  length: number; // from the card, or measured on the map when the card has none
  pin: Pt;
  line: Pt[];
  tee: Pt;
  greenPts: Pt[];
  draw: DrawFeature[];
  greens: Pt[][];
  tees: Array<{ tees: string[]; pts: Pt[]; own: boolean }>;
  hazards: Hazard[];
  fairways: Pt[][];
  bunkers: Hazard[];
  water: Hazard[];
  bounds: [number, number, number, number];
}

const D2R = Math.PI / 180;
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function cum(pts: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1], pts[i]));
  return c;
}

/** Nearest point on a polyline; lat > 0 means right of the direction of play. */
export function project(pts: Pt[], p: Pt): { d: number; s: number; lat: number } {
  const c = cum(pts);
  let best = { d: Infinity, s: 0, lat: 0 };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const L2 = vx * vx + vy * vy;
    if (!L2) continue;
    const L = Math.sqrt(L2);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2));
    const d = Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vy * t));
    if (d < best.d) best = { d, s: c[i - 1] + t * L, lat: -(vx * (p[1] - a[1]) - vy * (p[0] - a[0])) / L };
  }
  return best;
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t);
}

export function inPoly(p: Pt, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(pts: Pt[]): Pt {
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}

/** Distance to an outline, negative inside it. */
function polyDist(p: Pt, pts: Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i], pts[(i + 1) % pts.length]));
  return inPoly(p, pts) ? -d : d;
}

function lineDist(p: Pt, pts: Pt[]): number {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i]));
  return d;
}

function densify(pts: Pt[], closed: boolean): Pt[] {
  const out: Pt[] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const k = Math.max(1, Math.ceil(dist(a, b) / 4));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

const TREE_ROW_HALF_WIDTH = 4;
const NEAR_HOLE_METRES = 170;

/** Rotates the course so the line from `from` to `to` points straight up, with `origin` at 0,0. */
function frameFor(origin: Pt, from: Pt, to: Pt): (p: Pt) => Pt {
  const a = Math.PI / 2 - Math.atan2(to[1] - from[1], to[0] - from[0]);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (p) => {
    const x = p[0] - origin[0];
    const y = p[1] - origin[1];
    return [x * c - y * s, x * s + y * c];
  };
}

/** How far the map's tee box may sit from the card's length before the tee
 * is placed from the card instead. OpenStreetMap often draws one box for two
 * tees, or misplaces a forward tee; the card is the club's official figure. */
export const TEE_LENGTH_TOLERANCE = 15;

/** Where the ball starts on a hole: the tee box's centre, unless that's more
 * than TEE_LENGTH_TOLERANCE off the card length, in which case the point on
 * the hole's centre line exactly the card length from the green. Returns the
 * start and the rest of the centre line after it (ending at the green). */
export function teeStart(path: Pt[], boxCentre: Pt, cardLength: number | null): { tee: Pt; rest: Pt[]; fromCard: boolean } {
  const pin = path[path.length - 1];
  const viaBox = [...path.slice(1, -1), pin];
  const boxLength = cum([boxCentre, ...viaBox])[viaBox.length];
  if (cardLength == null || Math.abs(boxLength - cardLength) <= TEE_LENGTH_TOLERANCE) return { tee: boxCentre, rest: viaBox, fromCard: false };
  // Walk back from the green along the centre line.
  let left = cardLength;
  for (let k = path.length - 1; k > 0; k--) {
    const a = path[k];
    const b = path[k - 1];
    const seg = dist(a, b);
    if (left <= seg || k === 1) {
      const t = seg ? left / seg : 0; // beyond the back tee on the first segment, extend it
      return { tee: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], rest: path.slice(k), fromCard: true };
    }
    left -= seg;
  }
  return { tee: boxCentre, rest: viaBox, fromCard: false };
}

/** Builds the view of one hole (index i in the course) from the chosen tee. */
export function buildHoleView(map: CourseMapFile, i: number, teeId: string, gender: Gender): HoleView {
  const raw = map.holes[i];
  const pinCourse = raw.path[raw.path.length - 1];
  const close = (pts: Pt[], r: number) => pts.some((p) => lineDist(p, raw.path) < r);
  const own = map.teeBoxes.filter((t) => t.hole === raw.n);
  const teeBox = own.find((t) => t.tees.includes(teeId)) ?? own[0];
  const cardLength = map.tees.find((t) => t.id === teeId)?.lengths[i] ?? null;
  const start = teeStart(raw.path, teeBox ? centroid(teeBox.pts) : raw.path[0], cardLength);
  const T = frameFor(start.tee, raw.path[0], pinCourse);
  const tr = (pts: Pt[]) => pts.map(T);
  const line = tr([start.tee, ...start.rest]);
  const pin = line[line.length - 1];
  const mapLength = cum(line)[line.length - 1];

  const greenRaw = map.greens.find((g) => g.hole === raw.n)!;
  const greenPts = tr(greenRaw.pts);
  const draw: DrawFeature[] = map.features
    .filter((ft) => close(ft.r ? ft.r[0] : ft.l ?? [], NEAR_HOLE_METRES))
    .map((ft) => (ft.r ? { k: ft.k, r: ft.r.map(tr) } : { k: ft.k, l: tr(ft.l ?? []) }));
  const greens = map.greens.filter((g) => close(g.pts, NEAR_HOLE_METRES)).map((g) => tr(g.pts));
  const tees = map.teeBoxes
    .filter((t) => close(t.pts, NEAR_HOLE_METRES))
    .map((t) => ({ tees: t.tees, pts: tr(t.pts), own: t === teeBox }));

  const hazards: Hazard[] = [];
  for (const ft of draw) {
    const kind: HazardKind | null =
      ft.k === 'bunker' ? 'bunker' : ft.k === 'water' ? 'water' : ft.k === 'wood' || ft.k === 'scrub' || ft.k === 'treerow' ? 'trees' : null;
    if (!kind) continue;
    if (ft.l) {
      const edge = densify(ft.l, false);
      if (edge.every((p) => project(line, p).d > 80)) continue;
      const [x, y] = centroid(ft.l);
      hazards.push({ kind, line: ft.l, edge, x, y });
    } else if (ft.r) {
      const pts = ft.r[0];
      if (pts.every((p) => project(line, p).d > 80)) continue;
      const [x, y] = centroid(pts);
      hazards.push({ kind, pts, edge: densify(pts, true), x, y });
    }
  }
  // Bunkers and water that belong to this hole get reach / carry labels.
  const labelled = hazards.filter((hz) => hz.kind !== 'trees' && project(line, [hz.x, hz.y]).d < 45);
  const fairways = draw
    .filter((ft) => ft.k === 'fairway' && ft.r)
    .map((ft) => ft.r![0])
    .filter((pts) => pts.some((p) => project(line, p).d < 30));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of [...line, ...greenPts]) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const card = map.card[gender];
  return {
    n: raw.n,
    par: card?.par[i] ?? 4,
    si: card?.si[i] ?? null,
    length: cardLength ?? Math.round(mapLength),
    pin,
    line,
    tee: [line[0][0], line[0][1]],
    greenPts,
    draw,
    greens,
    tees,
    hazards,
    fairways,
    bunkers: labelled.filter((hz) => hz.kind === 'bunker'),
    water: labelled.filter((hz) => hz.kind === 'water'),
    bounds: [minX - 35, minY - 15, maxX + 35, maxY + 15],
  };
}

function signedDist(h: Hazard, p: Pt): number {
  return h.line ? lineDist(p, h.line) - TREE_ROW_HALF_WIDTH : polyDist(p, h.pts ?? []);
}

function nearestHazard(hole: HoleView, p: Pt, kinds?: HazardKind[]): { h: Hazard; d: number } | null {
  let best: { h: Hazard; d: number } | null = null;
  for (const h of hole.hazards) {
    if (kinds && !kinds.includes(h.kind)) continue;
    const d = signedDist(h, p);
    if (!best || d < best.d) best = { h, d };
  }
  return best;
}

const clearance = (hole: HoleView, p: Pt) => nearestHazard(hole, p)?.d ?? Infinity;
export const onGreen = (hole: HoleView, p: Pt) => inPoly(p, hole.greenPts);
const inFairway = (hole: HoleView, p: Pt, margin: number) => hole.fairways.some((pts) => polyDist(p, pts) < -margin);
/** Typical sideways miss for a shot of d metres. */
export const spread = (d: number) => 3 + 0.065 * d;
export const lengthSpread = (d: number) => 3 + 0.05 * d;

export const sortedBag = (bag: Club[]) => bag.filter((c) => c.carry > 0).slice().sort((a, b) => b.carry - a.carry);

export function clubFor(bag: Club[], d: number): { name: string; partial: boolean; short?: boolean } {
  const b = sortedBag(bag);
  if (!b.length) return { name: 'Club', partial: false };
  if (d > b[0].carry) return { name: b[0].name, partial: false, short: true };
  const fits = b.filter((c) => c.carry >= d - 3);
  const c = fits[fits.length - 1];
  return { name: c.name, partial: c.carry - d > 12 };
}

/** Where p sits relative to a shot from `from` towards `to`. */
function relative(from: Pt, to: Pt, p: Pt): { along: number; lat: number } {
  const L = dist(from, to) || 1;
  const ux = (to[0] - from[0]) / L;
  const uy = (to[1] - from[1]) / L;
  const vx = p[0] - to[0];
  const vy = p[1] - to[1];
  return { along: vx * ux + vy * uy, lat: -(ux * vy - uy * vx) };
}

export function reachCarry(h: Hazard, ball: Pt): [number, number] {
  let lo = Infinity;
  let hi = 0;
  for (const q of h.edge) {
    const d = dist(ball, q);
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  return [lo, hi];
}

const kindName = (k: HazardKind) => (k === 'bunker' ? 'bunker' : k === 'water' ? 'water' : 'trees');
const m = Math.round;

export interface Suggestion {
  club: string;
  target: Pt;
  d: number;
  why: string;
}

export function suggest(hole: HoleView, ball: Pt, bag: Club[]): Suggestion {
  const pin = hole.pin;
  const dG = dist(ball, pin);
  const b = sortedBag(bag);
  const longest = b.length ? b[0].carry : 0;
  if (onGreen(hole, ball)) return { club: 'Putter', target: pin, d: dG, why: 'You are on the green. Read the slope from behind the ball and roll it to the hole.' };
  if (dG < 45) {
    return {
      club: dG < 25 ? 'Chip' : b[b.length - 1]?.name ?? 'Wedge',
      target: pin,
      d: dG,
      why: dG < 25 ? 'Land it on the front edge and let it release to the pin.' : 'Half swing, carry it onto the green and let it settle.',
    };
  }

  if (dG <= longest + 8) {
    const club = clubFor(bag, dG);
    const near = hole.hazards
      .filter((h) => h.kind !== 'trees')
      .map((h) => ({ h, d: signedDist(h, pin) }))
      .filter((x) => x.d < 20)
      .sort((a, c) => a.d - c.d);
    let why = 'Aim for the middle of the green.';
    const watch = near.find((x) => x.h.kind === 'water') ?? near[0];
    if (watch) {
      const r = relative(ball, pin, [watch.h.x, watch.h.y]);
      const where = r.along < -Math.abs(r.lat) ? 'short' : r.along > Math.abs(r.lat) ? 'long' : r.lat < 0 ? 'left' : 'right';
      const advice = { short: 'take enough club', long: 'don’t go long', left: 'favour the right half', right: 'favour the left half' }[where];
      const what = watch.h.kind === 'water' ? 'Water' : 'Bunker';
      why += ` ${what} ${where === 'short' || where === 'long' ? where + ' of' : 'on the ' + where + ' of'} the green, so ${advice}.`;
    }
    if (club.short) why += ` This is at the top of your range with ${club.name}.`;
    if (club.partial) why += ` Take a little off ${club.name}.`;
    return { club: club.name, target: pin, d: dG, why };
  }

  // Lay-up or tee shot: try each club along an arc and keep the best landing spot.
  const toPin = Math.atan2(pin[1] - ball[1], pin[0] - ball[0]);
  let best: { score: number; p: Pt; c: Club; spr: number } | null = null;
  for (const c of b) {
    if (c.carry > dG - 30) continue;
    for (let a = -45; a <= 45; a += 2.5) {
      const th = toPin + a * D2R;
      const p: Pt = [ball[0] + c.carry * Math.cos(th), ball[1] + c.carry * Math.sin(th)];
      const spr = spread(c.carry);
      const clr = clearance(hole, p);
      const r = dist(p, pin);
      let score = -r;
      if (!inFairway(hole, p, 3)) score -= 60;
      score += clr < spr ? -(40 + (spr - clr) * 4) : Math.min(clr - spr, 12) * 0.8;
      if (r < 75) score -= (75 - r) * 2.2;
      if (!best || score > best.score) best = { score, p, c, spr };
    }
  }
  if (!best) return { club: b[0]?.name ?? 'Club', target: pin, d: dG, why: 'Move it forward and keep it in play.' };

  const lat = project(hole.line, best.p).lat;
  const side = lat > 5 ? 'right side' : lat < -5 ? 'left side' : 'middle';
  let why = `Aim at the ${side} of the fairway.`;
  const n = nearestHazard(hole, best.p, ['bunker', 'water']);
  if (n && n.d < best.spr + 25) {
    const r = relative(ball, best.p, [n.h.x, n.h.y]);
    const name = kindName(n.h.kind);
    const hside = r.lat < 0 ? 'left' : 'right';
    if (r.along > Math.abs(r.lat)) why += ` Stays ${m(reachCarry(n.h, ball)[0] - best.c.carry)} m short of the ${name}.`;
    else if (r.along < -Math.abs(r.lat)) why += ` Carries the ${name} on the ${hside}.`;
    else why += ` Keeps you clear of the ${name} on the ${hside}.`;
  }
  return { club: best.c.name, target: best.p, d: best.c.carry, why };
}

export function describeCustom(hole: HoleView, ball: Pt, target: Pt, bag: Club[]): { club: string; d: number; why: string; risky: boolean } {
  const d = dist(ball, target);
  const b = sortedBag(bag);
  const club = clubFor(bag, d);
  const spr = spread(d);
  const n = nearestHazard(hole, target);
  const parts: string[] = [];
  let risky = false;
  if (n && n.d < 0) {
    parts.push(`That’s in the ${kindName(n.h.kind)}.`);
    risky = true;
  } else if (n && n.d < spr) {
    parts.push(`${n.h.kind === 'trees' ? 'Trees are' : n.h.kind === 'water' ? 'Water is' : 'A bunker is'} inside your usual miss of ±${m(spr)} m.`);
    risky = true;
  } else parts.push(`Clear of hazards within your usual miss of ±${m(spr)} m.`);
  if (b.length && d > b[0].carry + 5) {
    parts.push(`Further than your longest club (${b[0].name}, ${b[0].carry} m).`);
    risky = true;
  }
  if (onGreen(hole, target)) parts.push('Finishes on the green.');
  return { club: club.name, d, why: parts.join(' '), risky };
}

/** Front, middle and back of the green along the line from the ball to the pin. */
export function greenDistances(h: HoleView, ball: Pt): [number, number, number] {
  const P = h.pin;
  const d = dist(ball, P) || 1;
  const ux = (P[0] - ball[0]) / d;
  const uy = (P[1] - ball[1]) / d;
  const g = h.greenPts;
  const ts: number[] = [];
  for (let i = 0; i < g.length; i++) {
    const a = g[i];
    const b = g[(i + 1) % g.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = a[0] - ball[0];
    const wy = a[1] - ball[1];
    const t = (wx * ey - wy * ex) / den;
    const u = (wx * uy - wy * ux) / den;
    if (u >= 0 && u <= 1 && t > 0) ts.push(t);
  }
  if (!ts.length) return [m(d), m(d), m(d)];
  const front = Math.min(...ts);
  const back = Math.max(...ts);
  return [m(front), m((front + back) / 2), m(back)];
}

/** Hazards ahead of the ball worth a reach / carry label. */
export function hazardLabels(h: HoleView, ball: Pt): Array<{ hz: Hazard; lo: number; hi: number }> {
  const dG = dist(ball, h.pin);
  return [...h.bunkers, ...h.water]
    .map((hz) => {
      const [lo, hi] = reachCarry(hz, ball);
      return { hz, lo, hi, ahead: relative(ball, h.pin, [hz.x, hz.y]).along > -dG + 8 };
    })
    .filter((x) => x.ahead && x.lo >= 8 && x.lo <= dG + 25 && !(dG > 210 && dist([x.hz.x, x.hz.y], h.pin) < 28))
    .sort((a, b) => a.lo - b.lo);
}
