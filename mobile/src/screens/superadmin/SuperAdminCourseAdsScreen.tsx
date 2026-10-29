import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { AdminButton, CircleButton, EmptyState, ErrorState, Muted, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError, downloadSuperAdminAdsReport } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import { useHover, hoverTransition } from '../../hooks/useHover';
import type { AdminAd } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseAds'>;

const PLACEMENTS: Array<{ label: string; value: AdminAd['placement'] }> = [
  { label: 'Home', value: 'home' },
  { label: 'Home (Top Banner)', value: 'home_top' },
  { label: 'Rewards Shop', value: 'rewards_shop' },
];

function clubInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// One ad in the grouped list: thumbnail, title, clicks, chevron.
function AdRow({ item, first, onPress }: { item: AdminAd; first: boolean; onPress: () => void }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title || '(untitled ad)'}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={({ pressed }) => [styles.row, hoverTransition, (hovered || pressed) && { backgroundColor: c.fill2 }]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="megaphone-outline" size={20} color={c.ink3} />
        </View>
      )}
      <View style={[styles.rowMain, !first && styles.rowRule]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{item.title || '(untitled ad)'}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{item.clicks} clicks{item.active ? '' : ' · inactive'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={c.ink3} />
      </View>
    </Pressable>
  );
}

// One club's ads, managed by a super_admin (club admins don't manage ads),
// for the courseId it was opened with.
export function SuperAdminCourseAdsScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName } = route.params;
  const { getSuperAdminAds } = useAdmin();
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [placement, setPlacement] = useState<AdminAd['placement']>('home');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setAds(await getSuperAdminAds(courseId));
    } catch (err) {
      setLoadError(true);
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
    const safeName = courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'course';
    try {
      const downloaded = await downloadSuperAdminAdsReport(courseId, `${safeName}-ads-report.xlsx`);
      if (!downloaded) {
        showAlert('Web only for now', 'Excel export is available on the Flagrr web app — open this screen in a browser to download this report.');
      }
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t export report', message);
    }
  };

  const openAd = (item: AdminAd) => navigation.navigate('SuperAdminAdEdit', { courseId, adId: item.id });

  const placementToggle = (
    <Segmented
      accessibilityLabel="Placement"
      options={PLACEMENTS.map((p) => ({ key: p.value, label: p.label }))}
      value={placement}
      onChange={setPlacement}
    />
  );

  const list = loadError ? (
    <ErrorState onRetry={load} />
  ) : loading ? (
    <Tile>
      <SkeletonRows rows={3} />
    </Tile>
  ) : filtered.length === 0 ? (
    <Tile padded={false}>
      <EmptyState icon="megaphone-outline" title={isDesktop ? 'No ads in this slot yet — add one.' : 'No ads in this slot yet — tap + to add one.'} />
    </Tile>
  ) : (
    <Tile padded={false} style={styles.listTile}>
      {filtered.map((item, i) => (
        <AdRow key={item.id} item={item} first={i === 0} onPress={() => openAd(item)} />
      ))}
    </Tile>
  );

  if (isDesktop) {
    const isGlobal = courseId === 'global';
    return (
      <SuperAdminDesktopFrame
        activeKey="SuperAdminCourses"
        breadcrumb={isGlobal ? `Ads › ${courseName}` : `Courses › ${courseName} › Ads`}
        showRail={false}
      >
        <View style={styles.dHeadRow}>
          {isGlobal ? (
            <View style={styles.crest}>
              <Ionicons name="globe-outline" size={22} color="#CDDE5C" />
            </View>
          ) : (
            <View style={styles.crest}>
              <Text style={styles.crestText}>{clubInitials(courseName)}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <PageTitle>{courseName}</PageTitle>
            <Muted style={styles.dSection}>Ads</Muted>
          </View>
        </View>
        <View style={styles.dStrip}>
          <DesktopStatCard label="Total Ads" value={report.totalAds} icon="megaphone-outline" />
          <DesktopStatCard label="Active" value={report.activeAds} icon="radio-button-on-outline" />
          <DesktopStatCard label="Total Clicks" value={report.totalClicks} icon="hand-left-outline" />
        </View>
        <View style={styles.dToolbar}>
          {placementToggle}
          <View style={{ flex: 1 }} />
          <AdminButton label="Export" icon="download-outline" variant="glass" onPress={handleExport} />
          <AdminButton label="Add Ad" icon="add" variant="accent" onPress={() => navigation.navigate('SuperAdminAdEdit', { courseId })} />
        </View>
        {list}
      </SuperAdminDesktopFrame>
    );
  }

  const reportCard = (
    <Tile style={styles.reportCard}>
      <View style={styles.reportStat}>
        <Text style={styles.reportValue}>{report.totalAds}</Text>
        <Text style={styles.reportLabel}>Total Ads</Text>
      </View>
      <View style={[styles.reportStat, styles.reportStatRule]}>
        <Text style={styles.reportValue}>{report.activeAds}</Text>
        <Text style={styles.reportLabel}>Active</Text>
      </View>
      <View style={[styles.reportStat, styles.reportStatRule]}>
        <Text style={styles.reportValue}>{report.totalClicks}</Text>
        <Text style={styles.reportLabel}>Total Clicks</Text>
      </View>
    </Tile>
  );

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Ads"
        subtitle={courseName}
        right={
          <View style={styles.headerActions}>
            <CircleButton icon="download-outline" onPress={handleExport} accessibilityLabel="Export Report" size={44} />
            <CircleButton icon="add" onPress={() => navigation.navigate('SuperAdminAdEdit', { courseId })} accessibilityLabel="Add Ad" size={44} />
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {reportCard}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segScroll}>
          {placementToggle}
        </ScrollView>
        {list}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 },
  // flexGrow 0: react-native-web gives ScrollView flex-grow/shrink 1 by default.
  segScroll: { flexGrow: 0, flexShrink: 0 },
  reportCard: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 14 },
  reportStat: { flex: 1, alignItems: 'center' },
  reportStatRule: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.edge },
  reportValue: { ...adminFont.bodyBold, ...tabularNums, fontSize: 24, letterSpacing: -0.5, color: c.ink },
  reportLabel: { ...adminFont.body, fontSize: 12.5, color: c.ink2, marginTop: 2 },
  listTile: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, minHeight: 72 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginLeft: 12, paddingRight: 14 },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  thumb: { width: 52, height: 52, borderRadius: adminRadius.sm, backgroundColor: c.fill },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  subtitle: { ...adminFont.body, ...tabularNums, fontSize: 13, color: c.ink2, marginTop: 2 },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  crest: { width: 48, height: 48, borderRadius: adminRadius.sm, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  crestText: { ...adminFont.bodyBold, fontSize: 16, color: '#CDDE5C' },
  dSection: { marginTop: 2, fontSize: 15 },
  dStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  dToolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 16, marginBottom: 12 },
});
}
