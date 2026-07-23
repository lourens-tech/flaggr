export const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// monthly_points keys rows by calendar month number (1-12) to stay
// collision-free — several months share a first letter (Jan/Jun/Jul,
// Mar/May, Apr/Aug), so keying by letter directly would merge unrelated
// months into the same row. This zero-fills all 12 months in order and
// maps each back to its display letter for the bar chart, matching the
// letter-labeled x-axis used everywhere else in the app.
export function fillMonthlyByNumber(rows: Array<{ month: number; value: number }>): Array<{ month: string; value: number }> {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.month, row.value);
  return MONTH_LETTERS.map((letter, i) => ({ month: letter, value: counts.get(i + 1) ?? 0 }));
}
