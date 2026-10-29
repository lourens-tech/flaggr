import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, CircleButton, EmptyState, ErrorState, FLAGRR_BACKDROP, Muted, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SuperAdminCourseSummary } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

// Scrim over the photo behind the "All Courses" card (same as the mockup).
const PHOTO_SCRIM = ['rgba(6,14,10,0.78)', 'rgba(6,14,10,0.45)', 'rgba(6,14,10,0.2)'] as const;
const ON_PHOTO = '#FFFFFF';

function clubInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function ClubRow({ item, first, onPress }: { item: SuperAdminCourseSummary; first: boolean; onPress: () => void }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={({ pressed }) => [styles.courseRow, hoverTransition, (hovered || pressed) && { backgroundColor: c.fill2 }]}
    >
      <View style={styles.crest}>
        <Text style={styles.crestText}>{clubInitials(item.name)}</Text>
      </View>
      <View style={[styles.courseRowMain, !first && styles.rowRule]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.courseTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.courseSlug} numberOfLines={1}>flagrr.com/{item.slug}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={c.ink3} />
      </View>
    </Pressable>
  );
}

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminAds'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

// A global-ad-aware course picker: "All Courses" (courseId 'global',
// see resolveAdCourseId in api/admin/index.ts) sets an ad shown to every
// club's members, alongside picking any one specific club. Tapping either
// opens the same SuperAdminCourseAdsScreen this already used from a course
// card's "Manage Ads" button.
export function SuperAdminAdsScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { superAdminCourses, loadSuperAdminCourses } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return superAdminCourses;
    return superAdminCourses.filter(
      (c) => c.name.toLowerCase().includes(query) || c.slug.toLowerCase().includes(query),
    );
  }, [superAdminCourses, search]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        setLoadError(false);
        try {
          await loadSuperAdminCourses();
        } catch {
          if (!cancelled) setLoadError(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Retry after a failed load (same call as on focus).
  const retryLoad = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      await loadSuperAdminCourses();
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const allCoursesRow = (
    <Pressable
      style={[styles.allCoursesRow, !isDesktop && styles.allCoursesRowPhone]}
      onPress={() => navigation.navigate('SuperAdminCourseAds', { courseId: 'global', courseName: 'All Courses' })}
      accessibilityRole="button"
      accessibilityLabel="All Courses, shown to every club's members"
    >
      <Image source={FLAGRR_BACKDROP} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} accessibilityIgnoresInvertColors />
      <LinearGradient colors={PHOTO_SCRIM} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={styles.globe}>
        <Ionicons name="globe-outline" size={26} color="#CDDE5C" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.allCoursesTitle}>All Courses</Text>
        <Text style={styles.allCoursesSubtitle}>Shown to every club's members</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={ON_PHOTO} />
    </Pressable>
  );

  const searchField = <TextField placeholder="Search courses" variant="onLight" icon="search" value={search} onChangeText={setSearch} />;

  const clubList = loadError ? (
    <ErrorState onRetry={retryLoad} />
  ) : loading ? (
    <Tile>
      <SkeletonRows rows={4} />
    </Tile>
  ) : filtered.length === 0 ? (
    <Tile padded={false}>
      <EmptyState
        icon={superAdminCourses.length === 0 ? 'business-outline' : 'search-outline'}
        title={superAdminCourses.length === 0 ? 'No courses yet.' : 'No courses match your search.'}
      />
    </Tile>
  ) : (
    <Tile padded={false} style={styles.listTile}>
      {filtered.map((item, i) => (
        <ClubRow
          key={item.id}
          item={item}
          first={i === 0}
          onPress={() => navigation.navigate('SuperAdminCourseAds', { courseId: item.id, courseName: item.name })}
        />
      ))}
    </Tile>
  );

  const newAdButton = (
    <AdminButton label="New Ad" icon="add" variant="accent" onPress={() => navigation.navigate('SuperAdminAdEdit', {})} />
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminAds" breadcrumb="Ads" headerRight={newAdButton}>
        <PageTitle>Ads</PageTitle>
        <Muted style={styles.dPageSubtitle}>Pick a club, or All Courses for a platform-wide ad — or start a new ad and choose its targeting directly</Muted>
        {allCoursesRow}
        <View style={styles.dSectionRow}>
          <Text style={styles.sectionTitle}>Specific Club</Text>
          <View style={styles.dSearchWrap}>{searchField}</View>
        </View>
        {clubList}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Ads"
        subtitle="Pick a club, or All Courses for a platform-wide ad"
        showBack={false}
        right={<CircleButton icon="add" size={44} onPress={() => navigation.navigate('SuperAdminAdEdit', {})} accessibilityLabel="New Ad" />}
      />

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {allCoursesRow}
        {searchField}
        <Text style={styles.sectionTitle}>Specific Club</Text>
        {clubList}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 },
  allCoursesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 120,
    borderRadius: adminRadius.lg,
    overflow: 'hidden',
    paddingHorizontal: 26,
    paddingVertical: 22,
    marginTop: 16,
  },
  allCoursesRowPhone: { minHeight: 96, borderRadius: adminRadius.md, paddingHorizontal: 18, paddingVertical: 16, marginTop: 0 },
  globe: { width: 52, height: 52, borderRadius: adminRadius.sm, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  allCoursesTitle: { ...adminFont.bodyBold, fontSize: 20, color: ON_PHOTO },
  allCoursesSubtitle: { ...adminFont.body, fontSize: 14, color: ON_PHOTO, opacity: 0.85, marginTop: 2 },
  sectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
  listTile: { overflow: 'hidden' },
  courseRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, minHeight: 60 },
  courseRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginLeft: 12, paddingRight: 14 },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  crest: { width: 36, height: 36, borderRadius: adminRadius.sm, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  crestText: { ...adminFont.bodyBold, fontSize: 12.5, color: '#CDDE5C' },
  courseTitle: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  courseSlug: { ...adminFont.body, fontSize: 12.5, color: c.ink2, marginTop: 1 },
  dPageSubtitle: { marginTop: 4 },
  dSectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 24, marginBottom: 12 },
  dSearchWrap: { width: 280 },
});
}
