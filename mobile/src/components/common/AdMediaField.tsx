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
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
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
      <TouchableOpacity style={styles.preview} onPress={() => handlePick(mediaType)} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color={colors.clubGreen} />
        ) : previewUrl && mediaType === 'video' ? (
          <VideoView player={player} style={styles.previewMedia} contentFit="cover" nativeControls={false} />
        ) : previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.previewMedia} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={24} color={colors.clubGreen} />
            <Text style={styles.placeholderText}>Add creative</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.segmentedRow}>
        {OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.value}
            onPress={() => handlePick(o.value)}
            disabled={uploading}
            style={[styles.segment, mediaType === o.value && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, mediaType === o.value && styles.segmentTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
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
  });
}
