export type StatsPeriod = 'month' | 'year' | 'all';

const EPOCH = new Date(0);

export interface PeriodWindow {
  currentStart: Date;
  previousStart: Date;
  previousEnd: Date;
  hasComparison: boolean;
}

// "Current" always runs from the window start through now. "Previous" is the
// immediately preceding, equally-sized window — this month vs last month,
// this year vs last year. "all" has no meaningful prior period to compare
// against, so callers should force its deltaPct to 0 rather than trust the
// (always-zero) previous-window sums this returns.
export function periodWindow(period: StatsPeriod, now: Date = new Date()): PeriodWindow {
  if (period === 'month') {
    const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return { currentStart, previousStart, previousEnd: currentStart, hasComparison: true };
  }
  if (period === 'year') {
    const currentStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const previousStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    return { currentStart, previousStart, previousEnd: currentStart, hasComparison: true };
  }
  return { currentStart: EPOCH, previousStart: EPOCH, previousEnd: EPOCH, hasComparison: false };
}

export function deltaPct(current: number, previous: number, hasComparison: boolean): number {
  if (!hasComparison) return 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function isStatsPeriod(value: unknown): value is StatsPeriod {
  return value === 'month' || value === 'year' || value === 'all';
}
