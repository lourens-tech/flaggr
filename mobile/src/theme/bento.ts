import { Platform, type TextStyle } from 'react-native';

// Bento design tokens for the member app redesign (design canvas:
// "Flagrr design canvas", Bento pages). Every Bento component reads its
// colours from here through useBento(); screens never hard-code colours.
//
// Values are the build brief's token table, copied exactly. Shadows and
// highlights are CSS box-shadow strings: React Native's New Architecture
// draws `boxShadow` (outer and inset) on iOS, Android and the web build.

export interface BentoTokens {
  ground: string;
  tile: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  shell: string;
  ring: string;
  hair: string;
  insetHighlight: string;
  shadow: string;
  glass: string;
  glassBorder: string;
  // Solid stand-in for glass when Reduce Transparency is on (and on
  // Android, whose BlurView needs a BlurTargetView behind every screen).
  glassSolid: string;
  seg: string;
  segOn: string;
  track: string;
  tabOff: string;
  dotOff: string;
  // Not in the token table but on every board: alert destructive text,
  // the dimmed backdrop behind sheets and alerts, and the faint contour
  // lines drawn at the top of each screen.
  danger: string;
  scrim: string;
  contour: string;
  // Fairway hero tiles: text on fairway green is always light.
  onHero: string;
  onHeroMuted: string;
  // Falling stat deltas ("−53% vs Last Month") and the amber notice banner
  // (membership not verified).
  negative: string;
  warnBg: string;
  warnInk: string;
  // Status pills (Bento prototype): a soft danger fill with darker text, and the warm "Under review" text.
  dangerSoft: string;
  dangerInk: string;
  pillWarnBg: string;
  pillWarnInk: string;
}

export const bentoBrand = {
  lime: '#CDDE5C',
  fairway: '#1F4234',
  flagGreen: '#00704F',
  // The Dynamic Island toast and the board's island cut-out.
  island: '#070807',
} as const;

export const bentoLight: BentoTokens = {
  ground: '#EEF0EA',
  tile: '#FFFFFF',
  ink: '#111412',
  muted: '#5F6661',
  accent: '#00704F',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(0,112,79,0.10)',
  shell: 'rgba(17,20,18,0.035)',
  ring: 'rgba(17,20,18,0.06)',
  hair: 'rgba(17,20,18,0.09)',
  insetHighlight: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  shadow: '0 18px 36px -22px rgba(31,66,52,0.30)',
  glass: 'rgba(255,255,255,0.62)',
  glassBorder: 'rgba(255,255,255,0.75)',
  glassSolid: '#F7F8F5',
  seg: 'rgba(17,20,18,0.06)',
  segOn: '#FFFFFF',
  track: 'rgba(17,20,18,0.08)',
  tabOff: '#5F6661',
  dotOff: 'rgba(17,20,18,0.12)',
  danger: '#C8322A',
  scrim: 'rgba(5,10,8,0.40)',
  contour: 'rgba(0,112,79,0.13)',
  onHero: '#FFFFFF',
  onHeroMuted: 'rgba(255,255,255,0.86)',
  negative: '#A4532F',
  warnBg: '#FBEFD6',
  warnInk: '#6B4600',
  dangerSoft: 'rgba(200,50,42,0.10)',
  dangerInk: '#A3261F',
  pillWarnBg: '#FBEFD6',
  pillWarnInk: '#8A5A00',
};

export const bentoDark: BentoTokens = {
  ground: '#0C110E',
  tile: '#151B17',
  ink: '#F1F3EE',
  muted: '#9BA49E',
  accent: '#CDDE5C',
  accentInk: '#1F4234',
  accentSoft: 'rgba(205,222,92,0.12)',
  shell: 'rgba(255,255,255,0.03)',
  ring: 'rgba(255,255,255,0.07)',
  hair: 'rgba(255,255,255,0.09)',
  insetHighlight: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  shadow: '0 18px 36px -22px rgba(0,0,0,0.7)',
  glass: 'rgba(24,31,27,0.66)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassSolid: '#1A211C',
  seg: 'rgba(255,255,255,0.07)',
  segOn: '#2A322D',
  track: 'rgba(255,255,255,0.10)',
  tabOff: '#9BA49E',
  dotOff: 'rgba(255,255,255,0.14)',
  danger: '#FF6B61',
  scrim: 'rgba(5,10,8,0.40)',
  contour: 'rgba(205,222,92,0.10)',
  onHero: '#FFFFFF',
  onHeroMuted: 'rgba(255,255,255,0.86)',
  negative: '#F0A07A',
  warnBg: 'rgba(232,176,72,0.14)',
  warnInk: '#F1D39B',
  dangerSoft: 'rgba(200,50,42,0.10)',
  dangerInk: '#F0918A',
  pillWarnBg: 'rgba(233,196,106,0.16)',
  pillWarnInk: '#E9C46A',
};

export const bentoLayout = {
  screenPadding: 24,
  tileGap: 12,
  // Double bezel: outer tray padding and radius; the inner card's radius is
  // the outer radius minus the tray padding so the two curves stay parallel.
  tileTrayPadding: 5,
  tileRadius: 28,
  tileInnerRadius: 23,
  tileContentPadding: 16,
  controlHeight: 52,
  fieldRadius: 16,
  multilineHeight: 132,
  iconButton: 42,
  tabBarHeight: 74,
  tabBarSide: 14,
  tabBarBottom: 22,
  tabBarRadius: 30,
  tabWidth: 62,
  scanSize: 50,
  scanRadius: 17,
  scanLift: 10,
  adHeight: 180,
  adRadius: 15,
  minTouch: 44,
} as const;

// Space a scrolling screen leaves under its content so the last tile clears
// the floating tab bar (bar + its gap from the bottom + a tile gap).
export const TAB_BAR_CLEARANCE = bentoLayout.tabBarHeight + bentoLayout.tabBarBottom + 40;

// ── Type ────────────────────────────────────────────────────────────────────
// Interface text uses the platform's system font (SF Pro on iOS, Roboto on
// Android, the system UI stack on the web build): no fontFamily set.
// Titles and every big number use Fraunces 700.

export const bentoFonts = {
  display: 'Fraunces_700Bold',
  displaySemi: 'Fraunces_600SemiBold',
  // undefined = the platform system font.
  ui: undefined as string | undefined,
} as const;

// Android's system font only picks up weights through fontFamily variants on
// older versions; fontWeight works on every version React Native 0.86
// supports, so weight is always set explicitly here.
const ui = (size: number, weight: TextStyle['fontWeight'], extra?: TextStyle): TextStyle => ({
  fontFamily: bentoFonts.ui,
  fontSize: size,
  fontWeight: weight,
  ...extra,
});

export const bentoType = {
  h1: {
    fontFamily: bentoFonts.display,
    fontSize: 34,
    lineHeight: Math.round(34 * 1.04),
    letterSpacing: -0.025 * 34,
  } as TextStyle,
  eyebrow: ui(12, '600', { letterSpacing: 0.14 * 12, textTransform: 'uppercase' }),
  navTitle: ui(17, '600', { textAlign: 'center' }),
  body: ui(15, '400', { lineHeight: Math.round(15 * 1.45) }),
  bodyLarge: ui(16, '400', { lineHeight: Math.round(16 * 1.45) }),
  label: ui(14, '600'),
  helper: ui(13, '400'),
  button: ui(16, '600', { letterSpacing: -0.16 }),
  tabOn: ui(11, '600'),
  tabOff: ui(11, '500'),
  // Section heads inside tiles ("My Stats").
  tileTitle: ui(17, '600'),
  // Big numbers: balances, stats, points.
  number: { fontFamily: bentoFonts.display, fontVariant: ['tabular-nums'] } as TextStyle,
} as const;

// The web build has no Dynamic Island; toasts there drop from the top edge.
export const hasIsland = Platform.OS === 'ios';
