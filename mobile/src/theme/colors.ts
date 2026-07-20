// Source of truth: Figma variable definitions on the Flaggr Loyalty App file
// (file 42wUQpyVRKYHJ3lWGMek19), plus colors observed in component fills that
// aren't registered as variables (charts, status pills, subtle backgrounds).
export const colors = {
  darkGreen: '#1F4234', // "Flagrr Dark Green" — primary surfaces, headers
  clubGreen: '#00805A', // "Flagrr Club Green" — accents, progress, borders
  lime: '#CDDE5C', // "Flagrr Lime" — primary CTA buttons
  light: '#E9E7FF', // progress track background
  white: '#FFFFFF',

  textPrimary: '#1F1F1F',
  textSecondary: '#4B5563',
  textMuted: '#5E5E5E',

  goldGradientStart: '#A86C0A',
  goldGradientEnd: '#FDD248',

  mintBg: '#CCF2E6',
  mintBgAlt: '#F0FFFB',
  imagePlaceholder: '#F7F8FC',

  positive: '#CDDE5C',
  negative: '#DE5C5C',

  overlayDarkGreen: 'rgba(31, 66, 52, 0.75)',
} as const;

export type ColorToken = keyof typeof colors;
