import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius } from '../../theme';
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
  return (
    <View style={[styles.track, { backgroundColor: resolvedTrackColor, height, borderRadius: radius.pill }]}>
      <View
        style={[
          styles.fill,
          { backgroundColor: resolvedFillColor, width: `${clamped * 100}%`, borderRadius: radius.pill },
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
