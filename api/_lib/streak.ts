import { sql } from './db';

const STREAK_WINDOW_WEEKS = 8;

function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday));
}

function addWeeks(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n * 7));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface StreakInfo {
  weeks: number;
  activeSince: string;
  weeksPlayed: boolean[];
}

// Computed live from receipts rather than a stored counter, so it can never
// drift out of sync with what the member actually played. A "week" is any
// Mon-Sun period containing at least one approved receipt with a matched
// round (9 or 18 holes).
export async function computeStreak(userId: string): Promise<StreakInfo> {
  const rows = (await sql`
    select distinct date_trunc('week', r.submitted_at)::date as week_start
    from receipts r
    join receipt_items ri on ri.receipt_id = r.id
    join golf_activities ga on ga.id = ri.matched_activity_id
    where r.user_id = ${userId} and ga.category = 'rounds'
  `) as Array<{ week_start: string }>;

  const playedWeeks = new Set(rows.map((r) => r.week_start));
  const currentWeekStart = startOfWeekUTC(new Date());

  // A week still in progress that hasn't been played yet shouldn't zero out
  // an otherwise-unbroken streak — anchor on last week instead in that case.
  let anchor = currentWeekStart;
  if (!playedWeeks.has(isoDate(anchor))) {
    anchor = addWeeks(anchor, -1);
  }

  let weeks = 0;
  let cursor = anchor;
  while (playedWeeks.has(isoDate(cursor))) {
    weeks += 1;
    cursor = addWeeks(cursor, -1);
  }
  const activeSince = weeks > 0 ? isoDate(addWeeks(anchor, -(weeks - 1))) : isoDate(currentWeekStart);

  const weeksPlayed: boolean[] = [];
  for (let i = STREAK_WINDOW_WEEKS - 1; i >= 0; i--) {
    weeksPlayed.push(playedWeeks.has(isoDate(addWeeks(currentWeekStart, -i))));
  }

  return { weeks, activeSince, weeksPlayed };
}
