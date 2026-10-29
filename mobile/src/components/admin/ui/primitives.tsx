import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminTheme } from '../../../context/ThemeContext';
import { adminFont, adminRadius, tabularNums } from '../../../theme/admin';
import { useHover, hoverTransitionNoTransform } from '../../../hooks/useHover';
import { PressableScale } from '../../motion';
import { duration, prefersReducedMotion, useNativeDriver } from '../../../theme/motion';

type IconName = keyof typeof Ionicons.glyphMap;

// ── Tile ─────────────────────────────────────────────────────────────────────
// Opaque content surface. Numbers and lists always sit on one of these, never
// directly on glass or a photo.
export function Tile({ style, children, padded = true }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; padded?: boolean }) {
  const { c, scheme } = useAdminTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: adminRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.edge,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: scheme === 'dark' ? 0.3 : 0.08,
          shadowRadius: 30,
          elevation: 2,
        },
        padded && { padding: 18 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Text presets ─────────────────────────────────────────────────────────────
export function PageTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useAdminTheme();
  return (
    <Text accessibilityRole="header" style={[{ ...adminFont.title, fontSize: 34, letterSpacing: -0.6, color: c.ink }, style]}>
      {children}
    </Text>
  );
}

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useAdminTheme();
  return (
    <Text style={[{ ...adminFont.bodyBold, fontSize: 11.5, letterSpacing: 1.3, textTransform: 'uppercase', color: c.ink3 }, style]}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const { c } = useAdminTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ ...adminFont.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }, style]}>
      {children}
    </Text>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
export type AdminButtonVariant = 'accent' | 'glass' | 'plain' | 'danger' | 'dangerSolid';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: AdminButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function AdminButton({
  label,
  onPress,
  variant = 'glass',
  icon,
  iconRight,
  disabled,
  loading,
  size = 'md',
  fullWidth,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  const palette: Record<AdminButtonVariant, { bg: string; fg: string }> = {
    accent: { bg: c.accent, fg: c.onAccent },
    glass: { bg: c.fill, fg: c.ink },
    plain: { bg: 'transparent', fg: c.accentText },
    danger: { bg: c.negBg, fg: c.neg },
    dangerSolid: { bg: c.badge, fg: '#FFFFFF' },
  };
  const { bg, fg } = palette[variant];
  const h = size === 'lg' ? 50 : 40;
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[
        styles.btn,
        hoverTransitionNoTransform,
        { height: h, backgroundColor: bg, paddingHorizontal: variant === 'plain' ? 6 : size === 'lg' ? 22 : 16 },
        fullWidth && { alignSelf: 'stretch' },
        hovered && !inactive && variant !== 'plain' && { opacity: 0.9 },
        inactive && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 18 : 16} color={fg} /> : null}
          <Text style={{ ...adminFont.bodySemiBold, fontSize: size === 'lg' ? 16 : 14.5, color: fg }} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={16} color={fg} /> : null}
        </>
      )}
    </PressableScale>
  );
}

// Round icon-only button (toolbars, sheet close).
export function CircleButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 40,
  badge,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  badge?: number;
}) {
  const { c } = useAdminTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${accessibilityLabel}, ${badge} unread` : accessibilityLabel}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.fill }]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.45)} color={c.ink} />
      {badge ? <CountBadge count={badge} style={styles.circleBadge} /> : null}
    </PressableScale>
  );
}

export function CountBadge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useAdminTheme();
  return (
    <View style={[styles.countBadge, { backgroundColor: c.badge }, style]}>
      <Text style={{ ...adminFont.bodyBold, ...tabularNums, fontSize: 11.5, color: '#FFFFFF' }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

// ── Status pill ──────────────────────────────────────────────────────────────
export type StatusTone = 'pos' | 'amber' | 'neg' | 'neutral';

export function StatusPill({ label, tone = 'neutral', style }: { label: string; tone?: StatusTone; style?: StyleProp<ViewStyle> }) {
  const { c } = useAdminTheme();
  const map: Record<StatusTone, { bg: string; fg: string }> = {
    pos: { bg: c.posBg, fg: c.pos },
    amber: { bg: c.amberBg, fg: c.amber },
    neg: { bg: c.negBg, fg: c.neg },
    neutral: { bg: c.fill, fg: c.ink2 },
  };
  const { bg, fg } = map[tone];
  return (
    <View style={[styles.status, { backgroundColor: bg }, style]}>
      <Text style={{ ...adminFont.bodySemiBold, fontSize: 12, color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ── Segmented control ────────────────────────────────────────────────────────
export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  fullWidth,
  style,
}: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useAdminTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.seg, { backgroundColor: c.fill }, fullWidth && { alignSelf: 'stretch' }, style]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <PressableScale
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            pressedScale={0.98}
            style={[styles.segItem, fullWidth && { flex: 1 }, on && { backgroundColor: c.segOn }]}
          >
            <Text style={{ ...adminFont.bodySemiBold, fontSize: 13.5, color: on ? c.segOnFg : c.ink2 }} numberOfLines={1}>
              {o.label}
              {o.count !== undefined ? <Text style={{ ...adminFont.body, ...tabularNums, color: on ? c.segOnFg : c.ink3 }}>{`  ${o.count}`}</Text> : null}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

// ── Banner ───────────────────────────────────────────────────────────────────
export function Banner({
  tone,
  title,
  body,
  action,
  style,
}: {
  tone: 'neg' | 'amber' | 'pos';
  title: string;
  body?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useAdminTheme();
  const bg = tone === 'neg' ? c.negBg : tone === 'amber' ? c.amberBg : c.posBg;
  const fg = tone === 'neg' ? c.neg : tone === 'amber' ? c.amber : c.pos;
  const icon: IconName = tone === 'pos' ? 'checkmark-circle-outline' : 'warning-outline';
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: bg }, style]}>
      <Ionicons name={icon} size={22} color={fg} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...adminFont.bodyBold, fontSize: 14.5, color: c.ink }}>{title}</Text>
        {body ? <Muted style={{ marginTop: 2 }}>{body}</Muted> : null}
      </View>
      {action}
    </View>
  );
}

// ── Empty, error and loading states ──────────────────────────────────────────
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: React.ReactNode }) {
  const { c } = useAdminTheme();
  return (
    <View style={styles.state}>
      <Ionicons name={icon} size={32} color={c.icon} />
      <Text style={{ ...adminFont.bodyBold, fontSize: 16, color: c.ink, marginTop: 10, textAlign: 'center' }}>{title}</Text>
      {body ? <Muted style={{ marginTop: 4, textAlign: 'center', maxWidth: 360 }}>{body}</Muted> : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ title = "Couldn't load this", body, onRetry }: { title?: string; body?: string; onRetry?: () => void }) {
  return (
    <Banner
      tone="neg"
      title={title}
      body={body ?? 'Check your connection and try again.'}
      action={onRetry ? <AdminButton label="Try again" onPress={onRetry} /> : undefined}
    />
  );
}

function SkeletonBar({ width, height = 12 }: { width: ViewStyle['width']; height?: number }) {
  const { c } = useAdminTheme();
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: duration.long, useNativeDriver }),
        Animated.timing(pulse, { toValue: 0.55, duration: duration.long, useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={{ width, height, borderRadius: 99, backgroundColor: c.fill, opacity: pulse }} />;
}

// Placeholder rows while a list loads.
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 18, paddingVertical: 8 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ gap: 8 }}>
          <SkeletonBar width={`${55 + ((i * 17) % 30)}%`} />
          <SkeletonBar width="85%" height={10} />
        </View>
      ))}
    </View>
  );
}

// Visible keyboard focus ring for custom pressables on web.
export const webFocusRing = (color: string) =>
  (Platform.OS === 'web' ? { outlineColor: color, outlineOffset: 2 } : {}) as unknown as ViewStyle;

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: adminRadius.pill },
  circle: { alignItems: 'center', justifyContent: 'center' },
  circleBadge: { position: 'absolute', top: -3, right: -3 },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  status: { alignSelf: 'flex-start', borderRadius: adminRadius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  seg: { flexDirection: 'row', borderRadius: adminRadius.pill, padding: 3, alignSelf: 'flex-start' },
  segItem: { height: 34, borderRadius: adminRadius.pill, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: adminRadius.md, padding: 14 },
  state: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
});
