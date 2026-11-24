import React, { useMemo } from 'react';
import { Platform, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useBento, type ThemeColors } from '../../context/ThemeContext';
import { lightColors, darkColors } from '../../theme';
import { bentoBrand, bentoLayout, type BentoTokens } from '../../theme/bento';
import { BentoButton } from './primitives';

// Bridges for screens restyled in place (the golf screens): their style
// sheets keep their structure and are fed Bento colours, Bento type and the
// Bento tile, so layout and behaviour stay exactly as they were.

// The old ThemeColors names, filled from the Bento tokens.
export function bentoAsThemeColors(t: BentoTokens, scheme: 'light' | 'dark'): ThemeColors {
  const base = scheme === 'dark' ? darkColors : lightColors;
  return {
    ...base,
    darkGreen: bentoBrand.fairway,
    clubGreen: t.accent,
    lime: bentoBrand.lime,
    white: '#FFFFFF',
    positive: t.accent,
    negative: t.danger,
    warning: t.warnInk,
    light: t.track,
    background: t.ground,
    surface: t.tile,
    inputBg: t.seg,
    inputBorder: t.hair,
    border: t.hair,
    textPrimary: t.ink,
    textSecondary: t.muted,
    textMuted: t.muted,
    mintBg: t.accentSoft,
    mintBgAlt: t.accentSoft,
    imagePlaceholder: t.seg,
    warningBg: t.warnBg,
  };
}

export function useBentoLegacy() {
  const { t, scheme } = useBento();
  const colors = useMemo(() => bentoAsThemeColors(t, scheme), [t, scheme]);
  return { t, scheme, colors };
}

// Named explicitly (not left unset) so text nested inside a Fraunces line
// doesn't inherit Fraunces.
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });

// Poppins → the system font at the same weight; display faces → Fraunces 700.
const FONT_MAP: Record<string, { fontFamily?: string; fontWeight?: TextStyle['fontWeight'] }> = {
  Poppins_300Light: { fontFamily: SYSTEM_FONT, fontWeight: '300' },
  Poppins_400Regular: { fontFamily: SYSTEM_FONT, fontWeight: '400' },
  Poppins_500Medium: { fontFamily: SYSTEM_FONT, fontWeight: '500' },
  Poppins_600SemiBold: { fontFamily: SYSTEM_FONT, fontWeight: '600' },
  'WsParadose-Regular': { fontFamily: 'Fraunces_700Bold' },
  Fraunces_800ExtraBold: { fontFamily: 'Fraunces_700Bold' },
};

// Maps the old Poppins / display fonts to the system font (and Fraunces).
// `minFontSize` (opt-in) lifts tiny legacy text, e.g. 9–10 pt timestamps,
// to a readable size; screens with dense map or chart labels leave it off.
export function systemFonts<T extends Record<string, unknown>>(styles: T, opts: { minFontSize?: number } = {}): T {
  const min = opts.minFontSize ?? 0;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(styles)) {
    const s = v as TextStyle;
    const mapped = s && typeof s.fontFamily === 'string' ? FONT_MAP[s.fontFamily] : undefined;
    const tooSmall = !!s && typeof s.fontSize === 'number' && s.fontSize < min;
    if (!mapped && !tooSmall) {
      out[k] = v;
      continue;
    }
    const next: { -readonly [K in keyof TextStyle]: TextStyle[K] } = { ...s };
    if (mapped) {
      next.fontFamily = mapped.fontFamily;
      if (mapped.fontWeight && s.fontWeight === undefined) next.fontWeight = mapped.fontWeight;
    }
    if (tooSmall) {
      next.fontSize = min;
      if (typeof s.lineHeight === 'number' && s.lineHeight < Math.round(min * 1.3)) next.lineHeight = Math.round(min * 1.3);
    }
    out[k] = next;
  }
  return out as T;
}

// The Bento "double bezel" drawn on a single view: the inner card, with the
// shell tray and its 1 px ring as spread shadows around it. The 5 pt margin
// keeps the tray inside the 24 pt screen gutter.
export function bentoTileStyle(t: BentoTokens, padding: number = bentoLayout.tileContentPadding): ViewStyle {
  return {
    backgroundColor: t.tile,
    borderRadius: bentoLayout.tileInnerRadius,
    padding,
    marginHorizontal: bentoLayout.tileTrayPadding,
    marginVertical: bentoLayout.tileTrayPadding,
    boxShadow: `${t.insetHighlight}, 0 0 0 5px ${t.shell}, 0 0 0 6px ${t.ring}, ${t.shadow}`,
  };
}

// Same, in fairway green for hero tiles.
export function bentoHeroStyle(t: BentoTokens, padding: number = bentoLayout.tileContentPadding): ViewStyle {
  return { ...bentoTileStyle(t, padding), backgroundColor: bentoBrand.fairway };
}

// Drop-in for the old PillButton on restyled screens.
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  fullWidth = true,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'dark' | 'outline' | 'outlineLight';
  icon?: unknown;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BentoButton
      label={label}
      onPress={onPress}
      variant={variant === 'outline' || variant === 'outlineLight' ? 'secondary' : 'primary'}
      disabled={disabled}
      loading={loading}
      style={[fullWidth ? null : { alignSelf: 'flex-start', minWidth: 120 }, style]}
    />
  );
}

export type { ThemeColors };
