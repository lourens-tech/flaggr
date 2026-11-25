import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bentoBrand } from '../../theme/bento';
import { bentoDuration, bentoEasing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { BentoIcon } from './BentoIcon';

// Bento toast: grows out of the Dynamic Island area for about 3 s, then
// shrinks back into it. On phones without an island (and the web build) it
// grows from the same spot under the top edge.
//
// Call showToast() from anywhere, like showAlert(). ToastHost is mounted
// once at the app root.

interface ToastState {
  id: number;
  title: string;
  subtitle?: string;
}

let current: ToastState | null = null;
let nextId = 1;
let listeners: Array<(s: ToastState | null) => void> = [];

export function showToast(title: string, subtitle?: string) {
  current = { id: nextId++, title, subtitle };
  listeners.forEach((l) => l(current));
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [toast, setToast] = useState<ToastState | null>(null);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const l = (s: ToastState | null) => setToast(s);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const reduced = prefersReducedMotion();
    grow.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(grow, { toValue: 1, duration: reduced ? 200 : 600, easing: reduced ? undefined : bentoEasing.overshoot, useNativeDriver }),
      Animated.delay(bentoDuration.toast),
      Animated.timing(grow, { toValue: 0, duration: reduced ? 200 : 450, easing: bentoEasing.move, useNativeDriver }),
    ]);
    seq.start(({ finished }) => {
      if (finished) setToast((t) => (t?.id === toast.id ? null : t));
    });
    return () => seq.stop();
  }, [toast, grow]);

  if (!toast) return null;

  // Sized and centred within the side safe areas (the iPhone Duo's vertical strip is one).
  const w = Math.min(340, width - insets.left - insets.right - 32);
  // The island sits ~11 pt from the top on iPhones that have one.
  const top = Platform.OS === 'ios' && insets.top >= 54 ? 11 : insets.top + 8;
  const reduced = prefersReducedMotion();

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left: insets.left, right: insets.right, alignItems: 'center', zIndex: 1000 }}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{
          width: w,
          minHeight: 54,
          borderRadius: 27,
          backgroundColor: bentoBrand.island,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 8,
          opacity: reduced ? grow : grow.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
          transform: reduced
            ? []
            : [
                { scaleX: grow.interpolate({ inputRange: [0, 1], outputRange: [124 / w, 1] }) },
                { scaleY: grow.interpolate({ inputRange: [0, 1], outputRange: [36 / 54, 1] }) },
              ],
        }}
      >
        {/* Lime circle with a fairway check, as the motion prototype's toast (17 pt, stroke 2.6) and the kit's .toast .ti draw it. */}
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bentoBrand.lime, alignItems: 'center', justifyContent: 'center' }}>
          <BentoIcon name="check" size={17} color={bentoBrand.fairway} strokeWidth={2.6} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>{toast.title}</Text>
          {toast.subtitle ? <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{toast.subtitle}</Text> : null}
        </View>
      </Animated.View>
    </View>
  );
}
