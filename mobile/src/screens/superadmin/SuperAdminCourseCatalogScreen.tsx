import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { CatalogActivity, CatalogProduct } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseCatalog'>;
type Kind = 'product' | 'activity';

// Same list shape as AdminCatalogScreen (the course_admin's own screen),
// rewired for an explicit courseId so a super_admin can view/manage any
// club's product/activity catalog on their behalf.
export function SuperAdminCourseCatalogScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName, fbPerRand } = route.params;
  const {
    getSuperAdminCatalogProducts,
    getSuperAdminCatalogActivities,
    saveSuperAdminCatalogProduct,
    hardDeleteSuperAdminCatalogProduct,
    saveSuperAdminCatalogActivity,
    hardDeleteSuperAdminCatalogActivity,
  } = useAdmin();
  const [kind, setKind] = useState<Kind>('product');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [activities, setActivities] = useState<CatalogActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([getSuperAdminCatalogProducts(courseId), getSuperAdminCatalogActivities(courseId)]);
      setProducts(p);
      setActivities(a);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load catalog', message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

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
    }, [courseId]),
  );

  // Receipt-scanner earning is 1 Flagrr Cash per R1 of catalog price (the
  // member's loyalty tier is the only scaling on top — see pointsEngine.ts).
  // fbPerRand is a separate, unrelated setting used only to price
  // reward-redemption costs, not to earn Flagrr Cash from a purchase.
  const fcFor = (randValue: number) => Math.round(randValue);

  const handleDuplicateProduct = async (item: CatalogProduct) => {
    setBusyId(item.id);
    try {
      await saveSuperAdminCatalogProduct({
        courseId,
        name: `${item.name} (Copy)`,
        brand: item.brand,
        category: item.category,
        aliases: item.aliases,
        randValue: item.randValue,
        pointsPerUnit: item.pointsPerUnit,
        active: item.active,
      });
      await load();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t duplicate product', message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteProduct = (item: CatalogProduct) => {
    showAlert('Permanently remove this product?', `"${item.name}" will be deleted for good — this can’t be undone. Points already awarded from past receipts are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Permanently',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await hardDeleteSuperAdminCatalogProduct(courseId, item.id);
            await load();
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove product', message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleDuplicateActivity = async (item: CatalogActivity) => {
    setBusyId(item.id);
    try {
      await saveSuperAdminCatalogActivity({
        courseId,
        name: `${item.name} (Copy)`,
        category: item.category,
        aliases: item.aliases,
        randValue: item.randValue,
        active: item.active,
      });
      await load();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t duplicate activity', message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteActivity = (item: CatalogActivity) => {
    showAlert('Permanently remove this activity?', `"${item.name}" will be deleted for good — this can’t be undone. Points already awarded from past receipts are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Permanently',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await hardDeleteSuperAdminCatalogActivity(courseId, item.id);
            await load();
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove activity', message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const renderProductRow = (item: CatalogProduct) => (
    <View key={item.id} style={styles.row}>
      <TouchableOpacity
        style={styles.rowContent}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('SuperAdminCatalogItemEdit', { courseId, courseName, fbPerRand, kind: 'product', itemId: item.id })
        }
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            R{item.randValue.toLocaleString()} {item.pointsPerUnit ? 'per unit' : 'flat'} = {fcFor(item.randValue).toLocaleString()} FC
          </Text>
        </View>
        {!item.active ? (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.rowActions}>
        <TouchableOpacity
          onPress={() => handleDuplicateProduct(item)}
          style={styles.rowActionBtn}
          hitSlop={8}
          disabled={busyId === item.id}
          accessibilityLabel={`Duplicate ${item.name}`}
        >
          <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.rowActionText}>Duplicate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteProduct(item)}
          style={styles.rowActionBtn}
          hitSlop={8}
          disabled={busyId === item.id}
          accessibilityLabel={`Permanently delete ${item.name}`}
        >
          <Ionicons name="trash-outline" size={16} color={colors.negative} />
          <Text style={[styles.rowActionText, { color: colors.negative }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActivityRow = (item: CatalogActivity) => (
    <View key={item.id} style={styles.row}>
      <TouchableOpacity
        style={styles.rowContent}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('SuperAdminCatalogItemEdit', { courseId, courseName, fbPerRand, kind: 'activity', itemId: item.id })
        }
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            R{item.randValue.toLocaleString()} = {fcFor(item.randValue).toLocaleString()} FC
          </Text>
        </View>
        {!item.active ? (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.rowActions}>
        <TouchableOpacity
          onPress={() => handleDuplicateActivity(item)}
          style={styles.rowActionBtn}
          hitSlop={8}
          disabled={busyId === item.id}
          accessibilityLabel={`Duplicate ${item.name}`}
        >
          <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.rowActionText}>Duplicate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteActivity(item)}
          style={styles.rowActionBtn}
          hitSlop={8}
          disabled={busyId === item.id}
          accessibilityLabel={`Permanently delete ${item.name}`}
        >
          <Ionicons name="trash-outline" size={16} color={colors.negative} />
          <Text style={[styles.rowActionText, { color: colors.negative }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const list = kind === 'product' ? products : activities;

  const toggle = (
    <View style={styles.toggle}>
      <TouchableOpacity style={[styles.togglePill, kind === 'product' && styles.togglePillActive]} onPress={() => setKind('product')}>
        <Text style={[styles.toggleText, kind === 'product' && styles.toggleTextActive]}>Products</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.togglePill, kind === 'activity' && styles.togglePillActive]} onPress={() => setKind('activity')}>
        <Text style={[styles.toggleText, kind === 'activity' && styles.toggleTextActive]}>Activities</Text>
      </TouchableOpacity>
    </View>
  );

  const listRows =
    loading ? (
      <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.md }} />
    ) : list.length === 0 ? (
      <Text style={styles.emptyText}>
        {kind === 'product' ? 'No products yet — add the first one.' : 'No activities yet — add the first one.'}
      </Text>
    ) : (
      <View style={{ gap: spacing.sm }}>{kind === 'product' ? products.map(renderProductRow) : activities.map(renderActivityRow)}</View>
    );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`${courseName} Catalog`}>
        <View style={styles.dHeadRow}>
          <Text style={styles.dPageTitle}>{courseName} — Products and Activities</Text>
          <TouchableOpacity
            style={styles.dAddButton}
            onPress={() => navigation.navigate('SuperAdminCatalogItemEdit', { courseId, courseName, fbPerRand, kind })}
          >
            <Ionicons name="add" size={16} color={colors.darkGreen} />
            <Text style={styles.dAddButtonText}>{kind === 'product' ? 'Add Product' : 'Add Activity'}</Text>
          </TouchableOpacity>
        </View>
        <DesktopPanel title=" ">
          {toggle}
          <View style={{ marginTop: spacing.sm }}>{listRows}</View>
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={courseName} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.toolbar}>
        {toggle}
        <TouchableOpacity
          onPress={() => navigation.navigate('SuperAdminCatalogItemEdit', { courseId, courseName, fbPerRand, kind })}
          hitSlop={8}
          accessibilityLabel={kind === 'product' ? 'Add Product' : 'Add Activity'}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle" size={30} color={colors.clubGreen} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : list.length === 0 ? (
        <Text style={styles.emptyText}>
          {kind === 'product' ? 'No products yet — tap + to add the first one.' : 'No activities yet — tap + to add the first one.'}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {kind === 'product' ? products.map(renderProductRow) : activities.map(renderActivityRow)}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
  },
  toggle: { flexDirection: 'row', backgroundColor: colors.mintBg, borderRadius: radius.pill, padding: 3 },
  togglePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
  togglePillActive: { backgroundColor: colors.darkGreen },
  toggleText: { fontFamily: fontFamily.heading, fontSize: 13, color: colors.textPrimary },
  toggleTextActive: { color: colors.white },
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: spacing.sm,
  },
  rowActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  rowActionText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textSecondary },
  rowTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  rowSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  inactiveBadge: { backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  inactiveBadgeText: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
  dAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dAddButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.darkGreen },
});
}
