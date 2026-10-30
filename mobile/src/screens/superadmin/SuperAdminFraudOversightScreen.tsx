import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { AdminButton, CircleButton, EmptyState, ErrorState, Muted, PageTitle, Segmented, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { DuplicateReceiptAttempt, FlaggedReceipt } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminFraudOversight'>;

type Tab = 'flagged' | 'duplicates';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  receipt_number: 'Same receipt number',
  image_hash: 'Same receipt image',
};

export function SuperAdminFraudOversightScreen(_props: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const {
    getSuperAdminFlaggedReceipts,
    confirmSuperAdminReceiptFraud,
    approveSuperAdminReceipt,
    getSuperAdminDuplicateAttempts,
    getSuperAdminReceiptImage,
  } = useAdmin();
  const [tab, setTab] = useState<Tab>('flagged');
  const [flagged, setFlagged] = useState<FlaggedReceipt[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateReceiptAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{ imageData: string | null } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<FlaggedReceipt | null>(null);
  const [reasonText, setReasonText] = useState('');
  // Set when loading the lists fails (it used to fail silently); cleared on retry.
  const [error, setError] = useState(false);
  // Desktop split view: which flagged receipt the detail pane shows.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true);
      setError(false);
      try {
        const [flaggedRows, duplicateRows] = await Promise.all([
          getSuperAdminFlaggedReceipts(),
          getSuperAdminDuplicateAttempts(),
        ]);
        if (!isCancelled()) {
          setFlagged(flaggedRows);
          setDuplicates(duplicateRows);
        }
      } catch {
        if (!isCancelled()) setError(true);
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const filteredFlagged = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return flagged;
    return flagged.filter(
      (f) => f.memberName.toLowerCase().includes(query) || f.memberEmail.toLowerCase().includes(query) || f.courseName.toLowerCase().includes(query),
    );
  }, [flagged, search]);

  const filteredDuplicates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return duplicates;
    return duplicates.filter(
      (d) =>
        d.memberName.toLowerCase().includes(query) ||
        d.memberEmail.toLowerCase().includes(query) ||
        d.attemptedCourseName.toLowerCase().includes(query) ||
        (d.originalCourseName ?? '').toLowerCase().includes(query),
    );
  }, [duplicates, search]);

  const handleViewPhoto = async (item: FlaggedReceipt) => {
    setPhotoLoadingId(item.id);
    try {
      const imageData = await getSuperAdminReceiptImage(item.id);
      setPhotoModal({ imageData });
    } catch {
      showAlert('Couldn’t load photo', 'Something went wrong. Please try again.');
    } finally {
      setPhotoLoadingId(null);
    }
  };

  const openReasonModal = (item: FlaggedReceipt) => {
    setReasonText('');
    setReasonModal(item);
  };

  const handleSubmitFraudReason = async () => {
    const item = reasonModal;
    const reason = reasonText.trim();
    if (!item || !reason) return;
    setReasonModal(null);
    setResolvingId(item.id);
    try {
      await confirmSuperAdminReceiptFraud(item.id, reason);
      setFlagged((prev) => prev.filter((f) => f.id !== item.id));
    } catch {
      showAlert('Couldn’t confirm fraud', 'Something went wrong. Please try again.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleApprove = (item: FlaggedReceipt) => {
    const message = item.pointsCredited
      ? `${item.memberName}'s Flagrr Cash for this receipt was already credited — approving just closes out the review.`
      : `This adds the ${item.pointsAwarded ?? 0} Flagrr Cash it earned to ${item.memberName}'s balance.`;
    showAlert('Approve this receipt?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setResolvingId(item.id);
          try {
            await approveSuperAdminReceipt(item.id);
            setFlagged((prev) => prev.filter((f) => f.id !== item.id));
          } catch {
            showAlert('Couldn’t approve receipt', 'Something went wrong. Please try again.');
          } finally {
            setResolvingId(null);
          }
        },
      },
    ]);
  };

  const flagBadges = (item: FlaggedReceipt) => (
    <View style={styles.badgeGroup}>
      {item.fraudConfirmedCount > 0 ? <StatusPill tone="neg" label={`Confirmed fraud ${item.fraudConfirmedCount}×`} /> : null}
      {item.memberFlagCount > 1 ? <StatusPill tone="amber" label={`Flagged ${item.memberFlagCount}×`} /> : null}
    </View>
  );

  const flaggedBodyText = (item: FlaggedReceipt) => (
    <>
      {item.merchantName || 'Unknown merchant'} — R{item.total.toFixed(2)}
      {item.pointsAwarded !== null ? ` · ${item.pointsAwarded} FC${item.pointsCredited ? '' : ' pending'}` : ''}
    </>
  );

  const flaggedActions = (item: FlaggedReceipt, primary: boolean) => (
    <View style={styles.actionRow}>
      <AdminButton
        label="View Photo"
        icon="image-outline"
        variant="glass"
        onPress={() => handleViewPhoto(item)}
        loading={photoLoadingId === item.id}
      />
      <View style={{ flex: 1 }} />
      {resolvingId === item.id ? (
        <ActivityIndicator color={c.neg} size="small" />
      ) : (
        <>
          <AdminButton label="Mark as Fraud" variant="danger" onPress={() => openReasonModal(item)} />
          <AdminButton label="Approve" variant={primary ? 'accent' : 'glass'} onPress={() => handleApprove(item)} />
        </>
      )}
    </View>
  );

  const renderFlagged = ({ item }: { item: FlaggedReceipt }) => (
    <Tile style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.memberName}</Text>
        {flagBadges(item)}
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>{item.memberEmail} · {item.courseName}</Text>
      <Text style={styles.cardBody} numberOfLines={1}>
        {flaggedBodyText(item)}
      </Text>
      {item.flagReason ? <Text style={styles.reasonText}>{item.flagReason}</Text> : null}
      <Text style={styles.cardTime}>{formatDate(item.submittedAt)}</Text>
      {flaggedActions(item, false)}
    </Tile>
  );

  const renderDuplicate = ({ item }: { item: DuplicateReceiptAttempt }) => (
    <Tile style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.memberName}</Text>
        {item.crossClub ? <StatusPill tone="neg" label="Cross-Club" /> : null}
        <Text style={styles.cardTime}>{formatDate(item.attemptedAt)}</Text>
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>{item.memberEmail}</Text>
      <Text style={styles.cardBody}>
        Tried at <Text style={styles.cardBodyStrong}>{item.attemptedCourseName}</Text>
        {item.originalCourseName ? (
          <>
            {' '}— already redeemed at <Text style={styles.cardBodyStrong}>{item.originalCourseName}</Text>
          </>
        ) : null}
      </Text>
      <Text style={styles.reasonText}>{MATCH_TYPE_LABELS[item.matchType] ?? item.matchType}</Text>
    </Tile>
  );

  const emptyText =
    tab === 'flagged'
      ? flagged.length === 0
        ? 'No flagged receipts yet.'
        : 'No flagged receipts match your search.'
      : duplicates.length === 0
        ? 'No duplicate attempts yet.'
        : 'No duplicate attempts match your search.';

  const tabOptions = [
    { key: 'flagged' as Tab, label: 'Flagged Receipts', count: flagged.length },
    { key: 'duplicates' as Tab, label: 'Duplicate Attempts', count: duplicates.length },
  ];
  const tabControl = <Segmented options={tabOptions} value={tab} onChange={setTab} accessibilityLabel="Fraud view" />;
  const searchField = (
    <TextField placeholder="Search by member or club" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
  );

  const emptyState = (
    <EmptyState
      icon={search.trim() && (tab === 'flagged' ? flagged.length > 0 : duplicates.length > 0) ? 'search-outline' : 'shield-checkmark-outline'}
      title={emptyText}
    />
  );
  const errorState = <ErrorState onRetry={() => load()} />;

  const modals = (
    <>
      <Modal visible={photoModal !== null} transparent animationType="fade" onRequestClose={() => setPhotoModal(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPhotoModal(null)} accessibilityRole="button" accessibilityLabel="Close">
          <Pressable style={styles.sheet} onPress={() => setPhotoModal(null)} accessibilityViewIsModal>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} accessibilityRole="header">Receipt Photo</Text>
              <CircleButton icon="close" size={36} onPress={() => setPhotoModal(null)} accessibilityLabel="Close" />
            </View>
            {photoModal?.imageData ? (
              <Image source={{ uri: photoModal.imageData }} style={styles.photoImage} resizeMode="contain" />
            ) : (
              <Muted style={styles.sheetEmpty}>No photo was saved for this receipt.</Muted>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={reasonModal !== null} transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} accessibilityRole="header">Mark as Fraud</Text>
              <CircleButton icon="close" size={36} onPress={() => setReasonModal(null)} accessibilityLabel="Close" />
            </View>
            <Text style={styles.reasonModalHint}>
              This rejects the receipt{reasonModal && !reasonModal.pointsCredited ? '' : " and reverses any Flagrr Cash it already awarded"}.
              {reasonModal?.memberName ? ` ${reasonModal.memberName}` : 'The member'} will be sent the reason below. This can't be undone.
            </Text>
            <TextInput
              placeholder="Explain why this receipt is fraudulent…"
              placeholderTextColor={c.ink3}
              value={reasonText}
              onChangeText={setReasonText}
              multiline
              style={styles.reasonInput}
              accessibilityLabel="Reason"
            />
            <View style={styles.reasonModalActions}>
              <AdminButton label="Cancel" variant="glass" onPress={() => setReasonModal(null)} />
              <AdminButton label="Mark as Fraud" variant="dangerSolid" onPress={handleSubmitFraudReason} disabled={!reasonText.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  if (isDesktop) {
    const selected = filteredFlagged.find((f) => f.id === selectedId) ?? filteredFlagged[0] ?? null;
    return (
      <>
        <SuperAdminDesktopFrame activeKey="SuperAdminFraudOversight" breadcrumb="Fraud Oversight" showRail={false}>
          <PageTitle>Fraud Oversight</PageTitle>
          <View style={styles.dToolbar}>
            {tabControl}
            <View style={{ flex: 1 }} />
            <View style={styles.dSearch}>{searchField}</View>
          </View>
          {loading ? (
            <Tile style={styles.dBlock}>
              <SkeletonRows rows={5} />
            </Tile>
          ) : error ? (
            <View style={styles.dBlock}>{errorState}</View>
          ) : tab === 'flagged' ? (
            filteredFlagged.length === 0 ? (
              <Tile style={styles.dBlock}>{emptyState}</Tile>
            ) : (
              <View style={styles.dCols}>
                <Tile style={styles.dListPane} padded={false}>
                  {filteredFlagged.map((item, i) => (
                    <FlaggedListRow
                      key={item.id}
                      item={item}
                      selected={selected?.id === item.id}
                      isFirst={i === 0}
                      onPress={() => setSelectedId(item.id)}
                      badges={flagBadges(item)}
                      styles={styles}
                    />
                  ))}
                </Tile>
                {selected ? (
                  <Tile style={styles.dDetailPane}>
                    <View style={styles.dDetailHead}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initialsOf(selected.memberName)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.dDetailName} numberOfLines={1}>{selected.memberName}</Text>
                        <Muted numberOfLines={1}>{selected.memberEmail} · {selected.courseName}</Muted>
                      </View>
                    </View>
                    {flagBadges(selected)}
                    {selected.flagReason ? (
                      <View style={styles.reasonBox}>
                        <Ionicons name="warning-outline" size={18} color={c.amber} />
                        <Text style={styles.reasonBoxText}>{selected.flagReason}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.dDetailBody}>{flaggedBodyText(selected)}</Text>
                    <Text style={styles.cardTime}>{formatDate(selected.submittedAt)}</Text>
                    {flaggedActions(selected, true)}
                  </Tile>
                ) : null}
              </View>
            )
          ) : filteredDuplicates.length === 0 ? (
            <Tile style={styles.dBlock}>{emptyState}</Tile>
          ) : (
            <View style={[styles.dBlock, styles.dDupList]}>
              {filteredDuplicates.map((item) => (
                <React.Fragment key={item.id}>{renderDuplicate({ item })}</React.Fragment>
              ))}
            </View>
          )}
        </SuperAdminDesktopFrame>
        {modals}
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Fraud Oversight" />

      <View style={styles.searchArea}>
        {searchField}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          {tabControl}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : error ? (
        <View style={styles.listContent}>{errorState}</View>
      ) : tab === 'flagged' ? (
        <FlatList
          data={filteredFlagged}
          keyExtractor={(f) => f.id}
          renderItem={renderFlagged}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Tile>{emptyState}</Tile>}
        />
      ) : (
        <FlatList
          data={filteredDuplicates}
          keyExtractor={(d) => d.id}
          renderItem={renderDuplicate}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Tile>{emptyState}</Tile>}
        />
      )}

      {modals}
    </View>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''}`.toUpperCase() || '?';
}

// A row in the desktop split view's list pane.
function FlaggedListRow({
  item,
  selected,
  isFirst,
  onPress,
  badges,
  styles,
}: {
  item: FlaggedReceipt;
  selected: boolean;
  isFirst: boolean;
  onPress: () => void;
  badges: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.memberName}, ${item.courseName}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[styles.listRow, hoverTransition, !isFirst && styles.listRowDivider, hovered && styles.listRowHover, selected && styles.listRowSelected]}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.memberName}</Text>
        <Text style={styles.cardTime}>{formatDate(item.submittedAt)}</Text>
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>{item.courseName} · R{item.total.toFixed(2)}</Text>
      {item.fraudConfirmedCount > 0 || item.memberFlagCount > 1 ? <View style={{ marginTop: 6 }}>{badges}</View> : null}
    </Pressable>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  searchArea: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  listContent: { padding: 16, paddingBottom: 32, gap: 10 },
  card: { gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, minWidth: 0, ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  cardMeta: { ...adminFont.body, fontSize: 13, color: c.ink2 },
  cardBody: { ...adminFont.body, ...tabularNums, fontSize: 14, color: c.ink, marginTop: 2 },
  cardBodyStrong: { ...adminFont.bodySemiBold },
  reasonText: { ...adminFont.body, fontSize: 12.5, color: c.ink2, fontStyle: 'italic' },
  cardTime: { ...adminFont.body, fontSize: 12, color: c.ink3 },
  badgeGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 0 },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10, gap: 8 },
  backdrop: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: adminRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 },
  sheetTitle: { ...adminFont.bodyBold, fontSize: 19, color: c.ink, flex: 1 },
  sheetEmpty: { textAlign: 'center', paddingVertical: 24 },
  photoImage: { width: '100%', height: 420, borderRadius: adminRadius.sm },
  reasonModalHint: { ...adminFont.body, fontSize: 13.5, color: c.ink2, marginBottom: 14, lineHeight: 19 },
  reasonInput: {
    backgroundColor: c.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    borderRadius: adminRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 100,
    ...adminFont.body,
    fontSize: 15,
    color: c.ink,
    textAlignVertical: 'top',
  },
  reasonModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  dToolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  dSearch: { width: 300 },
  dBlock: { marginTop: 14 },
  dCols: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'flex-start' },
  dListPane: { width: 360, borderRadius: adminRadius.lg, overflow: 'hidden', paddingVertical: 6 },
  dDetailPane: { flex: 1, minWidth: 0, borderRadius: adminRadius.lg, padding: 22, gap: 10 },
  dDetailHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dDetailName: { ...adminFont.bodyBold, fontSize: 18, color: c.ink },
  dDetailBody: { ...adminFont.body, ...tabularNums, fontSize: 15, color: c.ink },
  dDupList: { gap: 10, maxWidth: 880 },
  // Fairway crest with lime initials: the avatar treatment the brand keeps.
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...adminFont.bodyBold, fontSize: 13.5, color: '#CDDE5C' },
  reasonBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: c.amberBg, borderRadius: adminRadius.sm, padding: 12 },
  reasonBoxText: { flex: 1, ...adminFont.body, fontSize: 14, lineHeight: 20, color: c.ink },
  listRow: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  listRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  listRowHover: { backgroundColor: c.fill2 },
  listRowSelected: { backgroundColor: c.sel },
});
}
