import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { spacing } from '../../theme';
import { useAdminTheme } from '../../context/ThemeContext';
import type { CatalogActivity, CatalogProduct } from '../../data/adminTypes';
import { adminFont, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCatalogItemEdit'>;

// Same form as AdminCatalogItemEditScreen (the course_admin's own screen),
// rewired for an explicit courseId so a super_admin can add/edit a product
// or activity on any club's behalf.
export function SuperAdminCatalogItemEditScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName, fbPerRand, kind, itemId } = route.params;
  const isProduct = kind === 'product';
  const {
    getSuperAdminCatalogProducts,
    getSuperAdminCatalogActivities,
    saveSuperAdminCatalogProduct,
    saveSuperAdminCatalogActivity,
    deleteSuperAdminCatalogProduct,
    deleteSuperAdminCatalogActivity,
  } = useAdmin();

  const [loading, setLoading] = useState(!!itemId);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [aliasesText, setAliasesText] = useState('');
  const [randValueText, setRandValueText] = useState('');
  const [pointsPerUnit, setPointsPerUnit] = useState(true);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      if (isProduct) {
        const items = await getSuperAdminCatalogProducts(courseId);
        const existing = items.find((p: CatalogProduct) => p.id === itemId);
        if (existing) {
          setName(existing.name);
          setBrand(existing.brand);
          setCategory(existing.category);
          setAliasesText(existing.aliases.join(', '));
          setRandValueText(String(existing.randValue));
          setPointsPerUnit(existing.pointsPerUnit);
          setActive(existing.active);
        }
      } else {
        const items = await getSuperAdminCatalogActivities(courseId);
        const existing = items.find((a: CatalogActivity) => a.id === itemId);
        if (existing) {
          setName(existing.name);
          setCategory(existing.category);
          setAliasesText(existing.aliases.join(', '));
          setRandValueText(String(existing.randValue));
          setActive(existing.active);
        }
      }
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load item', message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, itemId, isProduct]);

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
    }, [courseId, itemId]),
  );

  useEffect(() => {
    navigation.setOptions({
      title: itemId ? `Edit ${isProduct ? 'Product' : 'Activity'}` : `New ${isProduct ? 'Product' : 'Activity'}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const randValue = Number(randValueText);
  const randValueValid = randValueText.trim() !== '' && Number.isFinite(randValue) && randValue >= 0;
  // Receipt-scanner earning is 1 Flagrr Cash per R1 of catalog price (the
  // member's loyalty tier is the only scaling on top — see pointsEngine.ts).
  // fbPerRand is a separate, unrelated setting used only to price
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
        await saveSuperAdminCatalogProduct({
          courseId,
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
        await saveSuperAdminCatalogActivity({
          courseId,
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
      `The receipt scanner will stop matching it for ${courseName}. Flagrr Cash already earned from past receipts is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              if (isProduct) await deleteSuperAdminCatalogProduct(courseId, itemId);
              else await deleteSuperAdminCatalogActivity(courseId, itemId);
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

  const pageTitle = itemId ? `Edit ${isProduct ? 'Product' : 'Activity'}` : `New ${isProduct ? 'Product' : 'Activity'}`;

  const form = (
    <>
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
            placeholder="Rand value (earns 1 Flagrr Cash per R1, before tier bonus)"
            variant="onLight"
            keyboardType="numeric"
            value={randValueText}
            onChangeText={setRandValueText}
          />
          {fcPreview !== null ? <Text style={styles.computedCost}>= {fcPreview.toLocaleString()} Flagrr Cash</Text> : null}

          {isProduct ? (
            <View style={styles.switchRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.switchLabel}>Points per unit</Text>
                <Text style={styles.switchHint}>
                  On: multiplies by quantity (e.g. a dozen balls). Off: flat, regardless of quantity.
                </Text>
              </View>
              <Switch value={pointsPerUnit} onValueChange={setPointsPerUnit} trackColor={{ true: c.accent }} accessibilityLabel="Points per unit" />
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active — scanner can match it</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: c.accent }} accessibilityLabel="Active — scanner can match it" />
          </View>

          <View style={{ height: spacing.lg }} />
          <PillButton label={`Save ${isProduct ? 'Product' : 'Activity'}`} onPress={handleSave} loading={saving} />

          {itemId ? (
            <AdminButton
              label="Deactivate"
              variant="danger"
              onPress={handleDelete}
              disabled={saving}
              style={styles.deleteButton}
            />
          ) : null}
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`Courses › ${courseName} › Products and Activities`} showRail={false}>
        <PageTitle>{pageTitle}</PageTitle>
        <Tile style={styles.dCard}>{loading ? <SkeletonRows rows={4} /> : form}</Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={pageTitle} subtitle={courseName} />

      {loading ? (
        <View style={styles.content}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Tile>{form}</Tile>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: spacing.xl * 2 },
  computedCost: { ...adminFont.body, ...tabularNums, fontSize: 12.5, color: c.ink2, marginTop: 6, marginLeft: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 52,
    marginTop: spacing.md,
  },
  switchLabel: { flexShrink: 1, ...adminFont.body, fontSize: 15, color: c.ink },
  switchHint: { ...adminFont.body, fontSize: 12.5, lineHeight: 17, color: c.ink2, marginTop: 2 },
  deleteButton: { alignSelf: 'center', marginTop: spacing.md, height: 44 },
  dCard: { maxWidth: 560, marginTop: 16, padding: 24 },
});
}
