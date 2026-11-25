import type { MemberTier } from './types';

// Tier perks copy — thresholds and multipliers/rewards mirror
// api/_lib/tiers.ts on the backend, where they're actually enforced (earning
// multiplier on receipt scans, birthday bonus, Gold/Platinum bar voucher).
export const memberTiers: MemberTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    perks: ['Flagrr Cash on your receipts', 'Birthday reward of 50 FC'],
  },
  {
    name: 'Silver',
    minPoints: 5000,
    perks: ['1.2x Flagrr Cash on your receipts', 'Birthday reward of 100 FC'],
  },
  {
    name: 'Gold',
    minPoints: 10000,
    perks: ['1.5x Flagrr Cash on your receipts', 'Birthday reward of 150 FC', 'A bar voucher each quarter you qualify'],
  },
  {
    name: 'Platinum',
    minPoints: 15000,
    perks: ['1.7x Flagrr Cash on your receipts', 'Birthday reward of 200 FC', 'A bar voucher each quarter you qualify'],
  },
];
