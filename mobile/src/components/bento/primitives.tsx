import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { BlurView } from 'expo-blur';
import { useBento } from '../../context/ThemeContext';
import { haptic } from '../../utils/haptics';
import { bentoBrand, bentoLayout as L, bentoType } from '../../theme/bento';
import { bentoDuration, bentoEasing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { PressableScale } from '../motion/PressableScale';
import { BentoIcon, type BentoIconName } from './BentoIcon';

// ── Text ────────────────────────────────────────────────────────────────────
// Font scaling stays on everywhere (Dynamic Type); nothing here clips lines.

type TProps = TextProps & { style?: StyleProp<TextStyle>; color?: string };

export function H1({ style, color, ...rest }: TProps) {
  const { t } = useBento();
  return <Text accessibilityRole="header" {...rest} style={[bentoType.h1, { color: color ?? t.ink }, style]} />;
}

export function Eyebrow({ style, color, ...rest }: TProps) {
  const { t } = useBento();
  return <Text {...rest} style={[bentoType.eyebrow, { color: color ?? t.muted }, style]} />;
}

export function NavTitle({ style, color, ...rest }: TProps) {
  const { t } = useBento();
  return <Text accessibilityRole="header" {...rest} style={[bentoType.navTitle, { color: color ?? t.ink }, style]} />;
}

export function Body({ style, color, muted, ...rest }: TProps & { muted?: boolean }) {
  const { t } = useBento();
  return <Text {...rest} style={[bentoType.body, { color: color ?? (muted ? t.muted : t.ink) }, style]} />;
}

export function Label({ style, color, ...rest }: TProps) {
  const { t } = useBento();
  return <Text {...rest} style={[bentoType.label, { color: color ?? t.ink }, style]} />;
}

// ── Glass ───────────────────────────────────────────────────────────────────
// Frosted surface for chrome only (tab bar, floating buttons, title bar).
// Web: CSS backdrop blur + saturation, exactly as on the boards. iOS: system
// blur under the glass tint. Android and Reduce Transparency: a solid fill
// (Android's blur needs a BlurTargetView behind every screen and is costly
// on mid-range phones).

const webBackdrop = (blur: number, saturate: number) =>
  ({
    backdropFilter: `blur(${blur}px) saturate(${saturate})`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturate})`,
  }) as unknown as ViewStyle;

export function Glass({
  style,
  radius,
  blur = 20,
  saturate = 1.6,
  children,
  ...rest
}: ViewProps & { style?: StyleProp<ViewStyle>; radius: number; blur?: number; saturate?: number; children?: React.ReactNode }) {
  const { t, scheme, reduceTransparency } = useBento();
  const base: ViewStyle = { borderRadius: radius, borderWidth: 1, borderColor: t.glassBorder };

  if (reduceTransparency || Platform.OS === 'android') {
    return (
      <View {...rest} style={[base, { backgroundColor: t.glassSolid }, style]}>
        {children}
      </View>
    );
  }
  if (Platform.OS === 'web') {
    return (
      <View {...rest} style={[base, { backgroundColor: t.glass }, webBackdrop(blur, saturate), style]}>
        {children}
      </View>
    );
  }
  // Only the blur layer is clipped to the rounded shape: clipping the whole view on iOS
  // cut off anything meant to stand out of it (the raised Scan button) and the shadow.
  return (
    <View {...rest} style={[base, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: Math.max(0, radius - 1), overflow: 'hidden' }]}>
        <BlurView intensity={Math.min(100, blur * 3)} tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.glass }]} />
      </View>
      {children}
    </View>
  );
}

// ── Bento tile ("double bezel") ─────────────────────────────────────────────
// Outer tray (shell, 1 px ring, soft shadow) around an inner card (tile
// background, inset top highlight). `tone="hero"` is the fairway-green
// version used for the Flagrr Cash hero and photo tiles.

export function BentoTile({
  children,
  style,
  innerStyle,
  padding = L.tileContentPadding,
  tone = 'tile',
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  padding?: number;
  tone?: 'tile' | 'hero';
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { t } = useBento();
  const tray: ViewStyle = {
    padding: L.tileTrayPadding,
    borderRadius: L.tileRadius,
    backgroundColor: t.shell,
    boxShadow: `0 0 0 1px ${t.ring}, ${t.shadow}`,
  };
  const inner = (
    <View
      style={[
        {
          flexGrow: 1,
          borderRadius: L.tileInnerRadius,
          backgroundColor: tone === 'hero' ? bentoBrand.fairway : t.tile,
          boxShadow: t.insetHighlight,
          overflow: 'hidden',
          padding,
        },
        innerStyle,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} style={[tray, style]}>
        {inner}
      </PressableScale>
    );
  }
  return <View style={[tray, style]}>{inner}</View>;
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'lime';

export function BentoButton({
  label,
  onPress,
  variant = 'primary',
  nub = false,
  loading = false,
  disabled = false,
  compact = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  // primary: accent pill (Flag Green / Lime). secondary: tile pill with a
  // hairline. lime: lime on fairway, for buttons inside hero tiles.
  variant?: ButtonVariant;
  // The round arrow "nub" at the right end, as on the boards' main actions.
  nub?: boolean;
  loading?: boolean;
  disabled?: boolean;
  // 48 tall instead of 52 (inside tiles).
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { t, scheme } = useBento();
  const colors =
    variant === 'primary'
      ? { bg: t.accent, fg: t.accentInk, border: 'transparent', nubBg: scheme === 'dark' ? 'rgba(31,66,52,0.14)' : 'rgba(255,255,255,0.18)', nubFg: t.accentInk }
      : variant === 'lime'
        ? { bg: bentoBrand.lime, fg: bentoBrand.fairway, border: 'transparent', nubBg: bentoBrand.fairway, nubFg: bentoBrand.lime }
        : { bg: t.tile, fg: t.ink, border: t.hair, nubBg: t.seg, nubFg: t.ink };
  const height = compact ? 48 : L.controlHeight;
  const nubSize = compact ? 36 : 40;
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={
        onPress
          ? () => {
              // A light tap on main actions; secondary buttons stay quiet.
              if (variant !== 'secondary') haptic.light();
              onPress();
            }
          : undefined
      }
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      aria-busy={loading}
      style={[
        {
          minHeight: height,
          borderRadius: 999,
          backgroundColor: colors.bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: nub ? 'space-between' : 'center',
          paddingLeft: nub ? 20 : 20,
          paddingRight: nub ? (height - nubSize) / 2 : 20,
          paddingVertical: nub ? (height - nubSize) / 2 : 12,
          opacity: disabled && !loading ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.fg} style={{ flex: nub ? undefined : 0 }} />
      ) : (
        <Text style={[bentoType.button, { color: colors.fg, flexShrink: 1, textAlign: nub ? 'left' : 'center' }]}>{label}</Text>
      )}
      {nub ? (
        <View style={{ width: nubSize, height: nubSize, borderRadius: nubSize / 2, backgroundColor: colors.nubBg, alignItems: 'center', justifyContent: 'center' }}>
          <BentoIcon name="arrowUpRight" size={17} color={colors.nubFg} strokeWidth={2} />
        </View>
      ) : null}
    </PressableScale>
  );
}

// 42 pt glass circle with a line icon (back, notifications, close…). The
// hit area is padded out to 44 pt.
export function GlassIconButton({
  icon,
  onPress,
  accessibilityLabel,
  badge = false,
  style,
}: {
  icon: BentoIconName;
  onPress: () => void;
  accessibilityLabel: string;
  // Small lime dot, e.g. unread notifications.
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useBento();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={2} style={style}>
      <Glass radius={L.iconButton / 2} style={{ width: L.iconButton, height: L.iconButton, alignItems: 'center', justifyContent: 'center' }}>
        <BentoIcon name={icon} size={20} color={t.ink} strokeWidth={1.8} />
        {badge ? (
          <View style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: bentoBrand.lime, boxShadow: `0 0 0 2px ${bentoBrand.fairway}` }} />
        ) : null}
      </Glass>
    </PressableScale>
  );
}

// ── Segmented control ───────────────────────────────────────────────────────

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  fill = false,
  style,
  accessibilityLabel,
}: {
  options: Array<{ value: V; label: string }>;
  value: V;
  onChange: (v: V) => void;
  // Stretch segments to share the full width.
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { t } = useBento();
  const [frames, setFrames] = useState<Record<string, { x: number; w: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  const target = frames[value];
  useEffect(() => {
    if (!target) return;
    if (!placed.current || prefersReducedMotion()) {
      placed.current = true;
      x.setValue(target.x);
      w.setValue(target.w);
      return;
    }
    const cfg = { duration: bentoDuration.tab, easing: bentoEasing.overshoot, useNativeDriver: false };
    Animated.parallel([Animated.timing(x, { toValue: target.x, ...cfg }), Animated.timing(w, { toValue: target.w, ...cfg })]).start();
  }, [target?.x, target?.w, x, w, target]);

  const onSegLayout = (v: V) => (e: LayoutChangeEvent) => {
    const { x: fx, width } = e.nativeEvent.layout;
    setFrames((f) => (f[v]?.x === fx && f[v]?.w === width ? f : { ...f, [v]: { x: fx, w: width } }));
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: 999, backgroundColor: t.seg, alignSelf: fill ? 'stretch' : 'flex-start' }, style]}
    >
      {target ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: x,
            width: w,
            borderRadius: 999,
            backgroundColor: t.segOn,
            boxShadow: '0 1px 3px rgba(17,20,18,0.12)',
          }}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onLayout={onSegLayout(o.value)}
            onPress={() => {
              if (!on) haptic.selection();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            aria-checked={on}
            hitSlop={{ top: 6, bottom: 6 }}
            style={{ flex: fill ? 1 : undefined, minHeight: 32, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? t.ink : t.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Text field ──────────────────────────────────────────────────────────────

export const BentoField = React.forwardRef<
  TextInputInstance,
  TextInputProps & {
    label?: string;
    helper?: string;
    error?: string;
    rightIcon?: BentoIconName;
    onRightIconPress?: () => void;
    rightIconLabel?: string;
    containerStyle?: StyleProp<ViewStyle>;
  }
>(function BentoField({ label, helper, error, rightIcon, onRightIconPress, rightIconLabel, containerStyle, multiline, style, onFocus, onBlur, ...rest }, ref) {
  const { t } = useBento();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.danger : focused ? t.accent : t.hair;
  return (
    <View style={[{ gap: 8 }, containerStyle]}>
      {label ? <Text style={[bentoType.label, { color: t.ink }]}>{label}</Text> : null}
      <View>
        <TextInput
          ref={ref}
          multiline={multiline}
          placeholderTextColor={t.muted}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          accessibilityHint={error ?? helper}
          // As the legacy TextField did: invalid state on the input and a polite live region on the
          // error, so screen readers announce a validation message when it appears.
          aria-invalid={!!error}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              minHeight: multiline ? L.multilineHeight : L.controlHeight,
              borderRadius: L.fieldRadius,
              borderWidth: 1,
              borderColor,
              // Focus: an accent outline with a soft 3 pt ring (Bento kit).
              boxShadow: focused && !error ? `0 0 0 3px ${t.accentSoft}` : undefined,
              backgroundColor: t.tile,
              color: t.ink,
              fontSize: 16,
              paddingHorizontal: 16,
              paddingRight: rightIcon ? 48 : 16,
              paddingVertical: multiline ? 14 : 12,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null,
            style,
          ]}
          {...rest}
        />
        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            accessibilityRole={onRightIconPress ? 'button' : undefined}
            accessibilityLabel={rightIconLabel}
            style={{ position: 'absolute', right: 4, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <BentoIcon name={rightIcon} size={20} color={t.muted} strokeWidth={1.7} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[bentoType.helper, { color: t.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text style={[bentoType.helper, { color: t.muted }]}>{helper}</Text>
      ) : null}
    </View>
  );
});

// ── Toggle ──────────────────────────────────────────────────────────────────

export function BentoToggle({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { t } = useBento();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) {
      anim.setValue(value ? 1 : 0);
      return;
    }
    const a = Animated.timing(anim, { toValue: value ? 1 : 0, duration: 400, easing: bentoEasing.overshoot, useNativeDriver });
    a.start();
    return () => a.stop();
  }, [value, anim]);
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onValueChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      hitSlop={6}
      style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: value ? t.accent : t.seg, padding: 2, opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 6px rgba(17,20,18,0.18)',
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
        }}
      />
    </Pressable>
  );
}
