import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  AdMediaPermissionError,
  AdMediaTooLargeError,
  AdMediaTypeError,
  pickAdMedia,
  type PickedAdMedia,
} from '../../utils/pickAdMedia';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useOptionalAdminTheme, useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';
import type { AdMediaType } from '../../data/types';

interface Props {
  mediaType: AdMediaType;
  previewUrl: string | null;
  onPicked: (result: PickedAdMedia) => void;
}

const OPTIONS: Array<{ label: string; value: AdMediaType }> = [
  { label: 'Photo', value: 'image' },
  { label: 'GIF', value: 'gif' },
  { label: 'Video', value: 'video' },
];

export function AdMediaField({ mediaType, previewUrl, onPicked }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [uploading, setUploading] = useState(false);
  // In the admin consoles: a neutral well for the preview and a neutral
  // segmented control (selected = segOn). Outside them this is null and the
  // original look is kept.
  const admin = useOptionalAdminTheme();
  const a = admin?.c;

  const videoSource = mediaType === 'video' && previewUrl ? previewUrl : '';
  const player = useVideoPlayer(videoSource, (p) => {
    if (!videoSource) return;
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const handlePick = async (type: AdMediaType) => {
    setUploading(true);
    try {
      const result = await pickAdMedia(type);
      if (result) onPicked(result);
    } catch (err) {
      if (err instanceof AdMediaPermissionError) showAlert('Permission needed', err.message);
      else if (err instanceof AdMediaTypeError) showAlert('Wrong file type', err.message);
      else if (err instanceof AdMediaTooLargeError) showAlert('File too large', err.message);
      else showAlert('Couldn’t use that file', 'Something went wrong reading the selected media.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={a ? [styles.preview, styles.adminPreview, { backgroundColor: a.fill }] : styles.preview}
        onPress={() => handlePick(mediaType)}
        disabled={uploading}
        {...(a ? { accessibilityRole: 'button' as const, accessibilityLabel: previewUrl ? 'Replace creative' : 'Add creative' } : {})}
      >
        {uploading ? (
          <ActivityIndicator color={a ? a.ink2 : colors.clubGreen} />
        ) : previewUrl && mediaType === 'video' ? (
          <VideoView player={player} style={a ? [styles.previewMedia, styles.adminMedia] : styles.previewMedia} contentFit="cover" nativeControls={false} />
        ) : previewUrl ? (
          <Image source={{ uri: previewUrl }} style={a ? [styles.previewMedia, styles.adminMedia] : styles.previewMedia} />
        ) : (
          <View style={a ? [styles.placeholder, styles.adminMedia, { backgroundColor: a.fill }] : styles.placeholder}>
            <Ionicons name="image-outline" size={24} color={a ? a.icon : colors.clubGreen} />
            <Text style={a ? [styles.adminPlaceholderText, { color: a.ink2 }] : styles.placeholderText}>Add creative</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={a ? [styles.segmentedRow, { backgroundColor: a.fill, borderRadius: adminRadius.pill }] : styles.segmentedRow}>
        {OPTIONS.map((o) => {
          const on = mediaType === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              onPress={() => handlePick(o.value)}
              disabled={uploading}
              style={a ? [styles.adminSegment, on && { backgroundColor: a.segOn }] : [styles.segment, on && styles.segmentActive]}
              {...(a ? { accessibilityRole: 'button' as const, accessibilityState: { selected: on, disabled: uploading } } : {})}
            >
              <Text style={a ? [styles.adminSegmentText, { color: on ? a.segOnFg : a.ink2 }] : [styles.segmentText, on && styles.segmentTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { alignItems: 'center', gap: spacing.sm },
    preview: { width: 220, height: 124 },
    previewMedia: { width: '100%', height: '100%', borderRadius: radius.md },
    placeholder: {
      width: '100%',
      height: '100%',
      borderRadius: radius.md,
      backgroundColor: colors.imagePlaceholder,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    placeholderText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.clubGreen },
    segmentedRow: { flexDirection: 'row', backgroundColor: colors.mintBg, borderRadius: radius.pill, padding: 3 },
    segment: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.pill },
    segmentActive: { backgroundColor: colors.darkGreen },
    segmentText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.textPrimary },
    segmentTextActive: { color: colors.white },
    adminPreview: { borderRadius: adminRadius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    adminMedia: { borderRadius: adminRadius.md },
    adminPlaceholderText: { ...adminFont.bodyMedium, fontSize: 13 },
    adminSegment: { height: 34, paddingHorizontal: 16, borderRadius: adminRadius.pill, alignItems: 'center', justifyContent: 'center' },
    adminSegmentText: { ...adminFont.bodySemiBold, fontSize: 13.5 },
  });
}
