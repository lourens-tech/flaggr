import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme';

interface Props {
  progress: number; // 0-1
  trackColor?: string;
  fillColor?: string;
  height?: number;
}

export function ProgressBar({
  progress,
  trackColor = colors.light,
  fillColor = colors.clubGreen,
  height = 9,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: radius.pill }]}>
      <View
        style={[
          styles.fill,
          { backgroundColor: fillColor, width: `${clamped * 100}%`, borderRadius: radius.pill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
