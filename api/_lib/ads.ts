import { sql } from './db';

export type AdPlacement = 'home' | 'homeTop' | 'rewardsShop';
export type AdMediaType = 'image' | 'gif' | 'video';

export interface AdDto {
  id: string;
  placement: AdPlacement;
  title: string;
  imageUrl: string | null;
  mediaType: AdMediaType;
  targetUrl: string | null;
}

const PLACEMENT_APP: Record<string, AdPlacement> = { home: 'home', home_top: 'homeTop', rewards_shop: 'rewardsShop' };

/** Active ads for a course, across all placements, ordered for display.
 * Includes both the course's own ads and global ads (course_id null) a
 * super_admin set to show across every club. */
export async function getActiveAdsForCourse(courseId: string): Promise<AdDto[]> {
  const rows = (await sql`
    select id, placement, title, image_url, media_type, target_url
    from ads
    where (course_id = ${courseId} or course_id is null)
      and active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    order by placement, sort_order, created_at
  `) as Array<{
    id: string;
    placement: string;
    title: string;
    image_url: string | null;
    media_type: AdMediaType;
    target_url: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    placement: PLACEMENT_APP[r.placement] ?? 'home',
    title: r.title,
    imageUrl: r.image_url,
    mediaType: r.media_type,
    targetUrl: r.target_url,
  }));
}

/** Logs a member tapping an ad, for admin ad-performance reporting. Requires
 * the ad to belong to the member's own course or be a global ad (course_id
 * null) — otherwise a member could inflate another club's click counts by
 * posting an arbitrary adId. */
export async function logAdClick(adId: string, userId: string, courseId: string): Promise<void> {
  await sql`
    insert into ad_clicks (ad_id, user_id)
    select id, ${userId} from ads where id = ${adId} and (course_id = ${courseId} or course_id is null)
  `;
}

/** Logs a member being shown an ad (once per time it renders on their
 * screen), for click-through-rate reporting. Same course/global scoping
 * guard as logAdClick. */
export async function logAdImpression(adId: string, userId: string, courseId: string): Promise<void> {
  await sql`
    insert into ad_impressions (ad_id, user_id)
    select id, ${userId} from ads where id = ${adId} and (course_id = ${courseId} or course_id is null)
  `;
}
