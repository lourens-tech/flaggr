// Source of truth: Figma variable definitions on the Flaggr Loyalty App file
// (file 42wUQpyVRKYHJ3lWGMek19), plus colors observed in component fills that
// aren't registered as variables (charts, status pills, subtle backgrounds).
//
// Dark mode keeps every brand/accent color constant (clubGreen, darkGreen,
// lime, white, positive, negative, gold gradient) — only the neutral
// "surface" tokens (page/card backgrounds, borders, body text, tinted
// backgrounds) flip. `white` in particular stays literal white in both
// themes: it's used for text/icons on a permanently-green header and for
// the QR code's scannable background, never as a page surface — page
// surfaces use `background`/`surface` instead.
const shared = {
  darkGreen: '#1F4234', // "Flagrr Dark Green" — primary surfaces, headers
  clubGreen: '#00805A', // "Flagrr Club Green" — accents, progress, borders
  lime: '#CDDE5C', // "Flagrr Lime" — primary CTA buttons
  white: '#FFFFFF',

  goldGradientStart: '#A86C0A',
  goldGradientEnd: '#FDD248',

  positive: '#CDDE5C',
  negative: '#DE5C5C',
  warning: '#8A5A00', // amber accent — foreground text/icon on a warning-style badge (Open/Pending status, High priority, flagged-for-review)
};

export const lightColors = {
  ...shared,
  light: '#E9E7FF', // progress track background

  background: '#FFFFFF', // page root surface
  surface: '#FFFFFF', // card/sheet surface
  inputBg: '#F5F6F8',
  inputBorder: '#E5E7EB',
  border: '#EEEEEE',

  textPrimary: '#1F1F1F',
  textSecondary: '#4B5563',
  textMuted: '#5E5E5E',

  mintBg: '#CCF2E6',
  mintBgAlt: '#F0FFFB',
  imagePlaceholder: '#F7F8FC',

  // Tinted badge backgrounds — pair with the constant `warning`/`negative`
  // accent text above. Unlike those accents, these flip with the theme
  // (same as mintBg) since a pastel-on-white chip reads as a stray light-mode
  // artifact once the surrounding page goes dark.
  warningBg: '#FDE9C8',
  dangerBg: 'rgba(222, 92, 92, 0.15)',

  overlayDarkGreen: 'rgba(31, 66, 52, 0.75)',
} as const;

export const darkColors = {
  ...shared,
  light: '#33473E',

  background: '#0F1712',
  surface: '#17211C',
  inputBg: '#1E2A24',
  inputBorder: '#324038',
  border: '#2A3630',

  textPrimary: '#F2F2F2',
  textSecondary: '#B7C1BB',
  textMuted: '#8B968F',

  mintBg: '#173C31',
  mintBgAlt: '#132920',
  imagePlaceholder: '#1E2A24',

  warningBg: '#4A3616',
  dangerBg: 'rgba(222, 92, 92, 0.25)',

  overlayDarkGreen: 'rgba(31, 66, 52, 0.85)',
} as const;

// Static default (light) — kept for any call site that hasn't migrated to
// useThemeColors() yet; every themed screen/component should prefer the hook.
export const colors = lightColors;

export type ColorToken = keyof typeof lightColors;
export type ThemeColors = Record<ColorToken, string>;
