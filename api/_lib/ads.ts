import { sql } from './db';

export type AdPlacement = 'home' | 'rewardsShop';

export interface AdDto {
  id: string;
  placement: AdPlacement;
  title: string;
  imageUrl: string | null;
  targetUrl: string | null;
}

const PLACEMENT_APP: Record<string, AdPlacement> = { home: 'home', rewards_shop: 'rewardsShop' };

/** Active ads for a course, across all placements, ordered for display.
 * Super-admin CRUD over the `ads` table is future work — this is the read
 * path the member app needs today. */
export async function getActiveAdsForCourse(courseId: string): Promise<AdDto[]> {
  const rows = (await sql`
    select id, placement, title, image_url, target_url
    from ads
    where course_id = ${courseId}
      and active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    order by placement, sort_order, created_at
  `) as Array<{ id: string; placement: string; title: string; image_url: string | null; target_url: string | null }>;

  return rows.map((r) => ({
    id: r.id,
    placement: PLACEMENT_APP[r.placement] ?? 'home',
    title: r.title,
    imageUrl: r.image_url,
    targetUrl: r.target_url,
  }));
}
