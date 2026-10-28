// Builds a Flagrr course map file from OpenStreetMap geometry plus a card file
// typed up from the club's scorecard photos. See docs/Course-Maps.md.
//
//   npx tsx scripts/course-maps/build.ts strand-golf-club          (uses the cached OSM download)
//   npx tsx scripts/course-maps/build.ts strand-golf-club --refresh (downloads OSM again)
//
// Reads  course-maps/cards/<slug>.card.json
// Caches course-maps/osm/<slug>.osm.json
// Writes course-maps/<slug>.json, ready to import in the super admin console.

import fs from 'node:fs';
import path from 'node:path';
import { teeStart, centroid } from '../../mobile/src/golf/holeGeometry';
import { checkCourseMap, type CourseMapFile, type FeatureKind, type GenderCard, type Pt, type TeeDef } from '../../mobile/src/golf/courseMap';

interface CardFile {
  name: string;
  location: string;
  // The middle of the course and a radius (metres) that reaches every hole
  // but no neighbouring course's holes.
  osm: { lat: number; lon: number; radius: number };
  holeCount: 9 | 18;
  tees: TeeDef[];
  card: Partial<Record<'men' | 'ladies', GenderCard>>;
  notes?: string[];
}

interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
interface OsmWay { type: 'way'; id: number; geometry?: Array<{ lat: number; lon: number }>; tags?: Record<string, string> }
interface OsmRelation {
  type: 'relation';
  id: number;
  tags?: Record<string, string>;
  members: Array<{ type: string; role: string; geometry?: Array<{ lat: number; lon: number }> }>;
}
type OsmElement = OsmNode | OsmWay | OsmRelation;

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'course-maps');
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'flagrr-course-map-builder/1.0 (https://flagrr.com)';
const MARGIN_METRES = 200; // trees and water just outside the boundary still matter
const EARTH_R = 6_371_008.8;

const r1 = (v: number) => Math.round(v * 10) / 10;

async function overpass(query: string): Promise<OsmElement[]> {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }).toString(),
  });
  if (!res.ok) throw new Error(`Overpass returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { elements: OsmElement[] }).elements;
}

async function downloadOsm(card: CardFile): Promise<{ elements: OsmElement[] }> {
  // Course boundaries on OpenStreetMap are often split or partial (Strand's
  // only covers the western holes), so the holes themselves decide the area.
  const { lat, lon, radius } = card.osm;
  const holes = (await overpass(`[out:json][timeout:60];way["golf"="hole"](around:${radius},${lat},${lon});out geom;`)) as OsmWay[];
  const pts = holes.flatMap((h) => h.geometry ?? []);
  if (!pts.length) throw new Error(`No golf=hole ways within ${radius} m of ${lat},${lon}.`);
  const dLat = (MARGIN_METRES / EARTH_R) * (180 / Math.PI);
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const s = Math.min(...pts.map((p) => p.lat)) - dLat;
  const n = Math.max(...pts.map((p) => p.lat)) + dLat;
  const w = Math.min(...pts.map((p) => p.lon)) - dLon;
  const e = Math.max(...pts.map((p) => p.lon)) + dLon;
  const elements = await overpass(`[out:json][timeout:90][bbox:${s},${w},${n},${e}];(
    nwr["golf"];
    way["natural"~"^(water|wood|scrub|tree_row)$"];
    relation["natural"~"^(water|wood|scrub)$"];
    way["landuse"="forest"];
    relation["landuse"="forest"];
  );out geom;`);
  // Only the holes found around the point belong to this course; a
  // neighbouring course's holes in the wider box are dropped.
  const own = new Set(holes.map((h) => h.id));
  return { elements: elements.filter((el) => el.type !== 'way' || el.tags?.golf !== 'hole' || own.has(el.id)) };
}

/** Joins a relation's member ways into closed rings. */
function rings(members: Array<{ geometry?: Array<{ lat: number; lon: number }> }>): Array<Array<{ lat: number; lon: number }>> {
  const open = members.map((m) => (m.geometry ?? []).slice()).filter((g) => g.length > 1);
  const out: Array<Array<{ lat: number; lon: number }>> = [];
  const same = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => a.lat === b.lat && a.lon === b.lon;
  while (open.length) {
    const ring = open.shift()!;
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < open.length; i++) {
        const g = open[i];
        const end = ring[ring.length - 1];
        if (same(g[0], end)) ring.push(...g.slice(1));
        else if (same(g[g.length - 1], end)) ring.push(...g.slice(0, -1).reverse());
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) out.push(ring);
  }
  return out;
}

function main() {
  return (async () => {
    const slug = process.argv[2];
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error('Usage: build.ts <slug> [--refresh]');
    const card = JSON.parse(fs.readFileSync(path.join(DIR, 'cards', `${slug}.card.json`), 'utf8')) as CardFile;
    const cachePath = path.join(DIR, 'osm', `${slug}.osm.json`);
    let osm: { elements: OsmElement[] };
    if (process.argv.includes('--refresh') || !fs.existsSync(cachePath)) {
      osm = await downloadOsm(card);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify({ downloadedAt: new Date().toISOString(), ...osm }));
      console.log(`Downloaded ${osm.elements.length} OpenStreetMap elements.`);
    } else {
      osm = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }

    // Equirectangular projection around the card's point: metres east / north.
    const lat0 = card.osm.lat;
    const lon0 = card.osm.lon;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const P = (g: { lat: number; lon: number }): Pt => [
      r1(((g.lon - lon0) * Math.PI) / 180 * EARTH_R * k),
      r1(((g.lat - lat0) * Math.PI) / 180 * EARTH_R),
    ];
    // OSM closes rings by repeating the first point; the map format doesn't.
    const ring = (g: Array<{ lat: number; lon: number }>) => {
      const pts = g.map(P);
      const [a, b] = [pts[0], pts[pts.length - 1]];
      return a[0] === b[0] && a[1] === b[1] ? pts.slice(0, -1) : pts;
    };
    const areaRings = (e: OsmElement): Pt[][] => {
      if (e.type === 'way') return e.geometry && e.geometry.length >= 4 ? [ring(e.geometry)] : [];
      if (e.type === 'relation') {
        const outer = rings(e.members.filter((m) => m.role !== 'inner')).map(ring);
        const inner = rings(e.members.filter((m) => m.role === 'inner')).map(ring);
        return outer.length ? [outer[0], ...outer.slice(1), ...inner] : [];
      }
      return [];
    };

    const warnings: string[] = [];
    const ways = osm.elements.filter((e): e is OsmWay => e.type === 'way');
    const holeWays = ways.filter((w) => w.tags?.golf === 'hole' && w.geometry);
    const holes: CourseMapFile['holes'] = [];
    for (let n = 1; n <= card.holeCount; n++) {
      const w = holeWays.filter((h) => Number(h.tags?.ref) === n);
      if (w.length !== 1) throw new Error(`Expected one golf=hole way with ref=${n} in OpenStreetMap, found ${w.length}.`);
      holes.push({ n, path: w[0].geometry!.map(P) });
      const osmPar = Number(w[0].tags?.par);
      for (const g of ['men', 'ladies'] as const) {
        const cardPar = card.card[g]?.par[n - 1];
        if (osmPar && cardPar && osmPar !== cardPar) warnings.push(`Hole ${n}: OpenStreetMap says par ${osmPar}, the ${g}'s card says ${cardPar} (the card wins).`);
      }
    }
    const end = (n: number) => holes[n - 1].path[holes[n - 1].path.length - 1];
    const start = (n: number) => holes[n - 1].path[0];
    const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const centre = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    const nearestHole = (p: Pt, at: (n: number) => Pt) => holes.reduce((best, h) => (d(p, at(h.n)) < d(p, at(best.n)) ? h : best)).n;

    const greens: CourseMapFile['greens'] = [];
    for (const w of ways.filter((x) => x.tags?.golf === 'green' && x.geometry)) {
      const pts = ring(w.geometry!);
      const c = centre(pts);
      const n = nearestHole(c, end);
      // A green far from every hole's end is a practice green.
      greens.push({ hole: d(c, end(n)) < 40 ? n : 0, pts });
    }
    for (const h of holes) {
      const mine = greens.filter((g) => g.hole === h.n);
      if (mine.length !== 1) throw new Error(`Hole ${h.n}: expected one green near the end of the hole, found ${mine.length}.`);
    }

    const teeIds = new Set(card.tees.map((t) => t.id));
    const teeBoxes: CourseMapFile['teeBoxes'] = [];
    for (const w of ways.filter((x) => x.tags?.golf === 'tee' && x.geometry)) {
      const pts = ring(w.geometry!);
      const named = /(\d+)/.exec(w.tags?.ref ?? w.tags?.name ?? '');
      const n = named ? Number(named[1]) : nearestHole(centre(pts), start);
      if (n < 1 || n > card.holeCount) continue;
      const tees = (w.tags?.tee ?? '').split(/[;,]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
      const unknown = tees.filter((t) => !teeIds.has(t));
      if (unknown.length) warnings.push(`Hole ${n}: tee box marked "${unknown.join(', ')}" has no matching tee in the card file.`);
      teeBoxes.push({ hole: n, tees: tees.filter((t) => teeIds.has(t)), pts });
    }

    const features: CourseMapFile['features'] = [];
    const kindOf = (t: Record<string, string>): FeatureKind | null => {
      if (t.golf === 'bunker') return 'bunker';
      if (t.golf === 'fairway') return 'fairway';
      if (t.golf === 'water_hazard' || t.golf === 'lateral_water_hazard' || t.natural === 'water') return 'water';
      if (t.natural === 'wood' || t.landuse === 'forest') return 'wood';
      if (t.natural === 'scrub') return 'scrub';
      if (t.natural === 'tree_row') return 'treerow';
      if (t.golf === 'cartpath') return 'cartpath';
      if (t.golf === 'driving_range' || t.golf === 'practice') return 'range';
      return null;
    };
    for (const e of osm.elements) {
      const kind = e.tags ? kindOf(e.tags) : null;
      if (!kind) continue;
      if (kind === 'treerow' || kind === 'cartpath') {
        if (e.type === 'way' && e.geometry && e.geometry.length > 1) features.push({ k: kind, l: e.geometry.map(P) });
      } else {
        const r = areaRings(e);
        if (r.length) features.push({ k: kind, r });
      }
    }

    // Tees whose map position is too far from the card length start from the
    // card length on the hole's centre line instead (see teeStart).
    for (const t of card.tees) {
      const placed: number[] = [];
      holes.forEach((h, i) => {
        const box = teeBoxes.find((b) => b.hole === h.n && b.tees.includes(t.id)) ?? teeBoxes.find((b) => b.hole === h.n);
        if (box && teeStart(h.path, centroid(box.pts), t.lengths[i]).fromCard) placed.push(h.n);
      });
      if (placed.length) warnings.push(`${t.name} tees on hole${placed.length > 1 ? 's' : ''} ${placed.join(', ')}: the map's tee box is more than 15 m off the card length, so the tee is placed from the card length.`);
    }

    const map: CourseMapFile = {
      format: 'flagrr-course-map',
      version: 1,
      name: card.name,
      location: card.location,
      origin: [lat0, lon0],
      attribution: '© OpenStreetMap contributors (ODbL)',
      holeCount: card.holeCount,
      holes,
      greens,
      teeBoxes,
      features,
      tees: card.tees,
      card: card.card,
      notes: [...(card.notes ?? []), ...warnings],
    };
    const check = checkCourseMap(map);
    fs.writeFileSync(path.join(DIR, `${slug}.json`), JSON.stringify(map));
    console.log(`Wrote course-maps/${slug}.json: ${holes.length} holes, ${greens.length} greens, ${teeBoxes.length} tee boxes, ${features.length} features.`);
    for (const w of warnings) console.log(`warning: ${w}`);
    for (const e of check.errors) console.log(`ERROR: ${e}`);
    for (const b of check.blockers) console.log(`not ready to publish: ${b}`);
    if (check.errors.length) process.exitCode = 1;
    else if (!check.blockers.length) console.log('Ready to publish.');
  })();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
