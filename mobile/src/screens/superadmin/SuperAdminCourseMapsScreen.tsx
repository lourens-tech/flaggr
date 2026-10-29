import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminButton, EmptyState, ErrorState, Muted, PageTitle, SkeletonRows, StatusPill, Tile, type StatusTone } from '../../components/admin/ui';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { adminApi, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { pickCourseMapFile } from '../../utils/pickCourseMapFile';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SuperAdminGolfCourseSummary, SuperAdminGolfCourses } from '../../golf/adminDto';
import { adminFont, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseMaps'>;

type Row = SuperAdminGolfCourses['clubs'][number];

// Stage → pill tone: live is good, photos waiting on us need attention.
const STAGE_TONE: Record<'live' | 'draft' | 'todo' | 'none', StatusTone> = { live: 'pos', draft: 'neutral', todo: 'amber', none: 'neutral' };

// Every club's course map at a glance: who has sent scorecard photos, which
// maps are drafts and which are live, plus away-only courses (mapped courses
// that aren't Flagrr clubs). Clubs waiting on a map are listed first.
export function SuperAdminCourseMapsScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const [data, setData] = useState<SuperAdminGolfCourses | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    adminApi
      .superAdminGolfCourses()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load course maps.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const importAway = async () => {
    try {
      const file = await pickCourseMapFile();
      if (!file) return;
      setImporting(true);
      const detail = await adminApi.superAdminGolfCourseImport({ mapJson: file.text, clubId: null });
      navigation.navigate('SuperAdminCourseMap', { golfCourseId: detail.id });
    } catch (e) {
      showAlert('Could not import the map', e instanceof AdminApiError && e.problems.length ? `${e.message}\n\n• ${e.problems.join('\n• ')}` : e instanceof Error ? e.message : undefined);
    } finally {
      setImporting(false);
    }
  };

  const rank = (r: Row) => (r.archived ? 4 : r.golfCourse?.status === 'live' ? 3 : r.golfCourse ? 1 : r.photoCount ? 0 : 2);
  const clubs = (data?.clubs ?? []).slice().sort((a, b) => rank(a) - rank(b) || a.clubName.localeCompare(b.clubName));

  const stage = (r: Row) =>
    r.golfCourse?.status === 'live'
      ? { label: 'Live', tone: 'live' as const }
      : r.golfCourse
        ? { label: r.golfCourse.blockerCount ? `Draft · ${r.golfCourse.blockerCount} to fix` : 'Draft · ready to publish', tone: 'draft' as const }
        : r.photoCount
          ? { label: `${r.photoCount} photo${r.photoCount === 1 ? '' : 's'} · map to build`, tone: 'todo' as const }
          : { label: 'Waiting for scorecard', tone: 'none' as const };

  const intro = (
    <Text style={styles.intro}>
      Clubs send their scorecard photos from their dashboard. We build each club’s map from those photos, import the file on the
      club’s page, check nothing is stopping it from going live, then publish it. Until then, members see “coming soon”.
    </Text>
  );

  const clubsList = data ? (
    clubs.length ? (
      <Tile padded={false} style={styles.list}>
        {clubs.map((r, i) => {
          const st = stage(r);
          return (
            <MapRow
              key={r.clubId}
              isFirst={i === 0}
              title={`${r.clubName}${r.archived ? ' (archived)' : ''}`}
              meta={`${r.lastPhotoAt ? `Last photo ${new Date(r.lastPhotoAt).toLocaleDateString('en-ZA')}` : 'No photos yet'}${
                r.golfCourse ? ` · map imported ${new Date(r.golfCourse.importedAt).toLocaleDateString('en-ZA')}` : ''
              }`}
              chip={<StatusPill label={st.label} tone={STAGE_TONE[st.tone]} style={styles.chip} />}
              onPress={() => navigation.navigate('SuperAdminCourseMap', { clubId: r.clubId, clubName: r.clubName })}
              styles={styles}
            />
          );
        })}
      </Tile>
    ) : (
      <Tile>
        <EmptyState icon="map-outline" title="No clubs yet." />
      </Tile>
    )
  ) : null;

  const awaySection = data ? (
    <Tile style={styles.awayTile}>
      <Text style={styles.intro}>Courses that aren’t Flagrr clubs but that members can play as away courses.</Text>
      <View style={styles.importRow}>
        <AdminButton label="Import a course" icon="cloud-upload-outline" variant="accent" onPress={importAway} loading={importing} disabled={importing} />
      </View>
      {data.awayCourses.length ? (
        <View style={styles.awayList}>
          {data.awayCourses.map((g: SuperAdminGolfCourseSummary, i) => (
            <MapRow
              key={g.id}
              isFirst={i === 0}
              title={g.name}
              meta={[g.location, `${g.holeCount} holes`].filter(Boolean).join(' · ')}
              chip={
                <StatusPill
                  label={g.status === 'live' ? 'Live' : g.blockerCount ? `Draft · ${g.blockerCount} to fix` : 'Draft · ready'}
                  tone={g.status === 'live' ? 'pos' : 'neutral'}
                  style={styles.chip}
                />
              }
              onPress={() => navigation.navigate('SuperAdminCourseMap', { golfCourseId: g.id })}
              styles={styles}
              flush
            />
          ))}
        </View>
      ) : (
        <Muted style={styles.none}>None yet.</Muted>
      )}
    </Tile>
  ) : null;

  const status = (
    <>
      {error ? <ErrorState title="Couldn’t load course maps" body={error} onRetry={load} /> : null}
      {!data && !error ? (
        <Tile>
          <SkeletonRows rows={5} />
        </Tile>
      ) : null}
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourseMaps" breadcrumb="Course Maps">
        <PageTitle>Course maps</PageTitle>
        <View style={styles.dIntro}>{intro}</View>
        <View style={styles.dStatus}>{status}</View>
        {data ? (
          <View style={styles.dCols}>
            <View style={styles.dMain}>
              <Text style={styles.cap} accessibilityRole="header">Clubs</Text>
              {clubsList}
            </View>
            <View style={styles.dSide}>
              <Text style={styles.cap} accessibilityRole="header">Away-only courses</Text>
              {awaySection}
            </View>
          </View>
        ) : null}
      </SuperAdminDesktopFrame>
    );
  }
  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Course Maps" />
      <ScrollView contentContainerStyle={styles.content}>
        {intro}
        {status}
        {data ? (
          <>
            <Text style={styles.cap} accessibilityRole="header">Clubs</Text>
            {clubsList}
            <Text style={styles.cap} accessibilityRole="header">Away-only courses</Text>
            {awaySection}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MapRow({
  title,
  meta,
  chip,
  isFirst,
  onPress,
  styles,
  flush,
}: {
  title: string;
  meta: string;
  chip: React.ReactNode;
  isFirst: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  // Rows inside a padded tile sit flush with its content edge.
  flush?: boolean;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, flush && styles.rowFlush, hoverTransition, !isFirst && styles.rowDivider, (hovered || pressed) && styles.rowHover]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
      {chip}
      <Ionicons name="chevron-forward" size={16} color={c.ink3} />
    </Pressable>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, paddingBottom: 48, gap: 12 },
    intro: { ...adminFont.body, fontSize: 14, color: c.ink2, lineHeight: 20 },
    cap: { ...adminFont.bodyBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: c.ink3, marginTop: 12, marginLeft: 16 },
    list: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, paddingVertical: 10 },
    rowFlush: { paddingHorizontal: 0 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
    rowHover: { backgroundColor: c.fill2 },
    name: { ...adminFont.bodyBold, fontSize: 15, color: c.ink },
    meta: { ...adminFont.body, fontSize: 12.5, color: c.ink2, marginTop: 2 },
    chip: { flexShrink: 0, alignSelf: 'center' },
    awayTile: { gap: 12 },
    importRow: { flexDirection: 'row' },
    awayList: { marginTop: 2 },
    none: { marginTop: 2 },
    dIntro: { marginTop: 8, maxWidth: 680 },
    dStatus: { marginTop: 14, gap: 12 },
    dCols: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' },
    dMain: { flex: 1.6, minWidth: 380, gap: 8 },
    dSide: { flex: 1, minWidth: 300, gap: 8 },
  });
}
