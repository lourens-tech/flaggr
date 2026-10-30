import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransitionNoTransform } from '../../hooks/useHover';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import {
  AdminButton,
  CircleButton,
  EmptyState,
  ErrorState,
  Muted,
  PageTitle,
  Segmented,
  SkeletonRows,
  StatusPill,
  Tile,
} from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { CatalogActivity, CatalogProduct } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminCatalog'>;
type Kind = 'product' | 'activity';

// What the receipt scanner matches item names against for this club, priced
// in Flagrr Cash from Rand value * the club's own conversion rate — same
// list/edit shape as Rewards, just backing the earning side instead of the
// spending side.
export function AdminCatalogScreen({ navigation }: Props) {
  const isDesktop = useIsDesktopNav();
  const {
    course,
    catalogProducts,
    catalogActivities,
    loadCatalogProducts,
    loadCatalogActivities,
    saveCatalogProduct,
    deleteCatalogProduct,
    hardDeleteCatalogProduct,
    saveCatalogActivity,
    deleteCatalogActivity,
    hardDeleteCatalogActivity,
  } = useAdmin();
  const [kind, setKind] = useState<Kind>('product');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Load failures used to be swallowed silently; surface them with a retry.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(false);
        try {
          await Promise.all([loadCatalogProducts(), loadCatalogActivities()]);
        } catch {
          if (!cancelled) setError(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]),
  );

  const retry = () => setReloadKey((k) => k + 1);

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

  // Decision 3: the everyday destructive action is a soft deactivate (the
  // same call the edit screen makes); permanent deletion stays separate.
  const handleDeactivateProduct = (item: CatalogProduct) => {
    showAlert(
      'Deactivate this product?',
      `"${item.name}" stops being matched by the receipt scanner. It's kept in history, so you can turn it back on from its edit screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await deleteCatalogProduct(item.id);
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

  const handleDeleteProduct = (item: CatalogProduct) => {
    showAlert('Permanently remove this product?', `"${item.name}" will be deleted for good — this can’t be undone. Flagrr Cash already earned from past receipts is kept.`, [
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

  const handleDeactivateActivity = (item: CatalogActivity) => {
    showAlert(
      'Deactivate this activity?',
      `"${item.name}" stops being matched by the receipt scanner. It's kept in history, so you can turn it back on from its edit screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await deleteCatalogActivity(item.id);
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

  const handleDeleteActivity = (item: CatalogActivity) => {
    showAlert('Permanently remove this activity?', `"${item.name}" will be deleted for good — this can’t be undone. Flagrr Cash already earned from past receipts is kept.`, [
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

  const renderProductRow = (item: CatalogProduct, index: number) => (
    <CatalogRow
      key={item.id}
      first={index === 0}
      desktop={isDesktop}
      name={item.name}
      subtitle={`R${item.randValue.toLocaleString()} ${item.pointsPerUnit ? 'per unit' : 'flat'} = ${fcFor(item.randValue).toLocaleString()} FC`}
      active={item.active}
      busy={busyId === item.id}
      onOpen={() => navigation.navigate('AdminCatalogItemEdit', { kind: 'product', itemId: item.id })}
      onDuplicate={() => handleDuplicateProduct(item)}
      onDeactivate={() => handleDeactivateProduct(item)}
      onDelete={() => handleDeleteProduct(item)}
    />
  );

  const renderActivityRow = (item: CatalogActivity, index: number) => (
    <CatalogRow
      key={item.id}
      first={index === 0}
      desktop={isDesktop}
      name={item.name}
      subtitle={`R${item.randValue.toLocaleString()} = ${fcFor(item.randValue).toLocaleString()} FC`}
      active={item.active}
      busy={busyId === item.id}
      onOpen={() => navigation.navigate('AdminCatalogItemEdit', { kind: 'activity', itemId: item.id })}
      onDuplicate={() => handleDuplicateActivity(item)}
      onDeactivate={() => handleDeactivateActivity(item)}
      onDelete={() => handleDeleteActivity(item)}
    />
  );

  const list = kind === 'product' ? products : activities;

  const toggle = (
    <Segmented<Kind>
      options={[
        { key: 'product', label: 'Products' },
        { key: 'activity', label: 'Activities' },
      ]}
      value={kind}
      onChange={setKind}
      accessibilityLabel="Catalogue type"
    />
  );

  const searchField = (
    <TextField
      placeholder={kind === 'product' ? 'Search products' : 'Search activities'}
      variant="onLight"
      icon="search"
      value={search}
      onChangeText={setSearch}
    />
  );

  const helpText =
    'The receipt scanner matches item names against this list to award Flagrr Cash — anything not listed here still earns Flagrr Cash from its printed Rand price.';

  const emptyText = query
    ? `No ${kind === 'product' ? 'products' : 'activities'} match "${search.trim()}".`
    : kind === 'product'
      ? 'No products yet — add your first one.'
      : 'No activities yet — add your first one.';

  const mobileEmptyText = query
    ? `No ${kind === 'product' ? 'products' : 'activities'} match "${search.trim()}".`
    : kind === 'product'
      ? 'No products yet — tap + to add your first one.'
      : 'No activities yet — tap + to add your first one.';

  const listRows = (empty: string) =>
    error ? (
      <ErrorState onRetry={retry} />
    ) : loading ? (
      <Tile>
        <SkeletonRows rows={5} />
      </Tile>
    ) : list.length === 0 ? (
      <Tile>
        <EmptyState icon={query ? 'search-outline' : 'pricetag-outline'} title={empty} />
      </Tile>
    ) : (
      <Tile padded={false} style={styles.listTile}>
        {kind === 'product' ? products.map(renderProductRow) : activities.map(renderActivityRow)}
      </Tile>
    );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminCatalog" breadcrumb="Products and Activities">
        <View style={styles.dHeadRow}>
          <PageTitle>Products and Activities</PageTitle>
          <AdminButton
            variant="accent"
            icon="add"
            label={kind === 'product' ? 'Add Product' : 'Add Activity'}
            onPress={() => navigation.navigate('AdminCatalogItemEdit', { kind })}
          />
        </View>
        <Muted style={styles.dLede}>{helpText}</Muted>
        <View style={styles.dToolbar}>
          {toggle}
          <View style={styles.dSearch}>{searchField}</View>
        </View>
        {listRows(emptyText)}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Products and Activities"
        right={
          <CircleButton
            icon="add"
            size={44}
            onPress={() => navigation.navigate('AdminCatalogItemEdit', { kind })}
            accessibilityLabel={kind === 'product' ? 'Add Product' : 'Add Activity'}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {toggle}
        <Muted>{helpText}</Muted>
        {searchField}
        {listRows(mobileEmptyText)}
      </ScrollView>
    </View>
  );
}

function CatalogRow({
  name,
  subtitle,
  active,
  busy,
  first,
  desktop,
  onOpen,
  onDuplicate,
  onDeactivate,
  onDelete,
}: {
  name: string;
  subtitle: string;
  active: boolean;
  busy: boolean;
  first: boolean;
  desktop: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  const actionStyle = desktop ? undefined : styles.mAction;
  const actions = (
    <View style={[styles.rowActions, !desktop && styles.mRowActions]}>
      <AdminButton
        variant="glass"
        icon="copy-outline"
        label="Duplicate"
        onPress={onDuplicate}
        disabled={busy}
        accessibilityLabel={`Duplicate ${name}`}
        style={actionStyle}
      />
      {active ? (
        <AdminButton
          variant="danger"
          icon="eye-off-outline"
          label="Deactivate"
          onPress={onDeactivate}
          disabled={busy}
          accessibilityLabel={`Deactivate ${name}`}
          style={actionStyle}
        />
      ) : null}
      <Pressable
        onPress={onDelete}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Permanently delete ${name}`}
        accessibilityState={{ disabled: busy }}
        style={({ pressed }) => [styles.deleteAction, actionStyle, (pressed || busy) && { opacity: busy ? 0.45 : 0.7 }]}
      >
        <Ionicons name="trash-outline" size={16} color={c.neg} />
        <Text style={[styles.deleteActionText, { color: c.neg }]}>Delete permanently…</Text>
      </Pressable>
    </View>
  );
  return (
    <Pressable
      accessible={false}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[
        styles.row,
        desktop && styles.dRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
        desktop && hoverTransitionNoTransform,
        desktop && hovered && { backgroundColor: c.fill2 },
      ]}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${name}`}
        style={({ pressed }) => [styles.rowContent, pressed && { opacity: 0.7 }]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowTitleLine}>
            <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{name}</Text>
            {!active ? <StatusPill label="Inactive" tone="neutral" /> : null}
          </View>
          <Text style={[styles.rowSubtitle, { color: c.ink2 }]} numberOfLines={1}>{subtitle}</Text>
        </View>
        {desktop ? null : <Ionicons name="chevron-forward" size={16} color={c.ink3} />}
      </Pressable>
      {actions}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48, gap: 14 },
  listTile: { overflow: 'hidden' },
  row: { paddingHorizontal: 16 },
  dRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, paddingLeft: 18, paddingRight: 12 },
  rowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 10 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { ...adminFont.bodyBold, fontSize: 15, flexShrink: 1 },
  rowSubtitle: { ...adminFont.body, ...tabularNums, fontSize: 13, marginTop: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mRowActions: { paddingBottom: 12 },
  mAction: { height: 44 },
  deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 8, borderRadius: adminRadius.pill },
  deleteActionText: { ...adminFont.bodySemiBold, fontSize: 14.5 },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  dLede: { maxWidth: 720, marginTop: 6 },
  dToolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16, marginBottom: 14 },
  dSearch: { flex: 1, minWidth: 220, maxWidth: 360 },
});
