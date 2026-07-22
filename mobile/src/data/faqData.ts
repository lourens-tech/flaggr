export interface FaqEntry {
  question: string;
  answer: string;
}

export const faqs: FaqEntry[] = [
  {
    question: 'How Do I Earn Flagrr Cash?',
    answer:
      'You can earn Flagrr Cash by playing qualifying rounds, scanning eligible receipts, participating in promotions, and completing selected in-app activities.',
  },
  {
    question: 'How do I redeem rewards?',
    answer: 'Open the Rewards Shop, choose a reward you can afford, and tap Redeem Now to receive a QR voucher.',
  },
  {
    question: 'How do membership tiers work?',
    answer:
      'Your tier is based on Flagrr Cash earned during the current quarter (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), not a lifetime total — it recalculates each quarter. A quiet quarter can only drop you one tier below where you finished the previous one, so you won’t fall all the way back to Bronze in one go.',
  },
  {
    question: 'What do the tiers actually get me?',
    answer:
      'Your tier sets how much Flagrr Cash you earn per R1 spent: Bronze 1x, Silver 1.2x, Gold 1.5x, Platinum 1.7x. Every member also gets an automatic birthday bonus (50/100/150/200 Flagrr Cash by tier), and Gold and Platinum members get a free bar voucher (R100/R200) each quarter they qualify — no need to redeem it, it appears in your Rewards Activity automatically.',
  },
  {
    question: 'What’s the benefit of keeping a streak going?',
    answer:
      'Every 4 weeks of an unbroken weekly streak earns you a Flagrr Cash bonus — 100 for 4 weeks, 200 for 8 weeks, and 300 for 12 weeks and every 4 weeks after that. It’s paid automatically and shows up in your Rewards Activity — no need to redeem it. If a streak breaks, a new one can earn those same milestones again from scratch.',
  },
  {
    question: 'Where can I use my reward voucher?',
    answer: 'Present the QR code or voucher code shown after redemption at your home club to claim your reward.',
  },
  {
    question: 'Why was my receipt not approved?',
    answer:
      'Receipts can be declined if the image is unclear, the purchase isn’t eligible, or it was already submitted.',
  },
  {
    question: 'Can I change my selected club?',
    answer: 'Yes — open My Profile and tap Club to switch your home club at any time.',
  },
];

export const articles = [
  { title: 'How Do I Earn Flagrr Cash?', summary: 'Learn how to earn Flagrr Cash through qualifying...' },
  { title: 'How Do I Redeem Rewards?', summary: 'Learn how to redeem your Flagrr Cash for rewards...' },
  { title: 'Getting Started With Flagrr', summary: 'Everything you need to know as a new member...' },
];
