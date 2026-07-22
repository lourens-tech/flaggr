import type { MemberTier } from './types';

// Tier perks copy — thresholds and multipliers/rewards mirror
// api/_lib/tiers.ts on the backend, where they're actually enforced (earning
// multiplier on receipt scans, birthday bonus, Gold/Platinum bar voucher).
export const memberTiers: MemberTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    perks: ['Earn 1 Flagrr Cash per R1 spent', 'Birthday reward (50 Flagrr Cash)'],
  },
  {
    name: 'Silver',
    minPoints: 5000,
    perks: ['1.2x Flagrr Cash per R1 spent', 'Birthday reward (100 Flagrr Cash)'],
  },
  {
    name: 'Gold',
    minPoints: 10000,
    perks: ['1.5x Flagrr Cash per R1 spent', 'Birthday reward (150 Flagrr Cash)', 'R100 bar voucher each quarter you qualify'],
  },
  {
    name: 'Platinum',
    minPoints: 15000,
    perks: ['1.7x Flagrr Cash per R1 spent', 'Birthday reward (200 Flagrr Cash)', 'R200 bar voucher each quarter you qualify'],
  },
];
