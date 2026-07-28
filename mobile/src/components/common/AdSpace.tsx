import React, { useMemo } from 'react';
import { Image, Linking, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useApp } from '../../context/AppContext';
import { fontFamily, fontSize, radius } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdPlacement } from '../../data/types';

interface Props {
  placement: AdPlacement;
  style?: StyleProp<ViewStyle>;
}

// Doubled from the original 90px placeholder height.
const AD_SPACE_HEIGHT = 180;

export function AdSpace({ placement, style }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ads, logAdClick } = useApp();
  const ad = ads.find((a) => a.placement === placement);

  // A video source, or '' when this ad isn't a video — useVideoPlayer must
  // run on every render (Rules of Hooks), so it can't sit behind the early
  // "no ad" return below. It recreates the underlying player whenever the
  // source string changes, so switching ads/placements just works.
  const videoSource = ad?.mediaType === 'video' && ad.imageUrl ? ad.imageUrl : '';
  const player = useVideoPlayer(videoSource, (p) => {
    if (!videoSource) return;
    p.loop = true;
    p.muted = true;
    p.play();
  });

  if (!ad) {
    return (
      <View style={[styles.box, styles.placeholder, style]}>
        <Text style={styles.placeholderText}>Ad Space</Text>
      </View>
    );
  }

  const content = !ad.imageUrl ? (
    <View style={[styles.box, styles.placeholder]}>
      <Text style={styles.placeholderText}>{ad.title || 'Ad Space'}</Text>
    </View>
  ) : ad.mediaType === 'video' ? (
    <VideoView player={player} style={styles.image} contentFit="cover" nativeControls={false} />
  ) : (
    <Image source={{ uri: ad.imageUrl }} style={styles.image} resizeMode="cover" />
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  box: { height: AD_SPACE_HEIGHT, borderRadius: radius.md, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.lime },
});
}
