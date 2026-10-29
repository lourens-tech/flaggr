import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { pickScorecardPhotos } from '../../utils/pickScorecardPhotos';
import { useAdminTheme } from '../../context/ThemeContext';
import type { CourseMapStage, CourseMapStatus } from '../../golf/adminDto';
import type { AdminColors } from '../../theme/admin';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';
import { AdminButton, ErrorState, Muted, SkeletonRows, Tile } from './ui';
import { PressableScale } from '../motion';

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

// The four stages in order, drawn as the stepper under the headline.
const STAGES: CourseMapStage[] = ['not_started', 'photos_received', 'building', 'live'];

// Dashboard panel where a club's GM uploads scorecard photos so Flagrr can
// build the club's course map, and sees how far it's got.
export function ScorecardUploadPanel() {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
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
      { text: 'Cancel', style: 'cancel' },
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
    ]);

  const copy = status ? STAGE_COPY[status.stage] : null;
  const stageIndex = status ? STAGES.indexOf(status.stage) : -1;
  return (
    <Tile style={styles.panel}>
      <View style={styles.head}>
        <Ionicons name="map-outline" size={16} color={c.icon} />
        <Text accessibilityRole="header" style={styles.title}>Course map</Text>
      </View>
      {error ? <ErrorState body={error} /> : null}
      {!status && !error ? <SkeletonRows rows={2} /> : null}
      {status && copy ? (
        <>
          <View style={{ gap: 10 }}>
            <Text style={styles.headline}>{copy.chip}</Text>
            <View style={styles.steps} accessible={false} importantForAccessibility="no-hide-descendants">
              {STAGES.map((stage, i) => (
                <View key={stage} style={[styles.step, { backgroundColor: i <= stageIndex ? c.ink2 : c.fill }]} />
              ))}
            </View>
          </View>
          <Muted>{copy.body}</Muted>
          {status.photos.length ? (
            <View style={styles.grid}>
              {status.photos.map((p) => (
                <PressableScale
                  key={p.id}
                  style={styles.thumb}
                  onPress={() => setViewing(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel="View scorecard photo"
                >
                  {thumbs[p.id] ? <Image source={{ uri: thumbs[p.id] }} style={styles.thumbImg} resizeMode="cover" /> : <ActivityIndicator color={c.ink3} />}
                </PressableScale>
              ))}
            </View>
          ) : null}
          <View style={styles.actions}>
            <AdminButton
              label={uploading ? 'Uploading' : status.photos.length ? 'Add photos' : 'Upload scorecard photos'}
              icon="cloud-upload-outline"
              onPress={upload}
              loading={!!uploading}
              disabled={!!uploading}
              size="lg"
              fullWidth
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
            <PressableScale onPress={() => viewing && remove(viewing)} style={styles.viewerBtn} accessibilityRole="button" accessibilityLabel="Delete">
              <Ionicons name="trash-outline" size={18} color={c.neg} />
              <Text style={[styles.viewerBtnText, { color: c.neg }]}>Delete</Text>
            </PressableScale>
            <PressableScale onPress={() => setViewing(null)} style={styles.viewerBtn} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={c.ink} />
              <Text style={styles.viewerBtnText}>Close</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </Tile>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    panel: { flexGrow: 1, gap: 14 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { flex: 1, ...adminFont.bodySemiBold, fontSize: 13.5, color: c.ink2 },
    headline: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
    steps: { flexDirection: 'row', gap: 6 },
    step: { flex: 1, height: 6, borderRadius: adminRadius.pill },
    small: { ...adminFont.body, ...tabularNums, fontSize: 12.5, color: c.ink3, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    thumb: {
      width: 52,
      height: 52,
      borderRadius: adminRadius.sm,
      overflow: 'hidden',
      backgroundColor: c.fill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
    },
    thumbImg: { width: '100%', height: '100%' },
    actions: { gap: 8 },
    viewer: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
    viewerImg: { width: '100%', height: '80%' },
    viewerBar: { flexDirection: 'row', gap: 12, marginTop: 16 },
    viewerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: 18,
      borderRadius: adminRadius.pill,
      backgroundColor: c.sheet,
    },
    viewerBtnText: { ...adminFont.bodySemiBold, fontSize: 14.5, color: c.ink },
  });
}
