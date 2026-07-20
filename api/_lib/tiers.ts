// Mirrors mobile/src/data/mockData.ts's memberTiers thresholds. Duplicated
// here (rather than imported) since api/ and mobile/ are separate deploy
// units — keep the two in sync if tier thresholds ever change.
export const TIERS = [
  { name: 'Bronze', minPoints: 0 },
  { name: 'Silver', minPoints: 5000 },
  { name: 'Gold', minPoints: 10480 },
  { name: 'Platinum', minPoints: 20000 },
] as const;

export type TierName = (typeof TIERS)[number]['name'];

export interface TierInfo {
  tier: TierName;
  nextTier: TierName | null;
  tierProgress: number;
  pointsToNextTier: number;
}

export function computeTierInfo(balance: number): TierInfo {
  let currentIndex = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (balance >= TIERS[i].minPoints) currentIndex = i;
  }
  const current = TIERS[currentIndex];
  const next = TIERS[currentIndex + 1] ?? null;

  if (!next) {
    return { tier: current.name, nextTier: null, tierProgress: 1, pointsToNextTier: 0 };
  }

  const tierProgress = Math.min(
    1,
    Math.max(0, (balance - current.minPoints) / (next.minPoints - current.minPoints)),
  );
  return {
    tier: current.name,
    nextTier: next.name,
    tierProgress,
    pointsToNextTier: Math.max(0, next.minPoints - balance),
  };
}
