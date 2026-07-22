import React from 'react';
import { Image, Linking, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useApp } from '../../context/AppContext';
import { colors, fontFamily, fontSize, radius } from '../../theme';
import type { AdPlacement } from '../../data/types';

interface Props {
  placement: AdPlacement;
  style?: StyleProp<ViewStyle>;
}

// Doubled from the original 90px placeholder height.
const AD_SPACE_HEIGHT = 180;

export function AdSpace({ placement, style }: Props) {
  const { ads, logAdClick } = useApp();
  const ad = ads.find((a) => a.placement === placement);

  if (!ad) {
    return (
      <View style={[styles.box, styles.placeholder, style]}>
        <Text style={styles.placeholderText}>Ad Space</Text>
      </View>
    );
  }

  const content = ad.imageUrl ? (
    <Image source={{ uri: ad.imageUrl }} style={styles.image} resizeMode="cover" />
  ) : (
    <View style={[styles.box, styles.placeholder]}>
      <Text style={styles.placeholderText}>{ad.title || 'Ad Space'}</Text>
    </View>
  );

  if (!ad.targetUrl) {
    return <View style={[styles.box, style]}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={[styles.box, style]}
      activeOpacity={0.85}
      onPress={() => {
        logAdClick(ad.id);
        Linking.openURL(ad.targetUrl!);
      }}
      accessibilityRole="link"
      accessibilityLabel={ad.title || 'Advertisement'}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: { height: AD_SPACE_HEIGHT, borderRadius: radius.md, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.lime },
});
