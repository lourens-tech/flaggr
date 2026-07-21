// Exact/alias/fuzzy matching for OCR'd receipt text against a name+aliases
// catalog (golf products, golf activities, merchants). Pure string
// similarity — no external service, so it works the same in every
// environment with zero setup.

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Standard edit-distance DP. Inputs here are short (product names, receipt
// lines), so the O(n*m) table is negligible.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

// 1.0 = identical, 0.0 = completely different.
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // One is a substring of the other (e.g. "pro v1 dz" inside a longer OCR
  // line) — treat as a strong match rather than penalizing the length gap.
  if (na.includes(nb) || nb.includes(na)) return 0.92;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

export interface Catalog {
  id: string;
  name: string;
  aliases: string[];
}

export interface MatchResult<T extends Catalog> {
  item: T;
  score: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
}

const FUZZY_THRESHOLD = 0.72;

// Tries every candidate's name + aliases, keeps the best-scoring hit above
// the fuzzy threshold. Exact/alias matches (score === 1) short-circuit.
export function matchCatalog<T extends Catalog>(text: string, candidates: T[]): MatchResult<T> | null {
  const normalizedText = normalize(text);
  if (!normalizedText) return null;

  let best: MatchResult<T> | null = null;

  for (const candidate of candidates) {
    const nameScore = similarity(normalizedText, candidate.name);
    if (nameScore === 1) return { item: candidate, score: 1, matchType: 'exact' };
    if (!best || nameScore > best.score) {
      best = { item: candidate, score: nameScore, matchType: 'fuzzy' };
    }

    for (const alias of candidate.aliases) {
      const aliasScore = similarity(normalizedText, alias);
      if (aliasScore === 1) return { item: candidate, score: 1, matchType: 'alias' };
      if (!best || aliasScore > best.score) {
        best = { item: candidate, score: aliasScore, matchType: 'fuzzy' };
      }
    }
  }

  if (!best || best.score < FUZZY_THRESHOLD) return null;
  return best;
}
