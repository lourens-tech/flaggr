import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { DateField } from '../../components/common/DateField';
import { PillButton } from '../../components/common/PillButton';
import { AdMediaField } from '../../components/common/AdMediaField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminAd } from '../../data/adminTypes';
import type { AdMediaType } from '../../data/types';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminAdEdit'>;

const PLACEMENT_OPTIONS = [
  { label: 'Home Screen', value: 'home' },
  { label: 'Home (Top Banner)', value: 'home_top' },
  { label: 'Rewards Shop', value: 'rewards_shop' },
];

export function SuperAdminAdEditScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { courseId: launchCourseId, adId } = route.params;
  const { getSuperAdminAds, saveSuperAdminAd, deleteSuperAdminAd, superAdminCourses, loadSuperAdminCourses } = useAdmin();

  const [existing, setExisting] = useState<AdminAd | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(!!adId);
  const [title, setTitle] = useState('');
  const [placement, setPlacement] = useState<string | null>('home');
  const [targetUrl, setTargetUrl] = useState('');
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<AdMediaType>('image');
  const [saving, setSaving] = useState(false);

  // Targeting defaults to whatever context this screen was launched from
  // (a specific club's ad list, or the "All Courses" row) but stays fully
  // editable here — this form is the one place that owns the target set.
  const [isGlobal, setIsGlobal] = useState(launchCourseId === 'global');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(
    launchCourseId && launchCourseId !== 'global' ? [launchCourseId] : [],
  );
  const [courseSearch, setCourseSearch] = useState('');

  useEffect(() => {
    loadSuperAdminCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: adId ? 'Edit Ad' : 'New Ad' });
    if (!adId) return;
    (async () => {
      try {
        // The ad may target clubs beyond whatever list it was found
        // through — getSuperAdminAds(scope) still returns each ad's full
        // isGlobal/courseIds, so this always prefills the complete set.
        const ads = await getSuperAdminAds(launchCourseId ?? 'global');
        const found = ads.find((a) => a.id === adId) ?? null;
        setExisting(found);
        if (found) {
          setTitle(found.title);
          setPlacement(found.placement);
          setTargetUrl(found.targetUrl ?? '');
          setActive(found.active);
          setStartsAt(found.startsAt ? found.startsAt.slice(0, 10) : null);
          setEndsAt(found.endsAt ? found.endsAt.slice(0, 10) : null);
          setPreviewUrl(found.imageUrl);
          setMediaType(found.mediaType);
          setIsGlobal(found.isGlobal);
          setSelectedCourseIds(found.courseIds);
        }
      } catch (err) {
        const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t load ad', message);
      } finally {
        setLoadingExisting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCourse = useCallback((id: string) => {
    setSelectedCourseIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }, []);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    if (!query) return superAdminCourses;
    return superAdminCourses.filter((c) => c.name.toLowerCase().includes(query));
  }, [superAdminCourses, courseSearch]);

  const handleSave = async () => {
    if (!title.trim() || !placement) {
      showAlert('Missing info', 'Title and placement are required.');
      return;
    }
    if (!isGlobal && selectedCourseIds.length === 0) {
      showAlert('Missing info', 'Select at least one course, or switch on All Courses.');
      return;
    }
    setSaving(true);
    try {
      await saveSuperAdminAd({
        isGlobal,
        courseIds: isGlobal ? [] : selectedCourseIds,
        id: existing?.id,
        placement: placement as 'home' | 'home_top' | 'rewards_shop',
        title: title.trim(),
        imageBase64,
        mediaType,
        targetUrl: targetUrl.trim() || null,
        sortOrder: existing?.sortOrder ?? 0,
        active,
        startsAt,
        endsAt,
      });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save ad', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    showAlert('Remove this ad?', 'It will stop showing in the app immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteSuperAdminAd(existing.id);
            navigation.goBack();
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove ad', message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const title2 = existing ? 'Edit Ad' : 'New Ad';

  if (loadingExisting) {
    if (isDesktop) {
      return (
        <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb="Edit Ad" showRail={false}>
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        </SuperAdminDesktopFrame>
      );
    }
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <ScreenHeader title="Edit Ad" onBack={() => navigation.goBack()} />
        </SafeAreaView>
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  const form = (
    <>
      <AdMediaField
        mediaType={mediaType}
        previewUrl={previewUrl}
        onPicked={(result) => {
          setImageBase64(result.dataUri);
          setPreviewUrl(result.dataUri);
          setMediaType(result.mediaType);
        }}
      />
      <View style={{ height: spacing.lg }} />

      <TextField placeholder="Title (internal label)" variant="onLight" value={title} onChangeText={setTitle} />
      <View style={{ height: spacing.md }} />
      <SelectField placeholder="Placement" variant="onLight" options={PLACEMENT_OPTIONS} value={placement} onChange={setPlacement} />
      <View style={{ height: spacing.lg }} />

      <Text style={styles.sectionLabel}>Show To</Text>
      <View style={styles.activeRow}>
        <Text style={styles.activeLabel}>All Courses</Text>
        <Switch value={isGlobal} onValueChange={setIsGlobal} trackColor={{ true: colors.clubGreen }} />
      </View>

      {!isGlobal ? (
        <View style={styles.courseTargeting}>
          <TextField
            placeholder="Search courses"
            variant="onLight"
            icon="search"
            value={courseSearch}
            onChangeText={setCourseSearch}
          />
          <View style={{ height: spacing.sm }} />
          <View style={styles.courseList}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {filteredCourses.length === 0 ? (
                <Text style={styles.emptyCoursesText}>
                  {superAdminCourses.length === 0 ? 'No courses yet.' : 'No courses match your search.'}
                </Text>
              ) : (
                filteredCourses.map((c) => {
                  const selected = selectedCourseIds.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.courseRow}
                      onPress={() => toggleCourse(c.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={colors.clubGreen} />
                      <Text style={styles.courseRowText} numberOfLines={1}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
          {selectedCourseIds.length > 0 ? (
            <Text style={styles.selectedCountText}>
              {selectedCourseIds.length} course{selectedCourseIds.length === 1 ? '' : 's'} selected
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <TextField
        placeholder="Link (https://...)"
        variant="onLight"
        autoCapitalize="none"
        keyboardType="url"
        value={targetUrl}
        onChangeText={setTargetUrl}
      />

      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <DateField placeholder="Starts (optional)" variant="onLight" value={startsAt} onChange={setStartsAt} />
        </View>
        <View style={{ width: spacing.md }} />
        <View style={{ flex: 1 }}>
          <DateField placeholder="Ends (optional)" variant="onLight" value={endsAt} onChange={setEndsAt} />
        </View>
      </View>

      <View style={styles.activeRow}>
        <Text style={styles.activeLabel}>Active</Text>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.clubGreen }} />
      </View>

      <View style={{ height: spacing.lg }} />
      <PillButton label="Save Ad" onPress={handleSave} loading={saving} />

      {existing ? (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={saving}>
          <Text style={styles.deleteText}>Remove Ad</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={title2} showRail={false}>
        <Text style={styles.dPageTitle}>{title2}</Text>
        <DesktopPanel title=" " style={{ maxWidth: 520 }}>
          {form}
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={title2} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {form}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  dateRow: { flexDirection: 'row', marginTop: spacing.md },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  activeLabel: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  sectionLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textSecondary, marginBottom: spacing.xs },
  courseTargeting: { marginTop: spacing.md },
  courseList: {
    maxHeight: 220,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.sm },
  courseRowText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  emptyCoursesText: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary, padding: spacing.sm },
  selectedCountText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: spacing.xs },
  deleteButton: { alignItems: 'center', marginTop: spacing.lg },
  deleteText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
