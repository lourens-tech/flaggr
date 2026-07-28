import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { toCsv, exportCsv } from '../../utils/csv';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminAd } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseAds'>;

const PLACEMENTS: Array<{ label: string; value: AdminAd['placement'] }> = [
  { label: 'Home', value: 'home' },
  { label: 'Home (Top Banner)', value: 'home_top' },
  { label: 'Rewards Shop', value: 'rewards_shop' },
];

const PLACEMENT_LABELS: Record<AdminAd['placement'], string> = {
  home: 'Home',
  home_top: 'Home (Top Banner)',
  rewards_shop: 'Rewards Shop',
};

// Same list/edit shape as the course-admin AdminAdsListScreen/AdminAdEditScreen
// (currently unreachable — the Ads tab was removed from the course-admin nav
// specifically to reserve ad management for super_admin), rewired for an
// explicit courseId param instead of the calling admin's own session course.
export function SuperAdminCourseAdsScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { courseId, courseName } = route.params;
  const { getSuperAdminAds } = useAdmin();
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [placement, setPlacement] = useState<AdminAd['placement']>('home');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAds(await getSuperAdminAds(courseId));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load ads', message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]),
  );

  const filtered = ads.filter((a) => a.placement === placement);

  const report = useMemo(() => {
    const totalClicks = ads.reduce((sum, a) => sum + a.clicks, 0);
    const activeAds = ads.filter((a) => a.active).length;
    return { totalAds: ads.length, activeAds, totalClicks };
  }, [ads]);

  const handleExport = async () => {
    const csv = toCsv(
      ['Title', 'Placement', 'Status', 'Clicks', 'Starts', 'Ends'],
      ads.map((a) => [
        a.title || '(untitled ad)',
        PLACEMENT_LABELS[a.placement],
        a.active ? 'Active' : 'Inactive',
        a.clicks,
        a.startsAt ?? '',
        a.endsAt ?? '',
      ]),
    );
    const safeName = courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'course';
    try {
      await exportCsv(`${safeName}-ads-report.csv`, csv);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t export report', message);
    }
  };

  const renderItem = ({ item }: { item: AdminAd }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('SuperAdminAdEdit', { courseId, adId: item.id })}
      activeOpacity={0.8}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="megaphone-outline" size={20} color={colors.clubGreen} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.title || '(untitled ad)'}</Text>
        <Text style={styles.subtitle}>{item.clicks} clicks{item.active ? '' : ' · inactive'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader
          title={courseName}
          onBack={() => navigation.goBack()}
          right={
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleExport}
                hitSlop={8}
                accessibilityLabel="Export Report"
                accessibilityRole="button"
              >
                <Ionicons name="download-outline" size={24} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('SuperAdminAdEdit', { courseId })}
                hitSlop={8}
                accessibilityLabel="Add Ad"
                accessibilityRole="button"
              >
                <Ionicons name="add-circle" size={26} color={colors.white} />
              </TouchableOpacity>
            </View>
          }
        />
      </SafeAreaView>

      <View style={styles.reportCard}>
        <View style={styles.reportStat}>
          <Text style={styles.reportValue}>{report.totalAds}</Text>
          <Text style={styles.reportLabel}>Total Ads</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={styles.reportValue}>{report.activeAds}</Text>
          <Text style={styles.reportLabel}>Active</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={styles.reportValue}>{report.totalClicks}</Text>
          <Text style={styles.reportLabel}>Total Clicks</Text>
        </View>
      </View>

      <View style={styles.placementToggle}>
        {PLACEMENTS.map((p) => (
          <TouchableOpacity
            key={p.value}
            onPress={() => setPlacement(p.value)}
            style={[styles.placementPill, placement === p.value && styles.placementPillActive]}
          >
            <Text style={[styles.placementText, placement === p.value && styles.placementTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No ads in this slot yet — tap + to add one.</Text>}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reportCard: {
    flexDirection: 'row',
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    marginHorizontal: screenPadding,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  reportStat: { flex: 1, alignItems: 'center' },
  reportValue: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary },
  reportLabel: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  placementToggle: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: screenPadding, paddingTop: spacing.md },
  placementPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.mintBgAlt },
  placementPillActive: { backgroundColor: colors.darkGreen },
  placementText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.textPrimary },
  placementTextActive: { color: colors.white },
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.imagePlaceholder },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  subtitle: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
}
