import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../api/adminClient';
import { PillButton } from '../common/PillButton';
import { showAlert } from '../../utils/alert';
import { pickScorecardPhotos } from '../../utils/pickScorecardPhotos';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, radius, spacing } from '../../theme';
import type { CourseMapStage, CourseMapStatus } from '../../golf/adminDto';

const STAGE_COPY: Record<CourseMapStage, { chip: string; body: string }> = {
  not_started: {
    chip: 'Send your scorecard',
    body: 'Upload clear photos of both sides of your club’s scorecard: par, stroke index, hole lengths and the Course Rating and Slope for every tee. We use them to build the hole maps and scorecard your members get in the Course and My Golf tabs.',
  },
  photos_received: {
    chip: 'Photos received',
    body: 'Thanks. We’re building your course map from these photos. Your members see “coming soon” until it’s ready. Add more photos if anything on the card is hard to read.',
  },
  building: {
    chip: 'Being built',
    body: 'Your course map is being built and checked against your card. Your members see “coming soon” until it goes live.',
  },
  live: {
    chip: 'Live',
    body: 'Your course map is live. Members can keep their scorecard on it and see their stats in My Golf. If your card changes (new tees, new ratings), upload the new card here.',
  },
};

// Dashboard panel where a club's GM uploads scorecard photos so Flagrr can
// build the club's course map, and sees how far it's got.
export function ScorecardUploadPanel() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<CourseMapStatus | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .courseMapStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your course map status.'));
  }, []);

  // Photo data is fetched one by one rather than in the list, since each can be ~1 MB.
  useEffect(() => {
    if (!status) return;
    for (const p of status.photos) {
      if (thumbs[p.id]) continue;
      adminApi
        .scorecardPhoto(p.id)
        .then((r) => setThumbs((cur) => ({ ...cur, [p.id]: r.imageData })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const upload = async () => {
    if (!status) return;
    const room = status.maxPhotos - status.photos.length;
    if (room <= 0) {
      showAlert('Photo limit reached', `You can upload up to ${status.maxPhotos} photos. Delete one to add another.`);
      return;
    }
    let photos: string[];
    try {
      photos = await pickScorecardPhotos(room);
    } catch (e) {
      showAlert('Could not open your photos', e instanceof Error ? e.message : undefined);
      return;
    }
    if (!photos.length) return;
    setUploading({ done: 0, total: photos.length });
    try {
      let latest = status;
      for (let i = 0; i < photos.length; i++) {
        latest = await adminApi.scorecardPhotoUpload(photos[i]);
        setUploading({ done: i + 1, total: photos.length });
      }
      setStatus(latest);
    } catch (e) {
      showAlert('Upload failed', e instanceof Error ? e.message : undefined);
      adminApi.courseMapStatus().then(setStatus).catch(() => {});
    } finally {
      setUploading(null);
    }
  };

  const remove = (id: string) =>
    showAlert('Delete this photo?', undefined, [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setStatus(await adminApi.scorecardPhotoDelete(id));
            setViewing(null);
          } catch (e) {
            showAlert('Could not delete the photo', e instanceof Error ? e.message : undefined);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const copy = status ? STAGE_COPY[status.stage] : null;
  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <View style={styles.iconChip}>
          <Ionicons name="map-outline" size={18} color={colors.clubGreen} />
        </View>
        <Text style={styles.title}>Course map</Text>
        {copy ? (
          <View style={[styles.chip, status?.stage === 'live' && styles.chipLive]}>
            <Text style={[styles.chipText, status?.stage === 'live' && styles.chipTextLive]}>{copy.chip}</Text>
          </View>
        ) : null}
      </View>
      {error ? <Text style={styles.body}>{error}</Text> : null}
      {!status && !error ? <ActivityIndicator color={colors.clubGreen} /> : null}
      {status && copy ? (
        <>
          <Text style={styles.body}>{copy.body}</Text>
          {status.photos.length ? (
            <View style={styles.grid}>
              {status.photos.map((p) => (
                <TouchableOpacity key={p.id} style={styles.thumb} onPress={() => setViewing(p.id)} accessibilityLabel="View scorecard photo">
                  {thumbs[p.id] ? <Image source={{ uri: thumbs[p.id] }} style={styles.thumbImg} resizeMode="cover" /> : <ActivityIndicator color={colors.clubGreen} />}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View style={styles.actions}>
            <PillButton
              label={uploading ? 'Uploading' : status.photos.length ? 'Add photos' : 'Upload scorecard photos'}
              icon="cloud-upload-outline"
              onPress={upload}
              loading={!!uploading}
              disabled={!!uploading}
            />
            <Text style={styles.small}>
              {uploading ? `Photo ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}` : `${status.photos.length} of ${status.maxPhotos} photos`}
            </Text>
          </View>
        </>
      ) : null}

      <Modal visible={viewing != null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewing(null)} accessibilityLabel="Close" />
          {viewing && thumbs[viewing] ? <Image source={{ uri: thumbs[viewing] }} style={styles.viewerImg} resizeMode="contain" /> : null}
          <View style={styles.viewerBar}>
            <TouchableOpacity onPress={() => viewing && remove(viewing)} style={styles.viewerBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.white} />
              <Text style={styles.viewerBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewing(null)} style={styles.viewerBtn}>
              <Ionicons name="close" size={18} color={colors.white} />
              <Text style={styles.viewerBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm + 2 },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconChip: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.mintBg, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: fontFamily.heading, fontSize: 18, color: colors.textPrimary },
    chip: { backgroundColor: colors.warningBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    chipLive: { backgroundColor: colors.mintBg },
    chipText: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, color: colors.warning },
    chipTextLive: { color: colors.clubGreen },
    body: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    small: { fontFamily: fontFamily.body, fontSize: 12, color: colors.textMuted },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    thumb: { width: 92, height: 70, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    thumbImg: { width: '100%', height: '100%' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
    viewerImg: { width: '100%', height: '80%' },
    viewerBar: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
    viewerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
    viewerBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.white },
  });
}
