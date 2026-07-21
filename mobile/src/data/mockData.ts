import type { MemberTier } from './types';

// Static tier perks copy — thresholds mirror api/_lib/tiers.ts on the backend.
export const memberTiers: MemberTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    perks: ['Earn 1 Flagrr Buck per $1 spent', 'Birthday reward', 'Member pricing on pro-shop items'],
  },
  {
    name: 'Silver',
    minPoints: 5000,
    perks: ['1.1x Flagrr Bucks on every round', 'Early access to tee times', 'Member-only clinics'],
  },
  {
    name: 'Gold',
    minPoints: 10000,
    perks: [
      'Enhanced Earning — Earn 25% more Flagrr Bucks on qualifying rounds, promotions, and in-app activities.',
      'Premium Rewards Access — Get early access to limited rewards and seasonal promotions before they become available to other players.',
      'Guest Reward Voucher — Receive special guest vouchers that can be redeemed for selected club benefits or shared with friends.',
    ],
  },
  {
    name: 'Platinum',
    minPoints: 15000,
    perks: ['1.5x Flagrr Bucks on every round', 'Complimentary cart hire', 'Unlimited guest rounds', 'Dedicated concierge line'],
  },
];
