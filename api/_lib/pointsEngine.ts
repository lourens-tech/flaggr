import { sql } from './db';
import { matchCatalog, type Catalog } from './matching';
import type { ParsedLineItem } from './receiptParser';

interface GolfProductRow extends Catalog {
  points_value: number;
  points_per_unit: boolean;
}

interface GolfActivityRow extends Catalog {
  points_value: number;
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

async function loadCatalogs() {
  const [products, activities, merchants] = await Promise.all([
    sql`select id, name, aliases, points_value, points_per_unit from golf_products where active`,
    sql`select id, name, aliases, points_value from golf_activities where active`,
    sql`select id, name, aliases, merchant_type, bonus_multiplier, course_id from merchants where active`,
  ]);
  return {
    products: products as GolfProductRow[],
    activities: activities as GolfActivityRow[],
    merchants: merchants as MerchantRow[],
  };
}

export async function matchAndScoreReceipt(
  items: ParsedLineItem[],
  merchantNameGuess: string | null,
): Promise<PointsResult> {
  const { products, activities, merchants } = await loadCatalogs();

  const matchedItems: MatchedItem[] = items.map((item) => {
    const productMatch = matchCatalog(item.description, products);
    if (productMatch) {
      const points = productMatch.item.points_per_unit
        ? productMatch.item.points_value * item.quantity
        : productMatch.item.points_value;
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
      return {
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        matchedProductId: null,
        matchedActivityId: activityMatch.item.id,
        matchedName: activityMatch.item.name,
        pointsAwarded: Math.round(activityMatch.item.points_value * item.quantity),
      };
    }

    return {
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      matchedProductId: null,
      matchedActivityId: null,
      matchedName: null,
      pointsAwarded: 0,
    };
  });

  const subtotalPoints = matchedItems.reduce((sum, i) => sum + i.pointsAwarded, 0);

  const merchantMatch = merchantNameGuess ? matchCatalog(merchantNameGuess, merchants) : null;
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
