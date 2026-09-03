import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { CatalogActivity, CatalogProduct } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminCatalog'>;
type Kind = 'product' | 'activity';

// What the receipt scanner matches item names against for this club, priced
// in Flagrr Cash from Rand value * the club's own conversion rate — same
// list/edit shape as Rewards, just backing the earning side instead of the
// spending side.
export function AdminCatalogScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { course, catalogProducts, catalogActivities, loadCatalogProducts, loadCatalogActivities } = useAdmin();
  const [kind, setKind] = useState<Kind>('product');
  const [loading, setLoading] = useState(true);

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

  const products = catalogProducts;
  const activities = catalogActivities;

  const fcFor = (randValue: number) => Math.round(randValue * course.fbPerRand);

  const renderProductRow = (item: CatalogProduct) => (
    <TouchableOpacity
      key={item.id}
      style={styles.row}
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
  );

  const renderActivityRow = (item: CatalogActivity) => (
    <TouchableOpacity
      key={item.id}
      style={styles.row}
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
        {kind === 'product' ? 'No products yet — add your first one.' : 'No activities yet — add your first one.'}
      </Text>
    ) : (
      <View style={{ gap: spacing.sm }}>{kind === 'product' ? products.map(renderProductRow) : activities.map(renderActivityRow)}</View>
    );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminCatalog" breadcrumb="Products & Activities">
        <View style={styles.dHeadRow}>
          <Text style={styles.dPageTitle}>Products & Activities</Text>
          <TouchableOpacity style={styles.dAddButton} onPress={() => navigation.navigate('AdminCatalogItemEdit', { kind })}>
            <Ionicons name="add" size={16} color={colors.darkGreen} />
            <Text style={styles.dAddButtonText}>{kind === 'product' ? 'Add Product' : 'Add Activity'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          The receipt scanner matches item names against this list to award Flagrr Cash — anything not listed here
          still earns Flagrr Cash from its printed Rand price.
        </Text>
        <DesktopPanel title=" ">
          {toggle}
          <View style={{ marginTop: spacing.sm }}>{listRows}</View>
        </DesktopPanel>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Products & Activities" onBack={() => navigation.goBack()} />
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

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : list.length === 0 ? (
        <Text style={styles.emptyText}>
          {kind === 'product' ? 'No products yet — tap + to add your first one.' : 'No activities yet — tap + to add your first one.'}
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
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
  },
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
