import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { fontFamily, fontSize, screenPadding, spacing } from '../../theme';
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
  const { courseId, adId } = route.params;
  const { getSuperAdminAds, saveSuperAdminAd, deleteSuperAdminAd } = useAdmin();

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

  useEffect(() => {
    navigation.setOptions({ title: adId ? 'Edit Ad' : 'New Ad' });
    if (!adId) return;
    (async () => {
      try {
        const ads = await getSuperAdminAds(courseId);
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

  const handleSave = async () => {
    if (!title.trim() || !placement) {
      showAlert('Missing info', 'Title and placement are required.');
      return;
    }
    setSaving(true);
    try {
      await saveSuperAdminAd({
        courseId,
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
            await deleteSuperAdminAd(courseId, existing.id);
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
      <View style={{ height: spacing.md }} />
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
  deleteButton: { alignItems: 'center', marginTop: spacing.lg },
  deleteText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
