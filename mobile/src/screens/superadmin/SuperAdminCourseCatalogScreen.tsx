import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopDataTable, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { AdminButton, CircleButton, EmptyState, ErrorState, Muted, PageTitle, Segmented, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { CatalogActivity, CatalogProduct } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseCatalog'>;
type Kind = 'product' | 'activity';

type CatalogItem = CatalogProduct | CatalogActivity;

function clubInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Compact text action for a row (Duplicate / Deactivate / Delete permanently).
function RowAction({
  icon,
  label,
  onPress,
  disabled,
  danger,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityLabel: string;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  const fg = danger ? c.neg : c.ink2;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: 10, borderRadius: adminRadius.pill },
        hoverTransition,
        hovered && !disabled && { backgroundColor: danger ? c.negBg : c.fill },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Ionicons name={icon} size={15} color={fg} />
      <Text style={{ ...adminFont.bodySemiBold, fontSize: 13, color: fg }}>{label}</Text>
    </Pressable>
  );
}

// Same list shape as AdminCatalogScreen (the course_admin's own screen),
// rewired for an explicit courseId so a super_admin can view/manage any
// club's product/activity catalog on their behalf.
export function SuperAdminCourseCatalogScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName, fbPerRand } = route.params;
  const {
    getSuperAdminCatalogProducts,
    getSuperAdminCatalogActivities,
    saveSuperAdminCatalogProduct,
    deleteSuperAdminCatalogProduct,
    hardDeleteSuperAdminCatalogProduct,
    saveSuperAdminCatalogActivity,
    deleteSuperAdminCatalogActivity,
    hardDeleteSuperAdminCatalogActivity,
  } = useAdmin();
  const [kind, setKind] = useState<Kind>('product');
  const [allProducts, setProducts] = useState<CatalogProduct[]>([]);
  const [allActivities, setActivities] = useState<CatalogActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, a] = await Promise.all([getSuperAdminCatalogProducts(courseId), getSuperAdminCatalogActivities(courseId)]);
      setProducts(p);
      setActivities(a);
    } catch (err) {
      setLoadError(true);
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

  const query = search.trim().toLowerCase();
  const products = useMemo(
    () =>
      query
        ? allProducts.filter(
            (p) =>
              p.name.toLowerCase().includes(query) ||
              p.brand.toLowerCase().includes(query) ||
              p.category.toLowerCase().includes(query) ||
              p.aliases.some((a) => a.toLowerCase().includes(query)),
          )
        : allProducts,
    [allProducts, query],
  );
  const activities = useMemo(
    () =>
      query
        ? allActivities.filter(
            (a) =>
              a.name.toLowerCase().includes(query) ||
              a.category.toLowerCase().includes(query) ||
              a.aliases.some((al) => al.toLowerCase().includes(query)),
          )
        : allActivities,
    [allActivities, query],
  );

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

  // Deactivate = the soft delete: the scanner stops matching the item, it
  // stays in the list as Inactive and can be switched back on from its edit
  // page. "Delete permanently" (below) is the separate hard delete.
  const handleDeactivateProduct = (item: CatalogProduct) => {
    showAlert(
      'Deactivate this product?',
      `The receipt scanner will stop matching "${item.name}" for ${courseName}. Flagrr Cash already earned from past receipts is kept, and you can switch it back on from its edit page.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await deleteSuperAdminCatalogProduct(courseId, item.id);
              await load();
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t deactivate product', message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleDeactivateActivity = (item: CatalogActivity) => {
    showAlert(
      'Deactivate this activity?',
      `The receipt scanner will stop matching "${item.name}" for ${courseName}. Flagrr Cash already earned from past receipts is kept, and you can switch it back on from its edit page.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await deleteSuperAdminCatalogActivity(courseId, item.id);
              await load();
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t deactivate activity', message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleDeleteProduct = (item: CatalogProduct) => {
    showAlert('Permanently remove this product?', `"${item.name}" will be deleted for good — this can’t be undone. Flagrr Cash already earned from past receipts is kept.`, [
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
    showAlert('Permanently remove this activity?', `"${item.name}" will be deleted for good — this can’t be undone. Flagrr Cash already earned from past receipts is kept.`, [
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

  const isProductKind = kind === 'product';
  const list: CatalogItem[] = isProductKind ? products : activities;

  const openItem = (item: CatalogItem) =>
    navigation.navigate('SuperAdminCatalogItemEdit', { courseId, courseName, fbPerRand, kind, itemId: item.id });

  const earnsLabel = (item: CatalogItem) =>
    isProductKind
      ? `R${item.randValue.toLocaleString()} ${(item as CatalogProduct).pointsPerUnit ? 'per unit' : 'flat'} = ${fcFor(item.randValue).toLocaleString()} FC`
      : `R${item.randValue.toLocaleString()} = ${fcFor(item.randValue).toLocaleString()} FC`;

  const duplicate = (item: CatalogItem) =>
    isProductKind ? handleDuplicateProduct(item as CatalogProduct) : handleDuplicateActivity(item as CatalogActivity);
  const deactivate = (item: CatalogItem) =>
    isProductKind ? handleDeactivateProduct(item as CatalogProduct) : handleDeactivateActivity(item as CatalogActivity);
  const deletePermanently = (item: CatalogItem) =>
    isProductKind ? handleDeleteProduct(item as CatalogProduct) : handleDeleteActivity(item as CatalogActivity);

  // Duplicate, then Deactivate (the main destructive action, only while the
  // item is active), then the permanent delete.
  const rowActions = (item: CatalogItem) => (
    <View style={styles.rowActions}>
      <RowAction
        icon="copy-outline"
        label="Duplicate"
        onPress={() => duplicate(item)}
        disabled={busyId === item.id}
        accessibilityLabel={`Duplicate ${item.name}`}
      />
      {item.active ? (
        <RowAction
          icon="pause-circle-outline"
          label="Deactivate…"
          danger
          onPress={() => deactivate(item)}
          disabled={busyId === item.id}
          accessibilityLabel={`Deactivate ${item.name}`}
        />
      ) : null}
      <RowAction
        icon="trash-outline"
        label="Delete permanently…"
        danger
        onPress={() => deletePermanently(item)}
        disabled={busyId === item.id}
        accessibilityLabel={`Permanently delete ${item.name}`}
      />
    </View>
  );

  const toggle = (
    <Segmented
      accessibilityLabel="Catalogue type"
      options={[
        { key: 'product' as Kind, label: 'Products' },
        { key: 'activity' as Kind, label: 'Activities' },
      ]}
      value={kind}
      onChange={setKind}
    />
  );

  const searchField = (
    <TextField
      placeholder={isProductKind ? 'Search products' : 'Search activities'}
      variant="onLight"
      icon="search"
      value={search}
      onChangeText={setSearch}
    />
  );

  const emptyText = (desktop: boolean) =>
    query
      ? `No ${isProductKind ? 'products' : 'activities'} match "${search.trim()}".`
      : isProductKind
        ? desktop
          ? 'No products yet — add the first one.'
          : 'No products yet — tap + to add the first one.'
        : desktop
          ? 'No activities yet — add the first one.'
          : 'No activities yet — tap + to add the first one.';

  const stateBlock = (desktop: boolean) =>
    loadError ? (
      <ErrorState onRetry={load} />
    ) : loading ? (
      <Tile>
        <SkeletonRows rows={4} />
      </Tile>
    ) : list.length === 0 ? (
      <Tile padded={false}>
        <EmptyState icon={query ? 'search-outline' : 'pricetags-outline'} title={emptyText(desktop)} />
      </Tile>
    ) : null;

  if (isDesktop) {
    const columns: DesktopTableColumn<CatalogItem>[] = [
      {
        key: 'name',
        label: isProductKind ? 'Product' : 'Activity',
        width: 280,
        sortValue: (row) => row.name.toLowerCase(),
        render: (row) => (
          <Pressable onPress={() => openItem(row)} accessibilityRole="link" accessibilityLabel={`Edit ${row.name}`}>
            <Text style={styles.rowTitle} numberOfLines={1}>{row.name}</Text>
            {isProductKind && (row as CatalogProduct).brand ? (
              <Text style={styles.rowSubtitle} numberOfLines={1}>{(row as CatalogProduct).brand}</Text>
            ) : row.category ? (
              <Text style={styles.rowSubtitle} numberOfLines={1}>{row.category}</Text>
            ) : null}
          </Pressable>
        ),
      },
      {
        key: 'earns',
        label: 'Earns',
        width: 220,
        sortValue: (row) => row.randValue,
        render: (row) => <Text style={styles.earns} numberOfLines={1}>{earnsLabel(row)}</Text>,
      },
      {
        key: 'status',
        label: 'Status',
        width: 110,
        sortValue: (row) => (row.active ? 0 : 1),
        render: (row) => <StatusPill label={row.active ? 'Active' : 'Inactive'} tone={row.active ? 'pos' : 'neutral'} />,
      },
      {
        key: 'actions',
        label: '',
        width: 400,
        align: 'right',
        render: (row) => rowActions(row),
      },
    ];

    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`Courses › ${courseName} › Products and Activities`}>
        <View style={styles.dHeadRow}>
          <View style={styles.crest}>
            <Text style={styles.crestText}>{clubInitials(courseName)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PageTitle>{courseName}</PageTitle>
            <Muted style={styles.dSection}>Products and Activities</Muted>
          </View>
          <AdminButton
            label={isProductKind ? 'Add Product' : 'Add Activity'}
            icon="add"
            variant="accent"
            onPress={() => navigation.navigate('SuperAdminCatalogItemEdit', { courseId, courseName, fbPerRand, kind })}
          />
        </View>
        <View style={styles.dToolbar}>
          {toggle}
          <View style={styles.dSearchWrap}>{searchField}</View>
        </View>
        {stateBlock(true) ?? (
          <Tile padded={false} style={styles.dTableTile}>
            <DesktopDataTable columns={columns} rows={list} keyExtractor={(row) => row.id} />
          </Tile>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Products and Activities"
        subtitle={courseName}
        right={
          <CircleButton
            icon="add"
            size={44}
            onPress={() => navigation.navigate('SuperAdminCatalogItemEdit', { courseId, courseName, fbPerRand, kind })}
            accessibilityLabel={isProductKind ? 'Add Product' : 'Add Activity'}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {toggle}
        {searchField}
        {stateBlock(false) ?? (
          <Tile padded={false} style={styles.mList}>
            {list.map((item, i) => (
              <View key={item.id} style={i > 0 && styles.mRowRule}>
                <Pressable
                  onPress={() => openItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  style={({ pressed }) => [styles.mRow, pressed && { backgroundColor: c.fill2 }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>{earnsLabel(item)}</Text>
                  </View>
                  {!item.active ? <StatusPill label="Inactive" tone="neutral" style={styles.flex0} /> : null}
                  <Ionicons name="chevron-forward" size={16} color={c.ink3} />
                </Pressable>
                <View style={styles.mActions}>{rowActions(item)}</View>
              </View>
            ))}
          </Tile>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 },
  rowActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 4 },
  rowTitle: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  rowSubtitle: { ...adminFont.body, ...tabularNums, fontSize: 13, color: c.ink2, marginTop: 2 },
  earns: { ...adminFont.body, ...tabularNums, fontSize: 14, color: c.ink2 },
  flex0: { flexShrink: 0 },
  mList: { overflow: 'hidden' },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  mRowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  mActions: { paddingHorizontal: 8, paddingBottom: 6 },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  crest: { width: 48, height: 48, borderRadius: adminRadius.sm, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  crestText: { ...adminFont.bodyBold, fontSize: 16, color: '#CDDE5C' },
  dSection: { marginTop: 2, fontSize: 15 },
  dToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 18, marginBottom: 12 },
  dSearchWrap: { width: 300 },
  dTableTile: { overflow: 'hidden', paddingVertical: 4 },
});
}
