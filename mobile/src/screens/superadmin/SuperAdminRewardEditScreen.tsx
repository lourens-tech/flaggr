import React, { useEffect, useState, useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError, type RewardVariantPayload } from '../../api/adminClient';
import { pickAndResizeAvatar, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { spacing } from '../../theme';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminReward } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminRewardEdit'>;

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

// Same form as AdminRewardEditScreen (the course_admin's own reward editor),
// rewired for an explicit courseId/fbPerRand param pair instead of the
// session's own course — a super_admin isn't scoped to one club, so it
// fetches the target club's reward list (mirroring SuperAdminAdEditScreen's
// pattern) to find the existing reward by id, rather than reading from a
// cached list it doesn't have.
export function SuperAdminRewardEditScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, fbPerRand, rewardId } = route.params;
  const { getSuperAdminRewards, saveSuperAdminReward, deleteSuperAdminReward, superAdminCourses } = useAdmin();
  // For the breadcrumb only; this route doesn't carry the club's name.
  const clubName = superAdminCourses.find((course) => course.id === courseId)?.name;
  const breadcrumb = ['Courses', clubName, 'Rewards'].filter(Boolean).join(' › ');

  const [existing, setExisting] = useState<AdminReward | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(!!rewardId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<LocalVariant[]>([newVariant(0)]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: rewardId ? 'Edit Reward' : 'New Reward' });
    if (!rewardId) return;
    (async () => {
      try {
        const rewards = await getSuperAdminRewards(courseId);
        const found = rewards.find((r) => r.id === rewardId) ?? null;
        setExisting(found);
        if (found) {
          setTitle(found.title);
          setDescription(found.description);
          setCategory(found.category);
          setActive(found.active);
          setPreviewUrl(found.imageUrl);
          setVariants(
            found.variants.length > 0
              ? found.variants.map((v) => ({
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
        }
      } catch (err) {
        const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t load reward', message);
      } finally {
        setLoadingExisting(false);
      }
    })();
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
      await saveSuperAdminReward({
        courseId,
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
            await deleteSuperAdminReward(courseId, existing.id);
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

  if (loadingExisting) {
    if (isDesktop) {
      return (
        <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={breadcrumb} showRail={false}>
          <PageTitle>Edit Reward</PageTitle>
          <Tile style={styles.dCard}>
            <SkeletonRows rows={4} />
          </Tile>
        </SuperAdminDesktopFrame>
      );
    }
    return (
      <View style={styles.screen}>
        <AdminMobileHeader title="Edit Reward" />
        <View style={styles.content}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      </View>
    );
  }

  const form = (
    <>
        <TouchableOpacity
          style={styles.imagePicker}
          onPress={handlePickImage}
          disabled={uploadingImage}
          accessibilityRole="button"
          accessibilityLabel={previewUrl ? 'Change photo' : 'Add photo'}
        >
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={24} color={c.icon} />
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
          <Switch value={active} onValueChange={setActive} trackColor={{ true: c.accent }} accessibilityLabel="Visible in Rewards Shop" />
        </View>

        <Text style={styles.sectionTitle}>Options</Text>
        {variants
          .filter((v) => v.active !== false)
          .map((v) => (
            <View key={v.key} style={styles.variantCard}>
              <View style={styles.variantRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TextField
                    placeholder="Label (e.g. R500 or Standard)"
                    variant="onLight"
                    value={v.label}
                    onChangeText={(text) => updateVariant(v.key, { label: text })}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => removeVariant(v.key)}
                  hitSlop={8}
                  style={styles.removeVariant}
                  accessibilityRole="button"
                  accessibilityLabel="Remove option"
                >
                  <Ionicons name="close-circle-outline" size={22} color={c.neg} />
                </TouchableOpacity>
              </View>
              <View style={{ height: spacing.sm }} />
              <TextField
                placeholder={`Rand value (auto-prices at ${fbPerRand} FC per R1)`}
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
                  = {Math.round(v.randValue * fbPerRand).toLocaleString()} Flagrr Cash
                </Text>
              ) : null}
            </View>
          ))}

        <AdminButton
          label="Add another option"
          icon="add"
          variant="plain"
          onPress={() => setVariants((prev) => [...prev, newVariant(prev.length)])}
          style={styles.addVariantButton}
        />

        <View style={{ height: spacing.lg }} />
        <PillButton label="Save Reward" onPress={handleSave} loading={saving} />

        {existing ? (
          <AdminButton label="Remove Reward" variant="danger" onPress={handleDelete} disabled={saving} style={styles.deleteButton} />
        ) : null}
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={breadcrumb} showRail={false}>
        <PageTitle>{pageTitle}</PageTitle>
        <Tile style={styles.dCard}>{form}</Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={pageTitle} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Tile>{form}</Tile>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: spacing.xl * 2 },
  imagePicker: { alignSelf: 'center', marginBottom: spacing.lg },
  imagePreview: { width: 120, height: 120, borderRadius: adminRadius.md },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: adminRadius.md,
    backgroundColor: c.fill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imagePlaceholderText: { ...adminFont.bodyMedium, fontSize: 13, color: c.ink2 },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 52,
    marginTop: spacing.sm,
  },
  activeLabel: { flexShrink: 1, ...adminFont.body, fontSize: 15, color: c.ink },
  sectionTitle: {
    ...adminFont.bodyBold,
    fontSize: 17,
    color: c.ink,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  variantCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    borderRadius: adminRadius.md,
    padding: 12,
    marginBottom: spacing.sm,
  },
  variantRow: { flexDirection: 'row', alignItems: 'center' },
  removeVariant: { marginLeft: spacing.sm, width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  computedCost: { ...adminFont.body, ...tabularNums, fontSize: 12.5, color: c.ink2, marginTop: 6, marginLeft: 4 },
  addVariantButton: { alignSelf: 'flex-start', height: 44 },
  deleteButton: { alignSelf: 'center', marginTop: spacing.md, height: 44 },
  dCard: { maxWidth: 560, marginTop: 16, padding: 24 },
});
}
