import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminButton, PageTitle, Tile } from '../../components/admin/ui';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError, type RewardVariantPayload } from '../../api/adminClient';
import { pickAndResizeAvatar, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminRewardEdit'>;

const CATEGORY_OPTIONS = [
  { label: 'Rounds', value: 'rounds' },
  { label: 'Experiences', value: 'experiences' },
  { label: 'Pro Shop', value: 'pro-shop' },
  { label: 'Practice', value: 'practice' },
  { label: 'Dining', value: 'dining' },
];

let localVariantKey = 0;
interface LocalVariant extends RewardVariantPayload {
  key: string;
}

function newVariant(sortOrder: number): LocalVariant {
  localVariantKey += 1;
  return { key: `new-${localVariantKey}`, label: '', randValue: null, sortOrder, active: true };
}

export function AdminRewardEditScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  const { rewards, course, saveReward, deleteReward } = useAdmin();
  const existing = rewards.find((r) => r.id === route.params.rewardId);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState<string | null>(existing?.category ?? null);
  const [active, setActive] = useState(existing?.active ?? true);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existing?.imageUrl ?? null);
  const [variants, setVariants] = useState<LocalVariant[]>(
    existing && existing.variants.length > 0
      ? existing.variants.map((v) => ({
          key: v.id,
          id: v.id,
          label: v.label,
          randValue: v.randValue,
          cost: v.cost ?? undefined,
          sortOrder: v.sortOrder ?? 0,
          active: v.active ?? true,
        }))
      : [newVariant(0)],
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit Reward' : 'New Reward' });
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

  const updateVariant = (key: string, patch: Partial<LocalVariant>) => {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  };

  const removeVariant = (key: string) => {
    setVariants((prev) => (prev.length > 1 ? prev.map((v) => (v.key === key ? { ...v, active: false } : v)) : prev));
  };

  const handleSave = async () => {
    if (!title.trim() || !category) {
      showAlert('Missing info', 'Title and category are required.');
      return;
    }
    const cleanedVariants = variants.filter((v) => v.label.trim().length > 0);
    if (cleanedVariants.length === 0) {
      showAlert('Missing variant', 'Add at least one reward option (e.g. "Standard" or "R500").');
      return;
    }
    for (const v of cleanedVariants) {
      if (v.randValue == null && (v.cost == null || v.cost < 0)) {
        showAlert('Missing price', `"${v.label}" needs either a Rand value or a Flagrr Cash cost.`);
        return;
      }
    }

    setSaving(true);
    try {
      await saveReward({
        id: existing?.id,
        title: title.trim(),
        description: description.trim(),
        category,
        imageBase64,
        active,
        variants: cleanedVariants.map((v, i) => ({
          id: v.id,
          label: v.label.trim(),
          randValue: v.randValue,
          cost: v.cost,
          sortOrder: v.sortOrder ?? i,
          active: v.active,
        })),
      });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save reward', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    showAlert('Remove this reward?', 'It will stop showing in the Rewards Shop. Past redemptions are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteReward(existing.id);
            navigation.goBack();
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove reward', message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const pageTitle = existing ? 'Edit Reward' : 'New Reward';

  const form = (
    <View style={styles.form}>
      <Pressable
        onPress={handlePickImage}
        disabled={uploadingImage}
        accessibilityRole="button"
        accessibilityLabel={previewUrl ? 'Change photo' : 'Add photo'}
        style={({ pressed }) => [styles.imagePicker, { backgroundColor: c.fill, borderColor: c.edge }, pressed && { opacity: 0.85 }]}
      >
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.imagePreview} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={26} color={c.icon} />
            <Text style={[styles.imagePlaceholderText, { color: c.ink2 }]}>Add photo</Text>
          </View>
        )}
      </Pressable>

      <Tile style={styles.fields}>
        <TextField placeholder="Title" variant="onLight" value={title} onChangeText={setTitle} />
        <TextField placeholder="Description" variant="onLight" value={description} onChangeText={setDescription} multiline />
        <SelectField placeholder="Category" variant="onLight" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        <View style={[styles.activeRow, { borderTopColor: c.edge }]}>
          <Text style={[styles.activeLabel, { color: c.ink }]}>Visible in Rewards Shop</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: c.accent }} />
        </View>
      </Tile>

      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.ink }]}>Options</Text>
      {variants
        .filter((v) => v.active !== false)
        .map((v) => (
          <Tile key={v.key} style={styles.variantCard}>
            <View style={styles.variantRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  placeholder="Label (e.g. R500 or Standard)"
                  variant="onLight"
                  value={v.label}
                  onChangeText={(text) => updateVariant(v.key, { label: text })}
                />
              </View>
              <Pressable
                onPress={() => removeVariant(v.key)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove option"
                style={({ pressed }) => [styles.removeButton, { backgroundColor: c.negBg }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="remove" size={18} color={c.neg} />
              </Pressable>
            </View>
            <TextField
              placeholder={`Rand value (auto-prices at ${course.fbPerRand} FC per R1)`}
              variant="onLight"
              keyboardType="numeric"
              value={v.randValue != null ? String(v.randValue) : ''}
              onChangeText={(text) => {
                const n = text.trim() === '' ? null : Number(text);
                updateVariant(v.key, { randValue: Number.isFinite(n) ? n : null });
              }}
            />
            {v.randValue != null ? (
              <Text style={[styles.computedCost, { color: c.ink2 }]}>
                = {Math.round(v.randValue * course.fbPerRand).toLocaleString()} Flagrr Cash
              </Text>
            ) : null}
          </Tile>
        ))}

      <AdminButton
        variant="plain"
        icon="add"
        label="Add another option"
        onPress={() => setVariants((prev) => [...prev, newVariant(prev.length)])}
        style={styles.addVariantButton}
      />

      <View style={styles.actions}>
        <PillButton label="Save Reward" onPress={handleSave} loading={saving} />
        {existing ? (
          <AdminButton variant="danger" label="Remove Reward" onPress={handleDelete} disabled={saving} size="lg" fullWidth />
        ) : null}
      </View>
    </View>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame
        activeKey="AdminRewards"
        breadcrumb={`Rewards › ${existing ? existing.title : 'New reward'}`}
        showRail={false}
      >
        <PageTitle>{pageTitle}</PageTitle>
        {form}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={pageTitle} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {form}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 64 },
  form: { width: '100%', maxWidth: 640, gap: 14 },
  imagePicker: {
    height: 150,
    borderRadius: adminRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderText: { ...adminFont.bodySemiBold, fontSize: 14 },
  fields: { gap: 12 },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 52,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  activeLabel: { ...adminFont.body, fontSize: 15, flex: 1 },
  sectionTitle: { ...adminFont.bodyBold, fontSize: 17, marginTop: 10 },
  variantCard: { gap: 10 },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  computedCost: { ...adminFont.body, ...tabularNums, fontSize: 13, marginLeft: 4 },
  addVariantButton: { alignSelf: 'flex-start' },
  actions: { gap: 12, marginTop: 10 },
});
