export interface QuarterWindow {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

// Calendar quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec), UTC. Used for tier
// qualification, which is scoped to "this quarter" rather than lifetime.
export function quarterWindow(now: Date = new Date()): QuarterWindow {
  const year = now.getUTCFullYear();
  const qIndex = Math.floor(now.getUTCMonth() / 3);

  const currentStart = new Date(Date.UTC(year, qIndex * 3, 1));
  const currentEnd = new Date(Date.UTC(year, qIndex * 3 + 3, 1));

  const previousStart =
    qIndex === 0
      ? new Date(Date.UTC(year - 1, 9, 1))
      : new Date(Date.UTC(year, (qIndex - 1) * 3, 1));

  return { currentStart, currentEnd, previousStart, previousEnd: currentStart };
}
