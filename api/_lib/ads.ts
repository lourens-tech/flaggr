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
 * Includes both ads specifically targeting this course (via ad_courses)
 * and global ads (is_global) a super_admin set to show across every club. */
export async function getActiveAdsForCourse(courseId: string): Promise<AdDto[]> {
  const rows = (await sql`
    select a.id, a.placement, a.title, a.image_url, a.media_type, a.target_url
    from ads a
    where (a.is_global or exists (select 1 from ad_courses ac where ac.ad_id = a.id and ac.course_id = ${courseId}))
      and a.active
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at is null or a.ends_at >= now())
    order by a.placement, a.sort_order, a.created_at
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
 * the ad to target the member's own course or be global — otherwise a
 * member could inflate another club's click counts by posting an arbitrary
 * adId. */
export async function logAdClick(adId: string, userId: string, courseId: string): Promise<void> {
  await sql`
    insert into ad_clicks (ad_id, user_id)
    select a.id, ${userId} from ads a
    where a.id = ${adId}
      and (a.is_global or exists (select 1 from ad_courses ac where ac.ad_id = a.id and ac.course_id = ${courseId}))
  `;
}

/** Logs a member being shown an ad (once per time it renders on their
 * screen), for click-through-rate reporting. Same course/global scoping
 * guard as logAdClick. */
export async function logAdImpression(adId: string, userId: string, courseId: string): Promise<void> {
  await sql`
    insert into ad_impressions (ad_id, user_id)
    select a.id, ${userId} from ads a
    where a.id = ${adId}
      and (a.is_global or exists (select 1 from ad_courses ac where ac.ad_id = a.id and ac.course_id = ${courseId}))
  `;
}
