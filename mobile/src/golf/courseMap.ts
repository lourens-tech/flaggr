// The course map file format, shared by the app (which draws it) and the API
// (which validates it on import and snapshots its card into each round).
// Pure TypeScript with no React Native imports, so api/ can import it too.
//
// Positions are metres east (x) and north (y) of `origin`, so distances on the
// map are plain Euclidean distances. Built by scripts/course-maps/build.ts from
// OpenStreetMap geometry plus the club's scorecard (see docs/Course-Maps.md).

export type Pt = [number, number];
export type Gender = 'men' | 'ladies';
export const GENDERS: Gender[] = ['men', 'ladies'];

export type FeatureKind = 'bunker' | 'fairway' | 'water' | 'wood' | 'scrub' | 'treerow' | 'cartpath' | 'range';
export const FEATURE_KINDS: FeatureKind[] = ['bunker', 'fairway', 'water', 'wood', 'scrub', 'treerow', 'cartpath', 'range'];
// Kinds drawn as areas (r: rings, first ring the outline, any others holes in
// it) versus lines (l: an open polyline).
const LINE_KINDS: FeatureKind[] = ['treerow', 'cartpath'];

export interface Rating {
  cr: number; // Course Rating
  slope: number; // Slope Rating
}

/** A tee's ratings for one gender. `full` rates the whole course (18 holes,
 * or 9 on a 9-hole course); front9/back9 are the separate 9-hole ratings an
 * 18-hole course publishes, needed before a member can play just one nine. */
export interface TeeRatings {
  full: Rating;
  front9?: Rating;
  back9?: Rating;
}

export interface TeeDef {
  id: string; // 'white'
  name: string; // 'White'
  color: string; // '#F4F4F2'
  lengths: Array<number | null>; // metres per hole, from the scorecard
  ratings: Partial<Record<Gender, TeeRatings>>;
}

export interface GenderCard {
  par: number[];
  si: Array<number | null>; // stroke index per hole
}

export interface CourseMapFile {
  format: 'flagrr-course-map';
  version: 1;
  name: string;
  location: string;
  origin: [number, number]; // [lat, lon]
  attribution: string;
  holeCount: 9 | 18;
  // Centre line of each hole from the back tee to the middle of the green.
  // The last point is where the flag is drawn and distances are measured to.
  holes: Array<{ n: number; path: Pt[] }>;
  greens: Array<{ hole: number; pts: Pt[] }>;
  teeBoxes: Array<{ hole: number; tees: string[]; pts: Pt[] }>;
  features: Array<{ k: FeatureKind; r?: Pt[][]; l?: Pt[] }>;
  tees: TeeDef[];
  card: Partial<Record<Gender, GenderCard>>;
  // Where the card data came from and anything still to confirm, shown to the
  // super admin on import. Never shown to members.
  notes?: string[];
}

export type Layout = 'full' | 'front9' | 'back9';

export interface CourseMapCheck {
  errors: string[]; // the file can't be imported at all
  blockers: string[]; // importable as a draft, but can't go live yet
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
const isPts = (v: unknown, min: number): v is Pt[] => Array.isArray(v) && v.length >= min && v.every(isPt);

/** Rating ranges wide enough for any real course, narrow enough to catch a
 * slope typed into the rating box or a 9-hole rating entered as 18. */
const RATING_RANGES = {
  full18: { cr: [55, 85] as const },
  nine: { cr: [27, 43] as const },
  slope: [55, 155] as const,
};

function checkRating(r: unknown, nine: boolean, label: string, out: string[]) {
  const rr = r as Rating | undefined;
  if (!rr || !isNum(rr.cr) || !isNum(rr.slope)) {
    out.push(`${label}: needs a Course Rating and Slope.`);
    return;
  }
  const [lo, hi] = nine ? RATING_RANGES.nine.cr : RATING_RANGES.full18.cr;
  if (rr.cr < lo || rr.cr > hi) out.push(`${label}: Course Rating ${rr.cr} is outside ${lo}–${hi}.`);
  if (!Number.isInteger(rr.slope) || rr.slope < RATING_RANGES.slope[0] || rr.slope > RATING_RANGES.slope[1]) {
    out.push(`${label}: Slope ${rr.slope} must be a whole number from 55 to 155.`);
  }
}

/** Every stroke index from 1 to n exactly once. */
function isSiPermutation(si: Array<number | null>, n: number): boolean {
  if (si.length !== n || si.some((v) => v == null || !Number.isInteger(v))) return false;
  const seen = new Set(si as number[]);
  return seen.size === n && [...seen].every((v) => v >= 1 && v <= n);
}

export function checkCourseMap(input: unknown): CourseMapCheck {
  const errors: string[] = [];
  const blockers: string[] = [];
  const m = input as CourseMapFile;
  if (!m || typeof m !== 'object') return { errors: ['The file is not a course map.'], blockers };
  if (m.format !== 'flagrr-course-map' || m.version !== 1) {
    return { errors: ['The file is not a Flagrr course map (version 1).'], blockers };
  }
  if (typeof m.name !== 'string' || !m.name.trim()) errors.push('The course needs a name.');
  if (typeof m.location !== 'string') errors.push('location must be text (it can be empty).');
  if (!Array.isArray(m.origin) || m.origin.length !== 2 || !isNum(m.origin[0]) || !isNum(m.origin[1])) {
    errors.push('origin must be [latitude, longitude].');
  }
  if (typeof m.attribution !== 'string' || !m.attribution.trim()) errors.push('attribution is required (the map data licence).');
  if (m.holeCount !== 9 && m.holeCount !== 18) {
    errors.push('holeCount must be 9 or 18.');
    return { errors, blockers };
  }
  const n = m.holeCount;

  if (!Array.isArray(m.holes) || m.holes.length !== n) errors.push(`holes must list all ${n} holes.`);
  else {
    m.holes.forEach((h, i) => {
      if (h?.n !== i + 1) errors.push(`holes[${i}] should be hole ${i + 1}.`);
      if (!isPts(h?.path, 2)) errors.push(`Hole ${i + 1}: path needs at least a tee and a green point.`);
    });
  }
  if (!Array.isArray(m.greens)) errors.push('greens must be a list.');
  else {
    m.greens.forEach((g, i) => {
      if (!Number.isInteger(g?.hole) || !isPts(g?.pts, 3)) errors.push(`greens[${i}] needs a hole number and an outline.`);
    });
    for (let h = 1; h <= n; h++) if (!m.greens.some((g) => g?.hole === h)) errors.push(`Hole ${h} has no green outline.`);
  }
  if (!Array.isArray(m.teeBoxes)) errors.push('teeBoxes must be a list.');
  else {
    m.teeBoxes.forEach((t, i) => {
      if (!Number.isInteger(t?.hole) || !Array.isArray(t?.tees) || !isPts(t?.pts, 3)) {
        errors.push(`teeBoxes[${i}] needs a hole number, its tees and an outline.`);
      }
    });
  }
  if (!Array.isArray(m.features)) errors.push('features must be a list.');
  else {
    m.features.forEach((f, i) => {
      if (!FEATURE_KINDS.includes(f?.k)) errors.push(`features[${i}] has an unknown kind "${f?.k}".`);
      else if (LINE_KINDS.includes(f.k) ? !isPts(f.l, 2) : !(Array.isArray(f.r) && f.r.length > 0 && f.r.every((r) => isPts(r, 3)))) {
        errors.push(`features[${i}] (${f.k}) has no usable geometry.`);
      }
    });
  }

  const teeIds = new Set<string>();
  if (!Array.isArray(m.tees) || m.tees.length === 0) errors.push('The course needs at least one tee.');
  else {
    m.tees.forEach((t, i) => {
      const label = `Tee ${t?.name || i + 1}`;
      if (typeof t?.id !== 'string' || !/^[a-z0-9-]+$/.test(t.id)) errors.push(`${label}: id must be lower-case letters, digits or dashes.`);
      else if (teeIds.has(t.id)) errors.push(`${label}: id "${t.id}" is used twice.`);
      else teeIds.add(t.id);
      if (typeof t?.name !== 'string' || !t.name.trim()) errors.push(`${label}: needs a name.`);
      if (typeof t?.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(t.color)) errors.push(`${label}: color must be #RRGGBB.`);
      if (!Array.isArray(t?.lengths) || t.lengths.length !== n || t.lengths.some((v) => v != null && (!isNum(v) || v < 40 || v > 700))) {
        errors.push(`${label}: lengths must list ${n} hole lengths in metres (40–700) or null.`);
      }
      if (!t?.ratings || typeof t.ratings !== 'object') errors.push(`${label}: ratings must be an object (it can be empty).`);
    });
  }
  if (!m.card || typeof m.card !== 'object') errors.push('card must be an object.');

  if (errors.length) return { errors, blockers };

  // --- Publish blockers: everything a member needs for correct scores. ---
  const ratedGenders = GENDERS.filter((g) => m.tees.some((t) => t.ratings[g]));
  if (!ratedGenders.length) blockers.push('No tee has a Course Rating and Slope yet.');
  for (const g of GENDERS) {
    const card = m.card[g];
    const who = g === 'men' ? "Men's" : "Ladies'";
    if (!card) {
      if (ratedGenders.includes(g)) blockers.push(`${who} par and stroke index are missing.`);
      continue;
    }
    if (!Array.isArray(card.par) || card.par.length !== n || card.par.some((p) => !Number.isInteger(p) || p < 3 || p > 6)) {
      blockers.push(`${who} par must be 3–6 on all ${n} holes.`);
    }
    if (!Array.isArray(card.si) || !isSiPermutation(card.si, n)) {
      blockers.push(`${who} stroke index must use each number 1–${n} once.`);
    }
  }
  for (const t of m.tees) {
    for (const g of GENDERS) {
      const r = t.ratings[g];
      if (!r) continue;
      const label = `${t.name} tees (${g})`;
      checkRating(r.full, n === 9, label, blockers);
      if (r.front9) checkRating(r.front9, true, `${label} front nine`, blockers);
      if (r.back9) checkRating(r.back9, true, `${label} back nine`, blockers);
      if (n === 9 && (r.front9 || r.back9)) blockers.push(`${label}: a 9-hole course has no separate nines.`);
    }
    if (GENDERS.some((g) => t.ratings[g])) {
      if (t.lengths.some((v) => v == null)) blockers.push(`${t.name} tees: hole lengths are missing.`);
      for (let h = 1; h <= n; h++) {
        if (!m.teeBoxes.some((b) => b.hole === h && b.tees.includes(t.id))) {
          blockers.push(`${t.name} tees: hole ${h} has no tee box on the map.`);
        }
      }
    }
  }
  return { errors, blockers };
}

/** The holes of a layout, as indexes into the course's holes. */
export function layoutHoleIndexes(holeCount: number, layout: Layout): number[] {
  const all = Array.from({ length: holeCount }, (_, i) => i);
  if (layout === 'front9') return all.slice(0, 9);
  if (layout === 'back9') return all.slice(9, 18);
  return all;
}

/** The rating a round uses, or null when that tee/gender/layout isn't rated. */
export function ratingFor(map: CourseMapFile, teeId: string, gender: Gender, layout: Layout): Rating | null {
  const r = map.tees.find((t) => t.id === teeId)?.ratings[gender];
  if (!r) return null;
  if (layout === 'full') return r.full;
  if (map.holeCount !== 18) return null;
  return (layout === 'front9' ? r.front9 : r.back9) ?? null;
}

export interface PlayOption {
  teeId: string;
  gender: Gender;
  layouts: Layout[];
}

/** Every tee/gender a member can start a round from, with the layouts rated for it. */
export function playOptions(map: CourseMapFile): PlayOption[] {
  const out: PlayOption[] = [];
  for (const t of map.tees) {
    for (const g of GENDERS) {
      if (!t.ratings[g] || !map.card[g]) continue;
      const layouts = (['full', 'front9', 'back9'] as Layout[]).filter((l) => ratingFor(map, t.id, g, l));
      out.push({ teeId: t.id, gender: g, layouts });
    }
  }
  return out;
}

export const LAYOUT_LABELS: Record<Layout, string> = { full: 'All holes', front9: 'Front nine', back9: 'Back nine' };
