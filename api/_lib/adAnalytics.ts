import { sql } from './db';
import { periodWindow, type StatsPeriod } from './periods';
import { MONTH_LETTERS } from './monthly';

export interface AdPerformanceRow {
  adId: string;
  courseId: string | null;
  courseName: string;
  title: string;
  placement: string;
  mediaType: string;
  active: boolean;
  clicks: number;
  impressions: number;
  ctr: number; // percentage (clicks / impressions * 100), 0 when there are no impressions
}

function computeCtr(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return Math.round((clicks / impressions) * 1000) / 10;
}

// Ad performance was deliberately excluded from the course-admin dashboard
// — only a super_admin sees how ads perform across every club that's
// running them. course_id null means a global ad (shown to every club),
// hence the left join instead of an inner one. Clicks/impressions are
// period-scoped (an ad created long ago still shows, just with 0s outside
// its active window); count(distinct ...) undoes the row-multiplying
// effect of joining both ad_clicks and ad_impressions onto the same ad.
export async function getAdPerformanceReport(period: StatsPeriod): Promise<AdPerformanceRow[]> {
  const { currentStart } = periodWindow(period);
  const rows = (await sql`
    select a.id as ad_id, a.course_id, coalesce(c.name, 'All Courses') as course_name, a.title, a.placement, a.media_type, a.active,
           count(distinct k.id) filter (where k.clicked_at >= ${currentStart})::int as clicks,
           count(distinct i.id) filter (where i.viewed_at >= ${currentStart})::int as impressions
    from ads a
    left join courses c on c.id = a.course_id
    left join ad_clicks k on k.ad_id = a.id
    left join ad_impressions i on i.ad_id = a.id
    group by a.id, c.name
    order by clicks desc
    limit 50
  `) as Array<{
    ad_id: string;
    course_id: string | null;
    course_name: string;
    title: string;
    placement: string;
    media_type: string;
    active: boolean;
    clicks: number;
    impressions: number;
  }>;
  return rows.map((r) => ({
    adId: r.ad_id,
    courseId: r.course_id,
    courseName: r.course_name,
    title: r.title,
    placement: r.placement,
    mediaType: r.media_type,
    active: r.active,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: computeCtr(r.clicks, r.impressions),
  }));
}

export interface AdTrendPoint {
  label: string;
  clicks: number;
  impressions: number;
}

function bucketMaps(
  clickRows: Array<{ bucket: string | number; value: number }>,
  impressionRows: Array<{ bucket: string | number; value: number }>,
) {
  const clicks = new Map<string | number, number>();
  for (const r of clickRows) clicks.set(r.bucket, r.value);
  const impressions = new Map<string | number, number>();
  for (const r of impressionRows) impressions.set(r.bucket, r.value);
  return { clicks, impressions };
}

function monthYearLabel(bucket: string): string {
  // bucket is 'YYYY-MM'
  const [year, month] = bucket.split('-').map(Number);
  return `${MONTH_LETTERS[month - 1]}${String(year).slice(2)}`;
}

// Clicks + impressions over time, optionally scoped to one ad (the ad
// detail page) or across every ad (the top-level Ad Performance report).
// Bucketed by day within the current month for period='month', by
// calendar month for 'year' (Jan-Dec, matching the pattern used elsewhere
// for "this year" charts), and by calendar month since the very first
// recorded event for 'all' (this app is new enough that this stays a
// reasonably-sized chart without needing an explicit cap).
export async function getAdTrend(period: StatsPeriod, adId?: string): Promise<AdTrendPoint[]> {
  const { currentStart } = periodWindow(period);
  const adFilter = adId ? sql`and ad_id = ${adId}` : sql``;

  if (period === 'month') {
    const [clickRows, impressionRows] = await Promise.all([
      sql`
        select extract(day from clicked_at)::int as bucket, count(*)::int as value
        from ad_clicks where clicked_at >= ${currentStart} ${adFilter}
        group by bucket
      `,
      sql`
        select extract(day from viewed_at)::int as bucket, count(*)::int as value
        from ad_impressions where viewed_at >= ${currentStart} ${adFilter}
        group by bucket
      `,
    ]);
    const { clicks, impressions } = bucketMaps(
      clickRows as Array<{ bucket: number; value: number }>,
      impressionRows as Array<{ bucket: number; value: number }>,
    );
    const now = new Date();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { label: String(day), clicks: clicks.get(day) ?? 0, impressions: impressions.get(day) ?? 0 };
    });
  }

  if (period === 'year') {
    const [clickRows, impressionRows] = await Promise.all([
      sql`
        select extract(month from clicked_at)::int as bucket, count(*)::int as value
        from ad_clicks where clicked_at >= ${currentStart} ${adFilter}
        group by bucket
      `,
      sql`
        select extract(month from viewed_at)::int as bucket, count(*)::int as value
        from ad_impressions where viewed_at >= ${currentStart} ${adFilter}
        group by bucket
      `,
    ]);
    const { clicks, impressions } = bucketMaps(
      clickRows as Array<{ bucket: number; value: number }>,
      impressionRows as Array<{ bucket: number; value: number }>,
    );
    return MONTH_LETTERS.map((letter, i) => ({
      label: letter,
      clicks: clicks.get(i + 1) ?? 0,
      impressions: impressions.get(i + 1) ?? 0,
    }));
  }

  // 'all': one bucket per calendar month since the first ever event.
  const [clickRows, impressionRows] = await Promise.all([
    sql`
      select to_char(clicked_at, 'YYYY-MM') as bucket, count(*)::int as value
      from ad_clicks where clicked_at >= ${currentStart} ${adFilter}
      group by bucket order by bucket
    `,
    sql`
      select to_char(viewed_at, 'YYYY-MM') as bucket, count(*)::int as value
      from ad_impressions where viewed_at >= ${currentStart} ${adFilter}
      group by bucket order by bucket
    `,
  ]);
  const clickTyped = clickRows as Array<{ bucket: string; value: number }>;
  const impressionTyped = impressionRows as Array<{ bucket: string; value: number }>;
  const { clicks, impressions } = bucketMaps(clickTyped, impressionTyped);
  const allBuckets = Array.from(new Set([...clickTyped.map((r) => r.bucket), ...impressionTyped.map((r) => r.bucket)])).sort();
  return allBuckets.map((b) => ({ label: monthYearLabel(b), clicks: clicks.get(b) ?? 0, impressions: impressions.get(b) ?? 0 }));
}

export interface AdClickLogRow {
  id: string;
  memberName: string | null;
  memberEmail: string | null;
  clickedAt: string;
}

// The individual click log behind one ad's summary count — who clicked
// and when. Impressions aren't itemized here (far higher volume, and "who
// viewed this" isn't the actionable question the way "who clicked" is) —
// they only ever appear as counts/CTR/trend.
export async function getAdClickLog(adId: string, period: StatsPeriod): Promise<AdClickLogRow[]> {
  const { currentStart } = periodWindow(period);
  const rows = (await sql`
    select k.id, u.first_name, u.last_name, u.email, k.clicked_at
    from ad_clicks k
    left join users u on u.id = k.user_id
    where k.ad_id = ${adId} and k.clicked_at >= ${currentStart}
    order by k.clicked_at desc
    limit 500
  `) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    clicked_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    memberName: r.first_name ? `${r.first_name} ${r.last_name ?? ''}`.trim() : null,
    memberEmail: r.email,
    clickedAt: r.clicked_at,
  }));
}
