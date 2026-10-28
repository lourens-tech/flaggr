import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radius } from '../../theme';
import { duration, easing, prefersReducedMotion } from '../../theme/motion';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

interface Props {
  progress: number; // 0-1
  trackColor?: string;
  fillColor?: string;
  height?: number;
}

export function ProgressBar({ progress, trackColor, fillColor, height = 9 }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resolvedTrackColor = trackColor ?? colors.light;
  const resolvedFillColor = fillColor ?? colors.clubGreen;
  const clamped = Math.max(0, Math.min(1, progress));
  // Fills from the left on first show and glides to the new value when it
  // changes. Width is a layout prop, so this runs on the JS driver.
  const fill = useRef(new Animated.Value(prefersReducedMotion() ? clamped : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      fill.setValue(clamped);
      return;
    }
    const anim = Animated.timing(fill, {
      toValue: clamped,
      duration: duration.count,
      delay: 150,
      easing: easing.out,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [clamped, fill]);

  return (
    <View style={[styles.track, { backgroundColor: resolvedTrackColor, height, borderRadius: radius.pill }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: resolvedFillColor,
            width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            borderRadius: radius.pill,
          },
        ]}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
}
