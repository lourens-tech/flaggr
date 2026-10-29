import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminButton, PageTitle, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { adminApi, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { pickCourseMapFile } from '../../utils/pickCourseMapFile';
import { useAdminTheme } from '../../context/ThemeContext';
import type { ScorecardPhoto, SuperAdminGolfCourseDetail } from '../../golf/adminDto';
import { GENDERS } from '../../golf/courseMap';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseMap'>;

const problemText = (e: unknown) =>
  e instanceof AdminApiError && e.problems.length ? `${e.message}\n\n• ${e.problems.join('\n• ')}` : e instanceof Error ? e.message : undefined;

// One club's course map: the GM's scorecard photos (to hand to whoever builds
// the map), the imported map with anything still blocking it, and publishing.
export function SuperAdminCourseMapScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
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
      { text: 'Cancel', style: 'cancel' },
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
  const statusPill = detail ? (
    <StatusPill label={detail.status === 'live' ? 'Live' : 'Draft'} tone={detail.status === 'live' ? 'pos' : 'neutral'} style={styles.chip} />
  ) : null;

  const photosPanel = clubId ? (
    <Tile style={[styles.panel, isDesktop && styles.dPhotos]}>
      <Text style={styles.panelTitle} accessibilityRole="header">Scorecard photos from the club</Text>
      {photos.length ? (
        <>
          <Text style={styles.body}>Download these and hand them over with the club’s name to build the map (docs/Course-Maps.md).</Text>
          <View style={styles.grid}>
            {photos.map((p, i) => (
              <View key={p.id} style={styles.photo}>
                <Pressable
                  style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
                  onPress={() => setViewing(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`View photo ${i + 1}`}
                >
                  {images[p.id] ? <Image source={{ uri: images[p.id] }} style={styles.thumbImg} resizeMode="cover" /> : <ActivityIndicator color={c.ink3} />}
                </Pressable>
                <Text style={styles.small}>
                  {new Date(p.createdAt).toLocaleDateString('en-ZA')}
                  {p.uploadedBy ? ` · ${p.uploadedBy}` : ''}
                </Text>
                {Platform.OS === 'web' ? (
                  <AdminButton
                    label="Download"
                    icon="download-outline"
                    variant="plain"
                    onPress={() => download(p.id, i)}
                    disabled={!images[p.id]}
                    accessibilityLabel={`Download photo ${i + 1}`}
                    style={styles.downloadBtn}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.body}>The club hasn’t uploaded any yet. Their GM can do it from the Course map panel on their dashboard.</Text>
      )}
    </Tile>
  ) : null;

  const mapPanel = (
    <Tile style={[styles.panel, isDesktop && styles.dMap]}>
      <View style={styles.panelHead}>
        <Text style={[styles.panelTitle, { flex: 1 }]} accessibilityRole="header">Course map</Text>
        {statusPill}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
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
                    <Text style={[styles.tdText, { flexShrink: 1 }]}>{t.name}</Text>
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
          </ScrollView>

          {detail.blockers.length ? (
            <View style={styles.blockers} accessibilityRole="alert">
              <View style={styles.blockersHead}>
                <Ionicons name="warning-outline" size={18} color={c.amber} />
                <Text style={styles.blockersTitle}>Can’t go live yet</Text>
              </View>
              {detail.blockers.map((b) => (
                <Text key={b} style={styles.blocker}>
                  • {b}
                </Text>
              ))}
            </View>
          ) : (
            <View style={styles.ready}>
              <Ionicons name="checkmark-circle" size={18} color={c.pos} />
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
          <AdminButton label="Unpublish" variant="glass" onPress={() => publish(false)} loading={busy === 'publish'} disabled={!!busy} />
        ) : detail ? (
          <AdminButton
            label="Publish to members"
            icon="checkmark-outline"
            variant="accent"
            onPress={() => publish(true)}
            loading={busy === 'publish'}
            disabled={!!busy || detail.blockers.length > 0}
          />
        ) : null}
        <AdminButton
          label={detail ? 'Replace map file' : 'Import map file'}
          icon="cloud-upload-outline"
          variant={detail ? 'glass' : 'accent'}
          onPress={importFile}
          loading={busy === 'import'}
          disabled={!!busy}
        />
        {detail && detail.status === 'draft' ? <AdminButton label="Delete draft" icon="trash-outline" variant="danger" onPress={remove} /> : null}
      </View>
    </Tile>
  );

  const body = (
    <View style={styles.bodyWrap}>
      {loading && !detail ? (
        <Tile>
          <SkeletonRows rows={4} />
        </Tile>
      ) : null}

      <View style={isDesktop && clubId ? styles.dCols : styles.stack}>
        {photosPanel}
        {mapPanel}
      </View>

      <Modal visible={viewing != null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewing(null)} accessibilityLabel="Close" />
          <View style={styles.viewerSheet} accessibilityViewIsModal>
            {viewing && images[viewing] ? <Image source={{ uri: images[viewing] }} style={styles.viewerImg} resizeMode="contain" /> : null}
            <View style={styles.viewerActions}>
              <AdminButton label="Close" variant="accent" onPress={() => setViewing(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourseMaps" breadcrumb={`Course Maps / ${title}`}>
        <View style={styles.dTitleRow}>
          <PageTitle style={{ flexShrink: 1 }}>{title}</PageTitle>
          {statusPill}
        </View>
        {body}
      </SuperAdminDesktopFrame>
    );
  }
  return (
    <View style={styles.screen}>
      {/* The course/club name is the header's large title on phone, so the
          in-body heading the old green bar needed is gone. */}
      <AdminMobileHeader title={title} />
      <ScrollView contentContainerStyle={styles.content}>
        {body}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, paddingBottom: 48, gap: 8 },
    bodyWrap: { gap: 14 },
    stack: { gap: 14 },
    dTitleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginBottom: 16 },
    dCols: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' },
    dPhotos: { flex: 1, minWidth: 320 },
    dMap: { flex: 1.5, minWidth: 420 },
    panel: { gap: 12 },
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    panelTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
    body: { ...adminFont.body, fontSize: 14, color: c.ink2, lineHeight: 20 },
    strong: { ...adminFont.bodySemiBold, fontSize: 14, color: c.ink },
    small: { ...adminFont.body, fontSize: 12.5, color: c.ink3, lineHeight: 18 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    photo: { width: 150, gap: 4 },
    thumb: {
      width: 150,
      height: 112,
      borderRadius: adminRadius.sm,
      overflow: 'hidden',
      backgroundColor: c.fill2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
    },
    pressed: { opacity: 0.8 },
    thumbImg: { width: '100%', height: '100%' },
    downloadBtn: { alignSelf: 'flex-start', height: 32 },
    chip: { flexShrink: 0, alignSelf: 'center' },
    tableScroll: { flexGrow: 1 },
    table: { flex: 1, minWidth: 520, borderWidth: StyleSheet.hairlineWidth, borderColor: c.edge, borderRadius: adminRadius.sm, overflow: 'hidden' },
    tr: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge, minHeight: 40 },
    thead: { borderTopWidth: 0, backgroundColor: c.fill2 },
    th: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, ...adminFont.bodyBold, fontSize: 11.5, letterSpacing: 1.1, textTransform: 'uppercase', color: c.ink3 },
    td: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
    tdText: { ...adminFont.body, ...tabularNums, fontSize: 13.5, color: c.ink },
    dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: c.bar },
    blockers: { backgroundColor: c.amberBg, borderRadius: adminRadius.sm, padding: 14, gap: 4 },
    blockersHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    blockersTitle: { ...adminFont.bodyBold, fontSize: 14.5, color: c.ink },
    blocker: { ...adminFont.body, fontSize: 13.5, color: c.ink, lineHeight: 19 },
    ready: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.posBg, borderRadius: adminRadius.sm, padding: 12 },
    readyText: { ...adminFont.body, fontSize: 13.5, color: c.ink, flexShrink: 1 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
    viewer: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
    viewerSheet: {
      width: '100%',
      maxWidth: 900,
      height: '88%',
      backgroundColor: c.sheet,
      borderRadius: adminRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
      padding: 16,
      gap: 12,
    },
    viewerImg: { flex: 1, width: '100%', borderRadius: adminRadius.sm },
    viewerActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  });
}
