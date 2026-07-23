import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError, type RewardVariantPayload } from '../../api/adminClient';
import { pickAndResizeAvatar, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={existing ? 'Edit Reward' : 'New Reward'} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={uploadingImage}>
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={24} color={colors.clubGreen} />
              <Text style={styles.imagePlaceholderText}>Add photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextField placeholder="Title" variant="onLight" value={title} onChangeText={setTitle} />
        <View style={{ height: spacing.md }} />
        <TextField placeholder="Description" variant="onLight" value={description} onChangeText={setDescription} multiline />
        <View style={{ height: spacing.md }} />
        <SelectField placeholder="Category" variant="onLight" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />

        <View style={styles.activeRow}>
          <Text style={styles.activeLabel}>Visible in Rewards Shop</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.clubGreen }} />
        </View>

        <Text style={styles.sectionTitle}>Options</Text>
        {variants
          .filter((v) => v.active !== false)
          .map((v) => (
            <View key={v.key} style={styles.variantCard}>
              <View style={styles.variantRow}>
                <View style={{ flex: 1 }}>
                  <TextField
                    placeholder="Label (e.g. R500 or Standard)"
                    variant="onLight"
                    value={v.label}
                    onChangeText={(text) => updateVariant(v.key, { label: text })}
                  />
                </View>
                <TouchableOpacity onPress={() => removeVariant(v.key)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.negative} />
                </TouchableOpacity>
              </View>
              <View style={{ height: spacing.sm }} />
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
                <Text style={styles.computedCost}>
                  = {Math.round(v.randValue * course.fbPerRand).toLocaleString()} Flagrr Cash
                </Text>
              ) : null}
            </View>
          ))}

        <TouchableOpacity
          style={styles.addVariantButton}
          onPress={() => setVariants((prev) => [...prev, newVariant(prev.length)])}
        >
          <Ionicons name="add" size={18} color={colors.clubGreen} />
          <Text style={styles.addVariantText}>Add another option</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.lg }} />
        <PillButton label="Save Reward" onPress={handleSave} loading={saving} />

        {existing ? (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={saving}>
            <Text style={styles.deleteText}>Remove Reward</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  imagePicker: { alignSelf: 'center', marginBottom: spacing.lg },
  imagePreview: { width: 120, height: 120, borderRadius: radius.md },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.imagePlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imagePlaceholderText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.clubGreen },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  activeLabel: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.darkGreen,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  variantCard: {
    backgroundColor: '#F5F6F8',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  variantRow: { flexDirection: 'row', alignItems: 'center' },
  computedCost: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 4, marginLeft: 4 },
  addVariantButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm },
  addVariantText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.clubGreen },
  deleteButton: { alignItems: 'center', marginTop: spacing.lg },
  deleteText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
});
