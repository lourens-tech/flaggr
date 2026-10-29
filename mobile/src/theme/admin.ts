import { Platform, type TextStyle } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from './colors';

// The admin consoles' own look ("Liquid Glass", see docs/Brand-Kit.md):
// glass only on navigation (sidebar, rail, toolbars, tab bar, sheets, menus),
// opaque content, one lime idea per screen, neutral selection. Member screens
// never see these values; AdminThemeScope (context/ThemeContext.tsx) swaps
// them in for the admin, staff, super-admin and support-agent stacks only.

export interface AdminColors {
  base: string; // window background under the ambient photo
  surface: string; // opaque content tiles, tables, lists
  surface2: string; // a tile inside a tile, hover on a surface
  glass: string; // translucent navigation fill (paired with a blur)
  glassSolid: string; // the same, when transparency is reduced
  sheet: string; // sheets and pop-up menus
  edge: string; // hairline borders
  hi: string; // top highlight on glass
  fill: string; // neutral control fill (search, segmented track, chips)
  fill2: string; // subtler fill (skeletons, empty-state wells)
  sel: string; // selected row / nav item
  ink: string; // primary text
  ink2: string; // secondary text
  ink3: string; // tertiary text, captions, group labels
  accent: string; // the one signal: primary buttons, focus, live data
  accentText: string; // accent as text or a thin icon on surface
  onAccent: string; // text/icons on an accent fill
  icon: string; // decorative icons inside chips
  pos: string;
  posBg: string;
  neg: string;
  negBg: string;
  amber: string;
  amberBg: string;
  badge: string; // count badges (always white text)
  focus: string;
  segOn: string; // selected segment / pill
  segOnFg: string;
  scrim: string; // behind sheets and dialogs
  bar: string; // neutral chart bars and progress tracks
  ambientOpacity: number; // how strongly the cover photo tints the window
}

export const adminDark: AdminColors = {
  base: '#0B1511',
  surface: '#152019',
  surface2: '#1B2820',
  glass: 'rgba(24,38,31,0.55)',
  glassSolid: '#1B2820',
  sheet: 'rgba(21,32,26,0.94)',
  edge: 'rgba(255,255,255,0.1)',
  hi: 'rgba(255,255,255,0.16)',
  fill: 'rgba(255,255,255,0.08)',
  fill2: 'rgba(255,255,255,0.045)',
  sel: 'rgba(255,255,255,0.14)',
  ink: '#F4F5F0',
  ink2: 'rgba(244,245,240,0.78)',
  ink3: 'rgba(244,245,240,0.68)',
  accent: '#CDDE5C',
  accentText: '#CDDE5C',
  onAccent: '#1F4234',
  icon: '#CDDE5C',
  pos: '#CDDE5C',
  posBg: 'rgba(205,222,92,0.15)',
  neg: '#FF8A80',
  negBg: 'rgba(255,138,128,0.15)',
  amber: '#FDD248',
  amberBg: 'rgba(253,210,72,0.15)',
  badge: '#C8322A',
  focus: '#CDDE5C',
  segOn: '#F4F5F0',
  segOnFg: '#0B1511',
  scrim: 'rgba(4,10,7,0.55)',
  bar: 'rgba(244,245,240,0.22)',
  ambientOpacity: 0.45,
};

// Light mode swaps lime for Flag Green: lime text on cream fails contrast.
export const adminLight: AdminColors = {
  base: '#ECEEE6',
  surface: '#FFFFFF',
  surface2: '#F7F6F1',
  glass: 'rgba(250,247,238,0.62)',
  glassSolid: '#F7F6F1',
  sheet: 'rgba(255,255,255,0.96)',
  edge: 'rgba(31,66,52,0.1)',
  hi: 'rgba(255,255,255,0.9)',
  fill: 'rgba(31,66,52,0.07)',
  fill2: 'rgba(31,66,52,0.04)',
  sel: 'rgba(31,66,52,0.1)',
  ink: '#1F1F1F',
  ink2: '#4B5563',
  ink3: '#555B66',
  accent: '#00805A',
  accentText: '#00704F',
  onAccent: '#FFFFFF',
  icon: '#00805A',
  pos: '#00704F',
  posBg: 'rgba(0,128,90,0.1)',
  neg: '#C23B3B',
  negBg: 'rgba(194,59,59,0.1)',
  amber: '#8A5A00',
  amberBg: 'rgba(178,120,0,0.13)',
  badge: '#C8322A',
  focus: '#00805A',
  segOn: '#1F4234',
  segOnFg: '#FFFFFF',
  scrim: 'rgba(31,40,35,0.3)',
  bar: 'rgba(31,66,52,0.22)',
  ambientOpacity: 0.32,
};

// The legacy ThemeColors tokens every admin screen already reads, re-pointed
// at the admin palette's neutrals. Brand constants (darkGreen, clubGreen,
// lime, white) keep their values so every existing green button and its
// white label still pair up; screens move to AdminColors as they're restyled.
function legacyFrom(base: ThemeColors, a: AdminColors): ThemeColors {
  return {
    ...base,
    background: a.base,
    surface: a.surface,
    inputBg: a.fill,
    inputBorder: a.edge,
    border: a.edge,
    textPrimary: a.ink,
    textSecondary: a.ink2,
    textMuted: a.ink3,
    mintBg: a.fill,
    mintBgAlt: a.surface2,
    imagePlaceholder: a.surface2,
    warningBg: a.amberBg,
    dangerBg: a.negBg,
    warning: a.amber,
    negative: a.neg,
  };
}

export const adminLegacyDark = legacyFrom(darkColors, adminDark);
export const adminLegacyLight = legacyFrom(lightColors, adminLight);

// Four radii: 12 for controls, 20 for tiles, 28 for panes and sheets, and
// the capsule.
export const adminRadius = { sm: 12, md: 20, lg: 28, pill: 999 } as const;

// System UI font for interface text and numbers (SF Pro on Apple, Segoe UI on
// Windows, Roboto on Android); Fraunces stays for large page titles only.
// The system font is selected by weight, so each preset carries both.
const SYSTEM_FONT = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  ios: 'System',
  default: undefined,
});

function sys(fontWeight: TextStyle['fontWeight']): TextStyle {
  return { fontFamily: SYSTEM_FONT, fontWeight };
}

// Drop-in replacements for the Poppins entries in theme/typography's
// fontFamily, spread into a style: `{ ...adminFont.bodySemiBold, fontSize: 13 }`.
export const adminFont = {
  body: sys('400'),
  bodyLight: sys('300'),
  bodyMedium: sys('500'),
  bodySemiBold: sys('600'),
  bodyBold: sys('700'),
  title: { fontFamily: 'Fraunces_800ExtraBold' } as TextStyle,
  // The brand's lime second line (Brand-Kit: Type). A real italic file, so
  // iOS doesn't render it upright and web doesn't fake the slant.
  titleItalic: { fontFamily: 'Fraunces_800ExtraBold_Italic' } as TextStyle,
  heading: { fontFamily: 'Fraunces_600SemiBold' } as TextStyle,
} as const;

// Tabular figures keep columns of numbers aligned and stop counters jiggling.
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };
