import React, { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminCatalogItemEdit'>;

export function AdminCatalogItemEditScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { kind, itemId } = route.params;
  const isProduct = kind === 'product';
  const {
    course,
    catalogProducts,
    catalogActivities,
    saveCatalogProduct,
    saveCatalogActivity,
    deleteCatalogProduct,
    deleteCatalogActivity,
  } = useAdmin();
  const existingProduct = isProduct ? catalogProducts.find((p) => p.id === itemId) : undefined;
  const existingActivity = !isProduct ? catalogActivities.find((a) => a.id === itemId) : undefined;

  const [name, setName] = useState(existingProduct?.name ?? existingActivity?.name ?? '');
  const [brand, setBrand] = useState(existingProduct?.brand ?? '');
  const [category, setCategory] = useState(existingProduct?.category ?? existingActivity?.category ?? '');
  const [aliasesText, setAliasesText] = useState((existingProduct?.aliases ?? existingActivity?.aliases ?? []).join(', '));
  const [randValueText, setRandValueText] = useState(
    existingProduct ? String(existingProduct.randValue) : existingActivity ? String(existingActivity.randValue) : '',
  );
  const [pointsPerUnit, setPointsPerUnit] = useState(existingProduct?.pointsPerUnit ?? true);
  const [active, setActive] = useState(existingProduct?.active ?? existingActivity?.active ?? true);
  const [saving, setSaving] = useState(false);

  const randValue = Number(randValueText);
  const randValueValid = randValueText.trim() !== '' && Number.isFinite(randValue) && randValue >= 0;
  const fcPreview = randValueValid ? Math.round(randValue * course.fbPerRand) : null;

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Missing info', 'A name is required.');
      return;
    }
    if (!randValueValid) {
      showAlert('Missing info', 'Enter a valid Rand value.');
      return;
    }
    const aliases = aliasesText
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      if (isProduct) {
        await saveCatalogProduct({
          id: itemId,
          name: name.trim(),
          brand: brand.trim(),
          category: category.trim(),
          aliases,
          randValue,
          pointsPerUnit,
          active,
        });
      } else {
        await saveCatalogActivity({
          id: itemId,
          name: name.trim(),
          category: category.trim(),
          aliases,
          randValue,
          active,
        });
      }
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert(`Couldn’t save ${isProduct ? 'product' : 'activity'}`, message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!itemId) return;
    showAlert(
      `Remove this ${isProduct ? 'product' : 'activity'}?`,
      'The receipt scanner will stop matching it. Points already awarded from past receipts are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              if (isProduct) await deleteCatalogProduct(itemId);
              else await deleteCatalogActivity(itemId);
              navigation.goBack();
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert(`Couldn’t remove ${isProduct ? 'product' : 'activity'}`, message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader
          title={itemId ? `Edit ${isProduct ? 'Product' : 'Activity'}` : `New ${isProduct ? 'Product' : 'Activity'}`}
          onBack={() => navigation.goBack()}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TextField
          placeholder={isProduct ? 'Name (e.g. Titleist Pro V1 Golf Balls)' : 'Name (e.g. 18 Hole Round)'}
          variant="onLight"
          value={name}
          onChangeText={setName}
        />
        <View style={{ height: spacing.md }} />
        {isProduct ? (
          <>
            <TextField placeholder="Brand (optional)" variant="onLight" value={brand} onChangeText={setBrand} />
            <View style={{ height: spacing.md }} />
          </>
        ) : null}
        <TextField placeholder="Category (optional)" variant="onLight" value={category} onChangeText={setCategory} />
        <View style={{ height: spacing.md }} />
        <TextField
          placeholder="Aliases, comma-separated (helps the scanner match OCR misreads)"
          variant="onLight"
          value={aliasesText}
          onChangeText={setAliasesText}
          multiline
        />
        <View style={{ height: spacing.md }} />
        <TextField
          placeholder={`Rand value (auto-prices at ${course.fbPerRand} FC per R1)`}
          variant="onLight"
          keyboardType="numeric"
          value={randValueText}
          onChangeText={setRandValueText}
        />
        {fcPreview !== null ? <Text style={styles.computedCost}>= {fcPreview.toLocaleString()} Flagrr Cash</Text> : null}

        {isProduct ? (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Points per unit</Text>
              <Text style={styles.switchHint}>
                On: multiplies by quantity (e.g. a dozen balls). Off: flat, regardless of quantity.
              </Text>
            </View>
            <Switch value={pointsPerUnit} onValueChange={setPointsPerUnit} trackColor={{ true: colors.clubGreen }} />
          </View>
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active — scanner can match it</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.clubGreen }} />
        </View>

        <View style={{ height: spacing.lg }} />
        <PillButton label={`Save ${isProduct ? 'Product' : 'Activity'}`} onPress={handleSave} loading={saving} />

        {itemId ? (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={saving}>
            <Text style={styles.deleteText}>Remove {isProduct ? 'Product' : 'Activity'}</Text>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  computedCost: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 6, marginLeft: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  switchLabel: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  switchHint: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  deleteButton: { alignItems: 'center', marginTop: spacing.lg },
  deleteText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
});
}
