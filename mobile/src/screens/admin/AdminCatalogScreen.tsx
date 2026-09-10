import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { hoverTransition } from '../../hooks/useHover';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { CatalogActivity, CatalogProduct } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminCatalog'>;
type Kind = 'product' | 'activity';

// react-native-web passes unknown style keys straight through to the DOM —
// this suppresses the browser's default focus ring on the search input,
// which isn't part of RN's typed style props (see DesktopShell's search box).
const webNoOutline = { outlineStyle: 'none' } as unknown as { outlineWidth: number };

// What the receipt scanner matches item names against for this club, priced
// in Flagrr Cash from Rand value * the club's own conversion rate — same
// list/edit shape as Rewards, just backing the earning side instead of the
// spending side.
export function AdminCatalogScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const {
    course,
    catalogProducts,
    catalogActivities,
    loadCatalogProducts,
    loadCatalogActivities,
    saveCatalogProduct,
    hardDeleteCatalogProduct,
    saveCatalogActivity,
    hardDeleteCatalogActivity,
  } = useAdmin();
  const [kind, setKind] = useState<Kind>('product');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await Promise.all([loadCatalogProducts(), loadCatalogActivities()]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const query = search.trim().toLowerCase();
  const products = useMemo(
    () =>
      query
        ? catalogProducts.filter(
            (p) =>
              p.name.toLowerCase().includes(query) ||
              p.brand.toLowerCase().includes(query) ||
              p.category.toLowerCase().includes(query) ||
              p.aliases.some((a) => a.toLowerCase().includes(query)),
          )
        : catalogProducts,
    [catalogProducts, query],
  );
  const activities = useMemo(
    () =>
      query
        ? catalogActivities.filter(
            (a) =>
              a.name.toLowerCase().includes(query) ||
              a.category.toLowerCase().includes(query) ||
              a.aliases.some((al) => al.toLowerCase().includes(query)),
          )
        : catalogActivities,
    [catalogActivities, query],
  );

  // Receipt-scanner earning is 1 Flagrr Cash per R1 of catalog price (the
  // member's loyalty tier is the only scaling on top — see pointsEngine.ts).
  // course.fbPerRand is a separate, unrelated setting used only to price
  // reward-redemption costs, not to earn Flagrr Cash from a purchase.
  const fcFor = (randValue: number) => Math.round(randValue);

  const handleDuplicateProduct = async (item: CatalogProduct) => {
    setBusyId(item.id);
    try {
      await saveCatalogProduct({
        name: `${item.name} (Copy)`,
        brand: item.brand,
        category: item.category,
        aliases: item.aliases,
        randValue: item.randValue,
        pointsPerUnit: item.pointsPerUnit,
        active: item.active,
      });
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
            await hardDeleteCatalogProduct(item.id);
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
      await saveCatalogActivity({
        name: `${item.name} (Copy)`,
        category: item.category,
        aliases: item.aliases,
        randValue: item.randValue,
        active: item.active,
      });
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
            await hardDeleteCatalogActivity(item.id);
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
        onPress={() => navigation.navigate('AdminCatalogItemEdit', { kind: 'product', itemId: item.id })}
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
        onPress={() => navigation.navigate('AdminCatalogItemEdit', { kind: 'activity', itemId: item.id })}
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

  const emptyText = query
    ? `No ${kind === 'product' ? 'products' : 'activities'} match "${search.trim()}".`
    : kind === 'product'
      ? 'No products yet — add your first one.'
      : 'No activities yet — add your first one.';

  const listRows =
    loading ? (
      <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.md }} />
    ) : list.length === 0 ? (
      <Text style={styles.emptyText}>{emptyText}</Text>
    ) : (
      <View style={{ gap: spacing.sm }}>{kind === 'product' ? products.map(renderProductRow) : activities.map(renderActivityRow)}</View>
    );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminCatalog" breadcrumb="Products and Activities">
        <View style={styles.dHeadRow}>
          <Text style={styles.dPageTitle}>Products and Activities</Text>
          <TouchableOpacity style={styles.dAddButton} onPress={() => navigation.navigate('AdminCatalogItemEdit', { kind })}>
            <Ionicons name="add" size={16} color={colors.darkGreen} />
            <Text style={styles.dAddButtonText}>{kind === 'product' ? 'Add Product' : 'Add Activity'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          The receipt scanner matches item names against this list to award Flagrr Cash — anything not listed here
          still earns Flagrr Cash from its printed Rand price.
        </Text>
        <View style={styles.dToolbar}>
          <View style={[styles.dSearchBox, hoverTransition, searchFocused && styles.dSearchBoxFocused]}>
            <Ionicons name="search" size={15} color={searchFocused ? colors.clubGreen : colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={kind === 'product' ? 'Search products' : 'Search activities'}
              placeholderTextColor={colors.textMuted}
              style={[styles.dSearchInput, webNoOutline]}
            />
          </View>
          {toggle}
        </View>
        <DesktopPanel title=" ">
          <View>{listRows}</View>
        </DesktopPanel>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Products and Activities" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.toolbar}>
        {toggle}
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminCatalogItemEdit', { kind })}
          hitSlop={8}
          accessibilityLabel={kind === 'product' ? 'Add Product' : 'Add Activity'}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle" size={30} color={colors.clubGreen} />
        </TouchableOpacity>
      </View>

      <Text style={styles.helpText}>
        The receipt scanner matches item names against this list to award Flagrr Cash — anything not listed here
        still earns Flagrr Cash from its printed Rand price.
      </Text>

      <View style={styles.searchArea}>
        <TextField
          placeholder={kind === 'product' ? 'Search products' : 'Search activities'}
          variant="onLight"
          icon="search"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : list.length === 0 ? (
        <Text style={styles.emptyText}>
          {query
            ? `No ${kind === 'product' ? 'products' : 'activities'} match "${search.trim()}".`
            : kind === 'product'
              ? 'No products yet — tap + to add your first one.'
              : 'No activities yet — tap + to add your first one.'}
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
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    paddingHorizontal: screenPadding,
    marginTop: spacing.sm,
  },
  searchArea: { paddingHorizontal: screenPadding, marginTop: spacing.md },
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
  dToolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.md },
  dSearchBox: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dSearchBoxFocused: { borderColor: colors.clubGreen, backgroundColor: colors.surface },
  dSearchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, color: colors.textPrimary, padding: 0 },
});
}
