import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBento } from '../../context/ThemeContext';
import { ContourBackdrop } from './BentoScreen';

// Background for the sign-in screens (Landing, Login, Sign up, Reset
// password boards): the ground colour with a club photo across the top that
// fades into it, or just the contour lines when there's no photo.
export function AuthBackdrop({ photo, height = 280 }: { photo?: ImageSourcePropType; height?: number }) {
  const { t } = useBento();
  if (!photo) return <ContourBackdrop />;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.ground }]}>
      <Image source={photo} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, height, width: '100%' }} />
      <LinearGradient
        colors={['rgba(10,24,17,0.35)', 'rgba(10,24,17,0)', 'rgba(10,24,17,0)', t.ground]}
        locations={[0, 0.3, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height + 4 }}
      />
    </View>
  );
}
