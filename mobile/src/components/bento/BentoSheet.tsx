import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBento } from '../../context/ThemeContext';
import { bentoType } from '../../theme/bento';
import { bentoDuration, bentoEasing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { BentoIcon } from './BentoIcon';

const webBlur = { backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' } as unknown as ViewStyle;

// Bento bottom sheet (boards Dlg*, e.g. Redeem confirm, My bag, Scorecard):
// a rounded card inset 8 pt from the screen edges that rises from the bottom
// with a slight overshoot while the backdrop dims. Tapping the backdrop, the
// close button or the system back gesture calls onClose.
export function BentoSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  scroll = true,
  closeDisabled = false,
}: {
  visible: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  // While the sheet is busy (e.g. redeeming), the × is dimmed and does nothing (board G-C-RedeemBusy).
  // The caller still guards onClose for the backdrop and the system back gesture.
  closeDisabled?: boolean;
}) {
  const { t } = useBento();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const reduced = prefersReducedMotion();
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver }),
        Animated.timing(rise, { toValue: 1, duration: reduced ? 0 : bentoDuration.sheet, easing: bentoEasing.sheet, useNativeDriver }),
      ]).start();
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver }),
      Animated.timing(rise, { toValue: 0, duration: reduced ? 0 : 500, easing: bentoEasing.move, useNativeDriver }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const reduced = prefersReducedMotion();

  // Mounted only while showing, so stacking follows the order things open.
  if (!mounted && !visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim, opacity: fade }, Platform.OS === 'web' ? webBlur : null]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      {/* Docked between the side safe areas (the iPhone Duo's vertical strip is one). */}
      <View style={[styles.dock, { paddingLeft: 8 + insets.left, paddingRight: 8 + insets.right }]} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: '90%',
            borderRadius: 38,
            backgroundColor: t.tile,
            paddingTop: 10,
            paddingHorizontal: 22,
            paddingBottom: 22 + Math.max(0, insets.bottom - 12),
            boxShadow: '0 -20px 50px rgba(0,0,0,0.3)',
            opacity: reduced ? fade : 1,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
          }}
        >
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.track, alignSelf: 'center', marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={[bentoType.number, { fontSize: 24, letterSpacing: -0.24, color: t.ink }]}>
                {title}
              </Text>
              {subtitle ? (
                <View style={{ marginTop: 4 }}>
                  {typeof subtitle === 'string' ? <Text style={[bentoType.helper, { color: t.muted, lineHeight: 18 }]}>{subtitle}</Text> : subtitle}
                </View>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              disabled={closeDisabled}
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityState={{ disabled: closeDisabled }}
              aria-disabled={closeDisabled}
              hitSlop={5}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.seg, alignItems: 'center', justifyContent: 'center', opacity: closeDisabled ? 0.45 : 1 }}
            >
              <BentoIcon name="close" size={16} color={t.ink} strokeWidth={1.8} />
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView style={{ marginTop: 16, flexGrow: 0 }} contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={{ marginTop: 16, gap: 10 }}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dock: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 14, flexWrap: 'wrap' },
});
