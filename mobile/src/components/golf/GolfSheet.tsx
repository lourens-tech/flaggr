import React from 'react';
import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useBento } from '../../context/ThemeContext';
import { BentoSheet } from '../bento/BentoSheet';
import { BentoButton, BentoIcon, BentoTile } from '../bento';

// A bottom sheet over the whole screen, used for the scorecard, the bag and
// the round details during a round. One open at a time; tapping outside, the
// close button or the system back gesture closes it. Drawn as a Bento sheet
// (components/bento/BentoSheet); the props and behaviour are unchanged.
export function GolfSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <BentoSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose} footer={footer}>
      {children}
    </BentoSheet>
  );
}

// Shared by the golf screens only (kept boards G-D-*Loading): a spinner with
// "Loading…" under it, 40 pt above and below.
export function GolfLoading({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useBento();
  return (
    <View style={[{ alignItems: 'center', gap: 12, paddingVertical: 40 }, style]}>
      <ActivityIndicator size="large" color={t.accent} />
      <Text style={{ fontSize: 14, color: t.muted }}>Loading…</Text>
    </View>
  );
}

// The golf load-error tile (kept boards G-D-CourseError, G-D-MyGolfError): a
// warning chip, the message, and a "Try again" button that re-runs the load.
export function GolfLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useBento();
  return (
    <BentoTile padding={18}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.warnBg, alignItems: 'center', justifyContent: 'center' }}>
          <BentoIcon name="golfWarning" size={19} color={t.warnInk} strokeWidth={1.8} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: t.ink, paddingTop: 10 }}>{message}</Text>
      </View>
      <BentoButton label="Try again" variant="secondary" compact onPress={onRetry} style={{ marginTop: 14, minHeight: 44 }} />
    </BentoTile>
  );
}
