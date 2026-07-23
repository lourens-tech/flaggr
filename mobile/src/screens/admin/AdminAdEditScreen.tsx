import React, { useEffect, useState, useMemo } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { DateField } from '../../components/common/DateField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { pickAndResizeAvatar, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminAdEdit'>;

const PLACEMENT_OPTIONS = [
  { label: 'Home Screen', value: 'home' },
  { label: 'Rewards Shop', value: 'rewards_shop' },
];

export function AdminAdEditScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ads, saveAd, deleteAd } = useAdmin();
  const existing = ads.find((a) => a.id === route.params.adId);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [placement, setPlacement] = useState<string | null>(existing?.placement ?? 'home');
  const [targetUrl, setTargetUrl] = useState(existing?.targetUrl ?? '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [startsAt, setStartsAt] = useState<string | null>(existing?.startsAt ? existing.startsAt.slice(0, 10) : null);
  const [endsAt, setEndsAt] = useState<string | null>(existing?.endsAt ? existing.endsAt.slice(0, 10) : null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existing?.imageUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit Ad' : 'New Ad' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickImage = async () => {
    setUploadingImage(true);
    try {
      const result = await pickAndResizeAvatar();
      if (result) {
        setImageBase64(result);
        setPreviewUrl(result);
      }
    } catch (err) {
      if (err instanceof AvatarPermissionError) {
        showAlert('Permission needed', err.message);
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !placement) {
      showAlert('Missing info', 'Title and placement are required.');
      return;
    }
    setSaving(true);
    try {
      await saveAd({
        id: existing?.id,
        placement: placement as 'home' | 'rewards_shop',
        title: title.trim(),
        imageBase64,
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
            await deleteAd(existing.id);
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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={existing ? 'Edit Ad' : 'New Ad'} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={uploadingImage}>
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={24} color={colors.clubGreen} />
              <Text style={styles.imagePlaceholderText}>Add creative</Text>
            </View>
          )}
        </TouchableOpacity>

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
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  imagePicker: { alignSelf: 'center', marginBottom: spacing.lg },
  imagePreview: { width: 160, height: 90, borderRadius: radius.md },
  imagePlaceholder: {
    width: 160,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: colors.imagePlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imagePlaceholderText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.clubGreen },
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
});
}
