import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { CatalogActivity, CatalogProduct } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCatalogItemEdit'>;

// Same form as AdminCatalogItemEditScreen (the course_admin's own screen),
// rewired for an explicit courseId so a super_admin can add/edit a product
// or activity on any club's behalf.
export function SuperAdminCatalogItemEditScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const fcPreview = randValueValid ? Math.round(randValue * fbPerRand) : null;

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
      `Remove this ${isProduct ? 'product' : 'activity'}?`,
      `The receipt scanner will stop matching it for ${courseName}. Points already awarded from past receipts are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
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
            placeholder={`Rand value (auto-prices at ${fbPerRand} FC per R1)`}
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
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={pageTitle} showRail={false}>
        <Text style={styles.dPageTitle}>{pageTitle}</Text>
        <DesktopPanel title=" " style={{ maxWidth: 520 }}>
          {loading ? <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.md }} /> : form}
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={pageTitle} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {form}
        </ScrollView>
      )}
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
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
