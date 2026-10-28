import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { duration, easing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';

// Short fade + lift for a screen's content when it first mounts. Native
// stack pushes already slide on iOS/Android; this is for the places that
// otherwise just snap: web routes and the desktop admin content area.
export function ScreenFade({ children, distance = 6 }: { children: React.ReactNode; distance?: number }) {
  const [skip] = useState(() => prefersReducedMotion());
  const progress = useRef(new Animated.Value(skip ? 1 : 0)).current;

  useEffect(() => {
    if (skip) return;
    const anim = Animated.timing(progress, { toValue: 1, duration: duration.short, easing: easing.out, useNativeDriver });
    anim.start();
    return () => anim.stop();
  }, [progress, skip]);

  // On web a transform on this wrapper would become the containing block for
  // any position:fixed/absolute overlay inside the screen, so web gets the
  // fade only.
  const lift = Platform.OS !== 'web' && distance !== 0;

  return (
    <Animated.View
      style={[
        styles.fill,
        { opacity: progress },
        lift ? { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] } : null,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
