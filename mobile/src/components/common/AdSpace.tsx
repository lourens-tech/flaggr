import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useApp } from '../../context/AppContext';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdPlacement } from '../../data/types';

interface Props {
  placement: AdPlacement;
  style?: StyleProp<ViewStyle>;
}

// Doubled from the original 90px placeholder height.
const AD_SPACE_HEIGHT = 180;

// How long an image/gif ad stays up before revolving to the next one in the
// slot. A gif has no "it just finished playing" signal the way video does
// (no end-of-loop event exists in React Native), so it gets the same fixed
// timer as a plain image rather than pretending to time its actual loop.
const IMAGE_DISPLAY_MS = 6000;

export function AdSpace({ placement, style }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ads, logAdClick, logAdImpression } = useApp();
  const isFocused = useIsFocused();

  // Every active ad for this slot — this course's own plus any global ones
  // — in the order the server already sorted them (placement, sort_order,
  // created_at). Multiple ads means this slot revolves between them.
  const slotAds = useMemo(() => ads.filter((a) => a.placement === placement), [ads, placement]);
  const slotKey = slotAds.map((a) => a.id).join(',');

  const [index, setIndex] = useState(0);
  // Snap back into range if the slot's ad list shrinks (an ad was
  // deactivated/deleted) out from under whatever index we were on.
  useEffect(() => {
    setIndex((i) => (i >= slotAds.length ? 0 : i));
  }, [slotKey, slotAds.length]);

  const ad = slotAds[index];
  const canRevolve = slotAds.length > 1;

  const advance = useCallback(() => {
    setIndex((i) => (slotAds.length === 0 ? 0 : (i + 1) % slotAds.length));
  }, [slotAds.length]);

  // One impression per time this ad actually renders on screen — mirrors
  // logAdClick's fire-and-forget shape, just triggered by being shown
  // instead of tapped. Re-fires whenever the ad in this slot changes,
  // including when it revolves to the next one. Paused while the screen
  // holding this ad isn't focused, so a backgrounded tab doesn't keep
  // silently racking up impressions.
  useEffect(() => {
    if (ad && isFocused) logAdImpression(ad.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id, isFocused]);

  // A video source, or '' when this ad isn't a video — useVideoPlayer must
  // run on every render (Rules of Hooks), so it can't sit behind the early
  // "no ad" return below. It recreates the underlying player whenever the
  // source string changes, so switching ads/placements just works. Loops
  // forever only when there's nothing else in the slot to revolve to —
  // otherwise it plays once and playToEnd below advances to the next ad.
  const videoSource = ad?.mediaType === 'video' && ad.imageUrl ? ad.imageUrl : '';
  const loopVideo = !canRevolve;
  const player = useVideoPlayer(videoSource, (p) => {
    if (!videoSource) return;
    p.loop = loopVideo;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (!videoSource || loopVideo || !isFocused) return;
    const subscription = player.addListener('playToEnd', advance);
    return () => subscription.remove();
  }, [videoSource, loopVideo, isFocused, player, advance]);

  // Image/gif ads revolve on a fixed timer — video ads revolve via
  // playToEnd above instead, since a mid-clip cut would look broken.
  useEffect(() => {
    if (!canRevolve || !isFocused || !ad || ad.mediaType === 'video') return;
    const timer = setTimeout(advance, IMAGE_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [canRevolve, isFocused, ad, advance]);

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

  const dots = canRevolve ? (
    <View style={styles.dotsRow} pointerEvents="none">
      {slotAds.map((a, i) => (
        <View key={a.id} style={[styles.dot, i === index && styles.dotActive]} />
      ))}
    </View>
  ) : null;

  if (!ad.targetUrl) {
    return (
      <View style={[styles.box, style]}>
        {content}
        {dots}
      </View>
    );
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
      {dots}
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  box: { height: AD_SPACE_HEIGHT, borderRadius: radius.md, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.lime },
  dotsRow: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: colors.white, width: 16 },
});
}
