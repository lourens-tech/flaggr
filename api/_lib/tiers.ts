// Mirrors mobile/src/data/mockData.ts's memberTiers thresholds. Duplicated
// here (rather than imported) since api/ and mobile/ are separate deploy
// units — keep the two in sync if tier thresholds ever change.
export const TIERS = [
  { name: 'Bronze', minPoints: 0 },
  { name: 'Silver', minPoints: 5000 },
  { name: 'Gold', minPoints: 10000 },
  { name: 'Platinum', minPoints: 15000 },
] as const;

export type TierName = (typeof TIERS)[number]['name'];

// Real, enforced tier perks — not display copy. Applied in api/_lib/tierRewards.ts.
export const TIER_MULTIPLIERS: Record<TierName, number> = {
  Bronze: 1,
  Silver: 1.2,
  Gold: 1.5,
  Platinum: 1.7,
};

export const TIER_BIRTHDAY_REWARD: Record<TierName, number> = {
  Bronze: 50,
  Silver: 100,
  Gold: 150,
  Platinum: 200,
};

// Rand value of the once-per-quarter Bar Voucher gifted to Gold/Platinum
// members; tiers without an entry here don't get this perk.
export const TIER_BAR_VOUCHER_RAND: Partial<Record<TierName, number>> = {
  Gold: 100,
  Platinum: 200,
};

export interface TierInfo {
  tier: TierName;
  nextTier: TierName | null;
  tierProgress: number;
  pointsToNextTier: number;
}

function tierIndexForPoints(points: number): number {
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].minPoints) index = i;
  }
  return index;
}

// Tier is qualified per calendar quarter off Flagrr Cash EARNED that
// quarter (redemptions don't count, so spending vouchers never demotes
// anyone) — not a lifetime or current-balance figure. To stop a single
// quiet quarter from wiping out a member's status, this quarter's tier can
// never land more than one step below last quarter's final tier.
//
// `verifiedMember` gates tier climbing entirely: a member whose home club
// hasn't confirmed them against its uploaded roster (see
// api/_lib/memberRoster.ts) can still scan receipts and earn/redeem Flagrr
// Cash, but stays capped at Bronze — same multiplier, no perks — until
// their club verifies them.
export function computeQuarterlyTierInfo(
  currentQuarterEarned: number,
  previousQuarterEarned: number,
  verifiedMember: boolean = true,
): TierInfo {
  const rawIndex = tierIndexForPoints(currentQuarterEarned);
  const previousIndex = tierIndexForPoints(previousQuarterEarned);
  const floorIndex = Math.max(0, previousIndex - 1);
  const tierIndex = verifiedMember ? Math.max(rawIndex, floorIndex) : 0;

  const current = TIERS[tierIndex];
  const next = TIERS[tierIndex + 1] ?? null;

  if (!next) {
    return { tier: current.name, nextTier: null, tierProgress: 1, pointsToNextTier: 0 };
  }

  const tierProgress = Math.min(
    1,
    Math.max(0, (currentQuarterEarned - current.minPoints) / (next.minPoints - current.minPoints)),
  );
  return {
    tier: current.name,
    nextTier: next.name,
    tierProgress,
    pointsToNextTier: Math.max(0, next.minPoints - currentQuarterEarned),
  };
}
