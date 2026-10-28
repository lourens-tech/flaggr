import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { adminApi, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { pickCourseMapFile } from '../../utils/pickCourseMapFile';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, radius, spacing } from '../../theme';
import type { ScorecardPhoto, SuperAdminGolfCourseDetail } from '../../golf/adminDto';
import { GENDERS } from '../../golf/courseMap';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseMap'>;

const problemText = (e: unknown) =>
  e instanceof AdminApiError && e.problems.length ? `${e.message}\n\n• ${e.problems.join('\n• ')}` : e instanceof Error ? e.message : undefined;

// One club's course map: the GM's scorecard photos (to hand to whoever builds
// the map), the imported map with anything still blocking it, and publishing.
export function SuperAdminCourseMapScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { clubId, clubName } = route.params;
  const [golfCourseId, setGolfCourseId] = useState<string | null>(route.params.golfCourseId ?? null);
  const [detail, setDetail] = useState<SuperAdminGolfCourseDetail | null>(null);
  const [photos, setPhotos] = useState<ScorecardPhoto[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let id = route.params.golfCourseId ?? null;
      if (clubId) {
        const [all, list] = await Promise.all([adminApi.superAdminGolfCourses(), adminApi.superAdminScorecardPhotos(clubId)]);
        id = all.clubs.find((c) => c.clubId === clubId)?.golfCourse?.id ?? null;
        setPhotos(list);
        for (const p of list) {
          adminApi
            .superAdminScorecardPhoto(p.id)
            .then((r) => setImages((cur) => ({ ...cur, [p.id]: r.imageData })))
            .catch(() => {});
        }
      }
      setGolfCourseId(id);
      setDetail(id ? await adminApi.superAdminGolfCourse(id) : null);
    } catch (e) {
      showAlert('Could not load the course map', e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [clubId, route.params.golfCourseId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const importFile = async () => {
    try {
      const file = await pickCourseMapFile();
      if (!file) return;
      setBusy('import');
      const d = await adminApi.superAdminGolfCourseImport({ mapJson: file.text, clubId: golfCourseId ? null : clubId ?? null, golfCourseId });
      setDetail(d);
      setGolfCourseId(d.id);
      showAlert('Map imported', d.blockers.length ? `Saved as a draft. ${d.blockers.length} thing${d.blockers.length === 1 ? '' : 's'} to fix before it can go live.` : d.status === 'live' ? 'The live map has been updated.' : 'Saved as a draft. It’s ready to publish.');
    } catch (e) {
      showAlert('Could not import the map', problemText(e));
    } finally {
      setBusy(null);
    }
  };

  const publish = async (live: boolean) => {
    if (!detail) return;
    setBusy('publish');
    try {
      setDetail(await adminApi.superAdminGolfCoursePublish(detail.id, live));
    } catch (e) {
      showAlert(live ? 'Could not publish' : 'Could not unpublish', problemText(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    if (!detail) return;
    showAlert('Delete this draft map?', 'Rounds already played on it keep their own copy of the card.', [
      {
        text: 'Delete map',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminApi.superAdminGolfCourseDelete(detail.id);
            if (clubId) {
              setDetail(null);
              setGolfCourseId(null);
            } else navigation.goBack();
          } catch (e) {
            showAlert('Could not delete the map', problemText(e));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const download = (id: string, i: number) => {
    const data = images[id];
    if (!data) return;
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = data;
      a.download = `${(clubName ?? 'club').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-scorecard-${i + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      Linking.openURL(data).catch(() => showAlert('Open this screen on the web console to download photos.'));
    }
  };

  const title = detail?.name ?? clubName ?? 'Course map';
  const body = (
    <View style={{ gap: spacing.md }}>
      {loading && !detail ? <ActivityIndicator color={colors.clubGreen} /> : null}

      {clubId ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Scorecard photos from the club</Text>
          {photos.length ? (
            <>
              <Text style={styles.body}>Download these and hand them over with the club’s name to build the map (docs/Course-Maps.md).</Text>
              <View style={styles.grid}>
                {photos.map((p, i) => (
                  <View key={p.id} style={styles.photo}>
                    <TouchableOpacity style={styles.thumb} onPress={() => setViewing(p.id)} accessibilityLabel={`View photo ${i + 1}`}>
                      {images[p.id] ? <Image source={{ uri: images[p.id] }} style={styles.thumbImg} resizeMode="cover" /> : <ActivityIndicator color={colors.clubGreen} />}
                    </TouchableOpacity>
                    <Text style={styles.small}>
                      {new Date(p.createdAt).toLocaleDateString('en-ZA')}
                      {p.uploadedBy ? ` · ${p.uploadedBy}` : ''}
                    </Text>
                    {Platform.OS === 'web' ? (
                      <TouchableOpacity onPress={() => download(p.id, i)} disabled={!images[p.id]}>
                        <Text style={styles.link}>Download</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.body}>The club hasn’t uploaded any yet. Their GM can do it from the Course map panel on their dashboard.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={[styles.panelTitle, { flex: 1 }]}>Course map</Text>
          {detail ? (
            <View style={[styles.chip, detail.status === 'live' ? styles.chipLive : styles.chipDraft]}>
              <Text style={[styles.chipText, detail.status === 'live' ? styles.chipTextLive : styles.chipTextDraft]}>{detail.status === 'live' ? 'Live' : 'Draft'}</Text>
            </View>
          ) : null}
        </View>
        {!detail && !loading ? <Text style={styles.body}>No map imported yet.</Text> : null}
        {detail ? (
          <>
            <Text style={styles.body}>
              <Text style={styles.strong}>{detail.name}</Text>
              {detail.location ? ` · ${detail.location}` : ''} · {detail.holeCount} holes
              {detail.par.men != null ? ` · par ${detail.par.men}` : ''}
              {detail.par.ladies != null && detail.par.ladies !== detail.par.men ? ` (ladies ${detail.par.ladies})` : ''}
            </Text>
            <Text style={styles.small}>
              Imported {new Date(detail.importedAt).toLocaleString('en-ZA')}
              {detail.publishedAt ? ` · first published ${new Date(detail.publishedAt).toLocaleDateString('en-ZA')}` : ''} · {detail.rounds} round{detail.rounds === 1 ? '' : 's'} played
            </Text>
            <View style={styles.table}>
              <View style={[styles.tr, styles.thead]}>
                {['Tee', 'Length', "Men's CR / Slope", "Ladies' CR / Slope", '9-hole'].map((h) => (
                  <Text key={h} style={styles.th}>
                    {h}
                  </Text>
                ))}
              </View>
              {detail.tees.map((t) => (
                <View key={t.id} style={styles.tr}>
                  <View style={[styles.td, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <View style={[styles.dot, { backgroundColor: t.color }]} />
                    <Text style={styles.tdText}>{t.name}</Text>
                  </View>
                  <Text style={[styles.td, styles.tdText]}>{t.totalLength == null ? '–' : `${t.totalLength.toLocaleString('en-ZA')} m`}</Text>
                  {GENDERS.map((g) => (
                    <Text key={g} style={[styles.td, styles.tdText]}>
                      {t.ratings[g] ? `${t.ratings[g]!.full.cr.toFixed(1)} / ${t.ratings[g]!.full.slope}` : '–'}
                    </Text>
                  ))}
                  <Text style={[styles.td, styles.tdText]}>{GENDERS.some((g) => t.ratings[g]?.front9 || t.ratings[g]?.back9) ? 'Yes' : 'No'}</Text>
                </View>
              ))}
            </View>

            {detail.blockers.length ? (
              <View style={styles.blockers}>
                <Text style={styles.blockersTitle}>Can’t go live yet</Text>
                {detail.blockers.map((b) => (
                  <Text key={b} style={styles.blocker}>
                    • {b}
                  </Text>
                ))}
              </View>
            ) : (
              <View style={styles.ready}>
                <Ionicons name="checkmark-circle" size={16} color={colors.clubGreen} />
                <Text style={styles.readyText}>Card complete: par, stroke index, lengths and ratings all check out.</Text>
              </View>
            )}
            {detail.notes.length ? (
              <View style={{ gap: 4 }}>
                <Text style={styles.strong}>Notes from the build</Text>
                {detail.notes.map((n) => (
                  <Text key={n} style={styles.small}>
                    • {n}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        <View style={styles.actions}>
          {detail?.status === 'live' ? (
            <PillButton label="Unpublish" onPress={() => publish(false)} loading={busy === 'publish'} disabled={!!busy} variant="outline" />
          ) : detail ? (
            <PillButton label="Publish to members" icon="checkmark-outline" onPress={() => publish(true)} loading={busy === 'publish'} disabled={!!busy || detail.blockers.length > 0} />
          ) : null}
          <PillButton label={detail ? 'Replace map file' : 'Import map file'} icon="cloud-upload-outline" onPress={importFile} loading={busy === 'import'} disabled={!!busy} variant={detail ? 'outline' : 'primary'} />
          {detail && detail.status === 'draft' ? (
            <TouchableOpacity onPress={remove} style={{ padding: 8 }}>
              <Text style={styles.delete}>Delete draft</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Modal visible={viewing != null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewing(null)} accessibilityLabel="Close" />
          {viewing && images[viewing] ? <Image source={{ uri: images[viewing] }} style={styles.viewerImg} resizeMode="contain" /> : null}
          <TouchableOpacity onPress={() => setViewing(null)} style={styles.viewerBtn}>
            <Text style={styles.viewerBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourseMaps" breadcrumb={`Course Maps / ${title}`}>
        <Text style={styles.dTitle}>{title}</Text>
        {body}
      </SuperAdminDesktopFrame>
    );
  }
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Course Map" onBack={() => navigation.goBack()} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.dTitle, { fontSize: 22 }]}>{title}</Text>
        {body}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerSafeArea: { backgroundColor: colors.clubGreen },
    content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
    dTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary, marginBottom: spacing.sm },
    panel: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm + 2 },
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    panelTitle: { fontFamily: fontFamily.heading, fontSize: 18, color: colors.textPrimary },
    body: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    strong: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.textPrimary },
    small: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },
    link: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.clubGreen, textDecorationLine: 'underline' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    photo: { width: 150, gap: 4 },
    thumb: { width: 150, height: 112, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    thumbImg: { width: '100%', height: '100%' },
    chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    chipLive: { backgroundColor: colors.mintBg },
    chipDraft: { backgroundColor: colors.inputBg },
    chipText: { fontFamily: fontFamily.bodySemiBold, fontSize: 11 },
    chipTextLive: { color: colors.clubGreen },
    chipTextDraft: { color: colors.textSecondary },
    table: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
    tr: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, minHeight: 34 },
    thead: { borderTopWidth: 0, backgroundColor: colors.inputBg },
    th: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, fontFamily: fontFamily.bodySemiBold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
    td: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
    tdText: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textPrimary },
    dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
    blockers: { backgroundColor: colors.warningBg, borderRadius: 10, padding: spacing.sm + 4, gap: 4 },
    blockersTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.warning },
    blocker: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textPrimary, lineHeight: 18 },
    ready: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.mintBg, borderRadius: 10, padding: spacing.sm + 2 },
    readyText: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textPrimary, flexShrink: 1 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, flexWrap: 'wrap' },
    delete: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.negative },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
    viewerImg: { width: '100%', height: '82%' },
    viewerBtn: { marginTop: spacing.md, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
    viewerBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.white },
  });
}
