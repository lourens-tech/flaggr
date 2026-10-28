import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { PillButton } from '../../components/common/PillButton';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { adminApi, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { pickCourseMapFile } from '../../utils/pickCourseMapFile';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, radius, spacing } from '../../theme';
import type { SuperAdminGolfCourseSummary, SuperAdminGolfCourses } from '../../golf/adminDto';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseMaps'>;

type Row = SuperAdminGolfCourses['clubs'][number];

// Every club's course map at a glance: who has sent scorecard photos, which
// maps are drafts and which are live, plus away-only courses (mapped courses
// that aren't Flagrr clubs). Clubs waiting on a map are listed first.
export function SuperAdminCourseMapsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const [data, setData] = useState<SuperAdminGolfCourses | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      adminApi
        .superAdminGolfCourses()
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load course maps.'));
    }, []),
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

  const body = (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.intro}>
        GMs upload scorecard photos from their dashboard. Build the map with scripts/course-maps/build.ts (see docs/Course-Maps.md), import the file on the club, check
        nothing blocks it, then publish. Members see “coming soon” until it’s live.
      </Text>
      {error ? <Text style={styles.intro}>{error}</Text> : null}
      {!data && !error ? <ActivityIndicator color={colors.clubGreen} /> : null}
      {data ? (
        <>
          <Text style={styles.section}>Clubs</Text>
          <View style={styles.list}>
            {clubs.map((r) => {
              const st = stage(r);
              return (
                <TouchableOpacity
                  key={r.clubId}
                  style={styles.row}
                  onPress={() => navigation.navigate('SuperAdminCourseMap', { clubId: r.clubId, clubName: r.clubName })}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {r.clubName}
                      {r.archived ? ' (archived)' : ''}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {r.lastPhotoAt ? `Last photo ${new Date(r.lastPhotoAt).toLocaleDateString('en-ZA')}` : 'No photos yet'}
                      {r.golfCourse ? ` · map imported ${new Date(r.golfCourse.importedAt).toLocaleDateString('en-ZA')}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.chip, styles[`chip_${st.tone}`]]}>
                    <Text style={[styles.chipText, styles[`chipText_${st.tone}`]]}>{st.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.section}>Away-only courses</Text>
            <PillButton label="Import a course" icon="cloud-upload-outline" onPress={importAway} loading={importing} disabled={importing} variant="outline" />
          </View>
          <Text style={styles.intro}>Courses that aren’t Flagrr clubs but that members can play as away courses.</Text>
          {data.awayCourses.length ? (
            <View style={styles.list}>
              {data.awayCourses.map((g: SuperAdminGolfCourseSummary) => (
                <TouchableOpacity key={g.id} style={styles.row} onPress={() => navigation.navigate('SuperAdminCourseMap', { golfCourseId: g.id })} accessibilityRole="button">
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[g.location, `${g.holeCount} holes`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={[styles.chip, g.status === 'live' ? styles.chip_live : styles.chip_draft]}>
                    <Text style={[styles.chipText, g.status === 'live' ? styles.chipText_live : styles.chipText_draft]}>
                      {g.status === 'live' ? 'Live' : g.blockerCount ? `Draft · ${g.blockerCount} to fix` : 'Draft · ready'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.meta}>None yet.</Text>
          )}
        </>
      ) : null}
    </View>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourseMaps" breadcrumb="Course Maps">
        <Text style={styles.dTitle}>Course maps</Text>
        {body}
      </SuperAdminDesktopFrame>
    );
  }
  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Course Maps" />
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, paddingBottom: spacing.xxl },
    dTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary, marginBottom: spacing.sm },
    intro: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    section: { fontFamily: fontFamily.heading, fontSize: 18, color: colors.textPrimary },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
    list: { gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, padding: spacing.sm + 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    name: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    meta: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted },
    chip: { flexShrink: 0, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    chipText: { fontFamily: fontFamily.bodySemiBold, fontSize: 11 },
    chip_live: { backgroundColor: colors.mintBg },
    chipText_live: { color: colors.clubGreen },
    chip_draft: { backgroundColor: colors.inputBg },
    chipText_draft: { color: colors.textSecondary },
    chip_todo: { backgroundColor: colors.warningBg },
    chipText_todo: { color: colors.warning },
    chip_none: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    chipText_none: { color: colors.textMuted },
  });
}
