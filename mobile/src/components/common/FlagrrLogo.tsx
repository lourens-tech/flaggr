import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '../../theme';

interface Props {
  color?: string;
  size?: number;
  showTagline?: boolean;
}

// Stand-in recreation of the "Flagrr" wordmark using a script font, since the
// original logo asset couldn't be pulled out of Figma in this environment
// (see conversation). Swap for an <Image> once the real logo file is available.
export function FlagrrLogo({ color = colors.white, size = 44, showTagline = true }: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.wordmark, { color, fontSize: size }]}>Flagrr</Text>
      {showTagline ? (
        <Text style={[styles.tagline, { color, fontSize: size * 0.24 }]}>LOYALTY</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { fontFamily: fontFamily.logo },
  tagline: { fontFamily: fontFamily.bodyMedium, letterSpacing: 4, marginTop: -6 },
});
