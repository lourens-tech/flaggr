import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
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
  const { courseId, courseName, fbPerRand } = route.params;
  const { getSuperAdminCatalogProducts, getSuperAdminCatalogActivities } = useAdmin();
  const [kind, setKind] = useState<Kind>('product');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [activities, setActivities] = useState<CatalogActivity[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fcFor = (randValue: number) => Math.round(randValue * fbPerRand);

  const renderProductRow = (item: CatalogProduct) => (
    <TouchableOpacity
      key={item.id}
      style={styles.row}
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
  );

  const renderActivityRow = (item: CatalogActivity) => (
    <TouchableOpacity
      key={item.id}
      style={styles.row}
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
  );

  const list = kind === 'product' ? products : activities;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={courseName} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.toolbar}>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.togglePill, kind === 'product' && styles.togglePillActive]}
            onPress={() => setKind('product')}
          >
            <Text style={[styles.toggleText, kind === 'product' && styles.toggleTextActive]}>Products</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.togglePill, kind === 'activity' && styles.togglePillActive]}
            onPress={() => setKind('activity')}
          >
            <Text style={[styles.toggleText, kind === 'activity' && styles.toggleTextActive]}>Activities</Text>
          </TouchableOpacity>
        </View>
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
});
}
