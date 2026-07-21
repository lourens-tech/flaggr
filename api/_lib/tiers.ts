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

// Tier is qualified per calendar quarter off Flagrr Bucks EARNED that
// quarter (redemptions don't count, so spending vouchers never demotes
// anyone) — not a lifetime or current-balance figure. To stop a single
// quiet quarter from wiping out a member's status, this quarter's tier can
// never land more than one step below last quarter's final tier.
export function computeQuarterlyTierInfo(currentQuarterEarned: number, previousQuarterEarned: number): TierInfo {
  const rawIndex = tierIndexForPoints(currentQuarterEarned);
  const previousIndex = tierIndexForPoints(previousQuarterEarned);
  const floorIndex = Math.max(0, previousIndex - 1);
  const tierIndex = Math.max(rawIndex, floorIndex);

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
