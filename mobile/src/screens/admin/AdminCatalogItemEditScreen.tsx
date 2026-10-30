import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminButton, PageTitle, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, tabularNums } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminCatalogItemEdit'>;

export function AdminCatalogItemEditScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
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
  // Receipt-scanner earning is 1 Flagrr Cash per R1 of catalog price (the
  // member's loyalty tier is the only scaling on top — see pointsEngine.ts).
  // course.fbPerRand is a separate, unrelated setting used only to price
  // reward-redemption costs, not to earn Flagrr Cash from a purchase.
  const fcPreview = randValueValid ? Math.round(randValue) : null;

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
      `Deactivate this ${isProduct ? 'product' : 'activity'}?`,
      'The receipt scanner will stop matching it. Flagrr Cash already earned from past receipts is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
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

  const title = itemId ? `Edit ${isProduct ? 'Product' : 'Activity'}` : `New ${isProduct ? 'Product' : 'Activity'}`;

  const form = (
    <View style={styles.form}>
      <Tile style={styles.fields}>
        <TextField
          placeholder={isProduct ? 'Name (e.g. Titleist Pro V1 Golf Balls)' : 'Name (e.g. 18 Hole Round)'}
          variant="onLight"
          value={name}
          onChangeText={setName}
        />
        {isProduct ? <TextField placeholder="Brand (optional)" variant="onLight" value={brand} onChangeText={setBrand} /> : null}
        <TextField placeholder="Category (optional)" variant="onLight" value={category} onChangeText={setCategory} />
        <TextField
          placeholder="Aliases, comma-separated (helps the scanner match OCR misreads)"
          variant="onLight"
          value={aliasesText}
          onChangeText={setAliasesText}
          multiline
        />
        <View>
          <TextField
            placeholder="Rand value (earns 1 Flagrr Cash per R1, before tier bonus)"
            variant="onLight"
            keyboardType="numeric"
            value={randValueText}
            onChangeText={setRandValueText}
          />
          {fcPreview !== null ? (
            <Text style={[styles.computedCost, { color: c.ink2 }]}>= {fcPreview.toLocaleString()} Flagrr Cash</Text>
          ) : null}
        </View>
      </Tile>

      <Tile padded={false}>
        {isProduct ? (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: c.ink }]}>Points per unit</Text>
              <Text style={[styles.switchHint, { color: c.ink2 }]}>
                On: multiplies by quantity (e.g. a dozen balls). Off: flat, regardless of quantity.
              </Text>
            </View>
            <Switch value={pointsPerUnit} onValueChange={setPointsPerUnit} trackColor={{ true: c.accent }} />
          </View>
        ) : null}

        <View style={[styles.switchRow, isProduct && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }]}>
          <Text style={[styles.switchLabel, { color: c.ink, flex: 1 }]}>Active — scanner can match it</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: c.accent }} />
        </View>
      </Tile>

      <View style={styles.actions}>
        <PillButton label={`Save ${isProduct ? 'Product' : 'Activity'}`} onPress={handleSave} loading={saving} />

        {itemId ? (
          <AdminButton variant="danger" label="Deactivate" onPress={handleDelete} disabled={saving} size="lg" fullWidth />
        ) : null}
      </View>
    </View>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminCatalog" breadcrumb={title} showRail={false}>
        <PageTitle>{title}</PageTitle>
        {form}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={title} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {form}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 64 },
  form: { width: '100%', maxWidth: 560, gap: 14 },
  fields: { gap: 12 },
  computedCost: { ...adminFont.body, ...tabularNums, fontSize: 13, marginTop: 6, marginLeft: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switchLabel: { ...adminFont.body, fontSize: 15 },
  switchHint: { ...adminFont.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  actions: { gap: 12, marginTop: 6 },
});
