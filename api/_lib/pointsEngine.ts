import { sql } from './db';
import { matchCatalog, type Catalog, type MatchResult } from './matching';
import type { ParsedLineItem } from './receiptParser';

interface GolfProductRow extends Catalog {
  rand_value: number;
  points_per_unit: boolean;
}

interface GolfActivityRow extends Catalog {
  rand_value: number;
}

interface MerchantRow extends Catalog {
  merchant_type: string;
  bonus_multiplier: string; // numeric comes back as string from the driver
  course_id: string | null;
}

export interface MatchedItem {
  description: string;
  quantity: number;
  price: number;
  matchedProductId: string | null;
  matchedActivityId: string | null;
  matchedName: string | null;
  pointsAwarded: number;
}

export interface PointsResult {
  items: MatchedItem[];
  merchant: { id: string; name: string; merchantType: string; courseId: string | null } | null;
  subtotalPoints: number; // before merchant bonus multiplier
  totalPointsAwarded: number; // after merchant bonus multiplier
}

// Products/activities are scoped to one club — every club manages its own
// catalog and Rand pricing (course_admin, or super_admin on their behalf).
// Merchants stay unscoped: a receipt could be from any Flagrr club, home or
// away, so the whole list is loaded to figure out which one this is.
async function loadCatalogs(homeCourseId: string) {
  const [products, activities, merchants] = await Promise.all([
    sql`select id, name, aliases, rand_value, points_per_unit from golf_products where active and course_id = ${homeCourseId}`,
    sql`select id, name, aliases, rand_value from golf_activities where active and course_id = ${homeCourseId}`,
    sql`select id, name, aliases, merchant_type, bonus_multiplier, course_id from merchants where active`,
  ]);
  return {
    products: products as GolfProductRow[],
    activities: activities as GolfActivityRow[],
    merchants: merchants as MerchantRow[],
  };
}

async function getFbPerRand(courseId: string): Promise<number> {
  const rows = (await sql`select fb_per_rand from courses where id = ${courseId}`) as Array<{
    fb_per_rand: string | number;
  }>;
  return rows.length > 0 ? Number(rows[0].fb_per_rand) : 1;
}

// The actual venue name on a slip is often not the first line — a logo,
// address, or an invoice-number line usually is — so this searches every
// OCR'd line against the known-clubs list and keeps whichever one scores
// best, rather than trusting a single positional guess.
function matchMerchantAcrossLines(lines: string[], merchants: MerchantRow[]): MatchResult<MerchantRow> | null {
  let best: MatchResult<MerchantRow> | null = null;
  for (const line of lines) {
    const match = matchCatalog(line, merchants);
    if (match && (!best || match.score > best.score)) best = match;
    if (best?.score === 1) break; // exact/alias match — can't do better
  }
  return best;
}

export async function matchAndScoreReceipt(
  items: ParsedLineItem[],
  rawLines: string[],
  homeCourseId: string,
): Promise<PointsResult> {
  const [{ products, activities, merchants }, fbPerRand] = await Promise.all([
    loadCatalogs(homeCourseId),
    getFbPerRand(homeCourseId),
  ]);

  const matchedItems: MatchedItem[] = items.map((item) => {
    const productMatch = matchCatalog(item.description, products);
    if (productMatch) {
      const unitPoints = Math.round(productMatch.item.rand_value * fbPerRand);
      const points = productMatch.item.points_per_unit ? unitPoints * item.quantity : unitPoints;
      return {
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        matchedProductId: productMatch.item.id,
        matchedActivityId: null,
        matchedName: productMatch.item.name,
        pointsAwarded: Math.round(points),
      };
    }

    const activityMatch = matchCatalog(item.description, activities);
    if (activityMatch) {
      const points = Math.round(activityMatch.item.rand_value * fbPerRand) * item.quantity;
      return {
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        matchedProductId: null,
        matchedActivityId: activityMatch.item.id,
        matchedName: activityMatch.item.name,
        pointsAwarded: Math.round(points),
      };
    }

    // Not in this club's catalog — fall back to the Rand amount actually
    // printed on this line, converted at the same rate as everything else.
    // item.price is already the full line total (it already reflects
    // quantity — "2 x Sunscreen  90.00" parses to price 90 for both), so it
    // isn't multiplied by quantity again here.
    return {
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      matchedProductId: null,
      matchedActivityId: null,
      matchedName: null,
      pointsAwarded: Math.round(item.price * fbPerRand),
    };
  });

  const subtotalPoints = matchedItems.reduce((sum, i) => sum + i.pointsAwarded, 0);

  const merchantMatch = matchMerchantAcrossLines(rawLines, merchants);
  const bonusMultiplier = merchantMatch ? Number(merchantMatch.item.bonus_multiplier) : 1;
  const totalPointsAwarded = Math.round(subtotalPoints * bonusMultiplier);

  return {
    items: matchedItems,
    merchant: merchantMatch
      ? {
          id: merchantMatch.item.id,
          name: merchantMatch.item.name,
          merchantType: merchantMatch.item.merchant_type,
          courseId: merchantMatch.item.course_id,
        }
      : null,
    subtotalPoints,
    totalPointsAwarded,
  };
}

export interface FinalizedPoints {
  finalPointsAwarded: number;
  awayClub: boolean;
  nonParticipatingClub: boolean;
}

// Members play away from their home club all the time. A receipt matched to
// another Flagrr-partnered club's merchant (course_id set, but not the
// member's own) doesn't use that club's product/activity catalog match or
// the member's tier multiplier — both are meant for their own club — and
// instead earns the flat standard rate of 1 Flagrr Cash per R1 spent.
// Anything else (home club, or an unaffiliated/generic retailer) keeps the
// existing catalog + tier-multiplier scoring.
//
// The same flat rate also applies, regardless of merchant, whenever the
// member's own home club isn't a currently-participating (paying) club —
// its own catalog/tier-multiplier scoring isn't honored for a club that
// isn't on the platform, but a member shouldn't lose access to what they've
// already earned just because their club fell behind on billing.
export function finalizePoints(
  scored: PointsResult,
  spend: { subtotal: number | null; grandTotal: number | null },
  homeCourseId: string,
  tierMultiplier: number,
  homeClubParticipating: boolean,
): FinalizedPoints {
  const awayClub = scored.merchant?.courseId != null && scored.merchant.courseId !== homeCourseId;
  if (!homeClubParticipating) {
    const amountSpent = spend.grandTotal ?? spend.subtotal ?? 0;
    return { finalPointsAwarded: Math.round(amountSpent), awayClub, nonParticipatingClub: true };
  }
  if (awayClub) {
    const amountSpent = spend.grandTotal ?? spend.subtotal ?? 0;
    return { finalPointsAwarded: Math.round(amountSpent), awayClub: true, nonParticipatingClub: false };
  }
  return {
    finalPointsAwarded: Math.round(scored.totalPointsAwarded * tierMultiplier),
    awayClub: false,
    nonParticipatingClub: false,
  };
}

/** A club counts as participating unless a super_admin has explicitly
 * cancelled its subscription — 'trialing'/'active'/'past_due'/null all still
 * count, since only 'canceled' is ever actually set today (see
 * superAdminCourseCancelSubscription in api/admin/index.ts). */
export async function isClubParticipating(courseId: string): Promise<boolean> {
  const rows = (await sql`select subscription_status from courses where id = ${courseId}`) as Array<{
    subscription_status: string | null;
  }>;
  return rows[0]?.subscription_status !== 'canceled';
}
