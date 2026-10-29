import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransitionNoTransform } from '../../hooks/useHover';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminButton, CircleButton, EmptyState, ErrorState, Muted, PageTitle, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { FlaggedReceipt } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminFraudOversight'>;

// react-native-web passes unknown style keys straight through to the DOM —
// this suppresses the browser's default focus ring on the reason input.
const webNoOutline = { outlineStyle: 'none' } as unknown as { outlineWidth: number };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// "Merchant — R0.00 · 120 FC pending", the one-line receipt summary.
function summaryLine(item: FlaggedReceipt): string {
  return `${item.merchantName || 'Unknown merchant'} — R${item.total.toFixed(2)}${
    item.pointsAwarded !== null ? ` · ${item.pointsAwarded} FC${item.pointsCredited ? '' : ' pending'}` : ''
  }`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${(parts[0] ?? '').charAt(0)}${(parts[1] ?? '').charAt(0)}`.toUpperCase() || '?';
}

export function AdminFraudOversightScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { getFlaggedReceipts, confirmReceiptFraud, approveReceipt, getReceiptImage } = useAdmin();
  const [flagged, setFlagged] = useState<FlaggedReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  // Load failures used to be swallowed silently; surface them with a retry.
  const [error, setError] = useState(false);
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  // `id` ties a loaded photo to its receipt so the desktop detail pane only
  // shows it inline while that receipt is selected.
  const [photoModal, setPhotoModal] = useState<{ id: string; imageData: string | null } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<FlaggedReceipt | null>(null);
  const [reasonText, setReasonText] = useState('');
  // Desktop split view: which flagged receipt the detail pane shows.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(false);
    try {
      const rows = await getFlaggedReceipts();
      if (!isCancelled()) setFlagged(rows);
    } catch {
      if (!isCancelled()) setError(true);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const handleViewPhoto = async (item: FlaggedReceipt) => {
    setPhotoLoadingId(item.id);
    try {
      const imageData = await getReceiptImage(item.id);
      setPhotoModal({ id: item.id, imageData });
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
      await confirmReceiptFraud(item.id, reason);
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
            await approveReceipt(item.id);
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

  const flagBadges = (item: FlaggedReceipt) =>
    item.fraudConfirmedCount > 0 || item.memberFlagCount > 1 ? (
      <View style={styles.badgeRow}>
        {item.fraudConfirmedCount > 0 ? <StatusPill tone="neg" label={`Confirmed fraud ${item.fraudConfirmedCount}×`} /> : null}
        {item.memberFlagCount > 1 ? <StatusPill tone="amber" label={`Flagged ${item.memberFlagCount}×`} /> : null}
      </View>
    ) : null;

  const renderItem = ({ item }: { item: FlaggedReceipt }) => (
    <Tile style={styles.mCard}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.memberName}</Text>
        <Text style={styles.cardTime}>{formatDate(item.submittedAt)}</Text>
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>{item.memberEmail}</Text>
      {flagBadges(item)}
      <Text style={styles.cardBody} numberOfLines={1}>{summaryLine(item)}</Text>
      {item.flagReason ? <Text style={styles.reasonText}>{item.flagReason}</Text> : null}
      <View style={styles.actionRow}>
        <AdminButton
          label="View Photo"
          icon="image-outline"
          variant="glass"
          onPress={() => handleViewPhoto(item)}
          disabled={photoLoadingId === item.id}
          loading={photoLoadingId === item.id}
          style={styles.mBtn}
        />
        {resolvingId === item.id ? (
          <ActivityIndicator color={c.ink2} size="small" style={styles.mSpinner} />
        ) : (
          <>
            <AdminButton label="Approve" variant="glass" onPress={() => handleApprove(item)} style={styles.mBtn} />
            <AdminButton label="Mark as Fraud" variant="danger" onPress={() => openReasonModal(item)} style={styles.mBtn} />
          </>
        )}
      </View>
    </Tile>
  );

  const emptyState = <EmptyState icon="checkmark-done-outline" title="No flagged receipts awaiting review." />;

  const reasonSheet = (
    <Modal visible={reasonModal !== null} transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Mark as Fraud</Text>
            <CircleButton icon="close" size={36} accessibilityLabel="Close" onPress={() => setReasonModal(null)} />
          </View>
          <View style={styles.warnBox}>
            <Ionicons name="warning-outline" size={20} color={c.neg} />
            <Text style={styles.warnText}>
              This rejects the receipt{reasonModal && !reasonModal.pointsCredited ? '' : " and reverses any Flagrr Cash it already awarded"}.
              {reasonModal?.memberName ? ` ${reasonModal.memberName}` : ' The member'} will be sent the reason below. This can't be undone.
            </Text>
          </View>
          <TextInput
            placeholder="Explain why this receipt is fraudulent…"
            placeholderTextColor={c.ink3}
            value={reasonText}
            onChangeText={setReasonText}
            multiline
            style={[styles.reasonInput, webNoOutline]}
          />
          <View style={styles.sheetActions}>
            <AdminButton label="Cancel" variant="glass" onPress={() => setReasonModal(null)} />
            <AdminButton
              label="Mark as Fraud"
              variant="dangerSolid"
              onPress={handleSubmitFraudReason}
              disabled={!reasonText.trim()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isDesktop) {
    const selected = flagged.find((f) => f.id === selectedId) ?? flagged[0] ?? null;
    const showDetail = !loading && !error && selected !== null;

    const renderDetail = (item: FlaggedReceipt) => {
      const busy = resolvingId === item.id;
      const photo = photoModal && photoModal.id === item.id ? photoModal : null;
      return (
        <>
          <View style={styles.dDetailHead}>
            <View style={styles.dAvatar}>
              <Text style={styles.dAvatarText}>{initials(item.memberName)}</Text>
            </View>
            <View style={styles.dDetailWho}>
              <Text style={styles.dDetailName} numberOfLines={1}>{item.memberName}</Text>
              <Muted numberOfLines={1}>{item.memberEmail}</Muted>
            </View>
            {busy ? (
              <ActivityIndicator color={c.ink2} size="small" />
            ) : (
              <View style={styles.dDetailActions}>
                <AdminButton label="Mark as Fraud" variant="danger" icon="flag-outline" onPress={() => openReasonModal(item)} />
                <AdminButton label="Approve" variant="accent" icon="checkmark" onPress={() => handleApprove(item)} />
              </View>
            )}
          </View>
          {flagBadges(item)}
          <View style={styles.dDetailGrid}>
            <View style={styles.dPhotoCol}>
              {photo ? (
                photo.imageData ? (
                  <Image source={{ uri: photo.imageData }} style={styles.dPhoto} resizeMode="contain" accessibilityLabel="Receipt Photo" />
                ) : (
                  <View style={styles.dPhotoWell}>
                    <Ionicons name="camera-outline" size={28} color={c.ink3} />
                    <Text style={styles.dWellText}>No photo was saved for this receipt.</Text>
                  </View>
                )
              ) : (
                <View style={styles.dPhotoWell}>
                  <Ionicons name="image-outline" size={28} color={c.ink3} />
                  <AdminButton
                    label="View Photo"
                    icon="image-outline"
                    onPress={() => handleViewPhoto(item)}
                    disabled={photoLoadingId === item.id}
                    loading={photoLoadingId === item.id}
                  />
                </View>
              )}
            </View>
            <View style={styles.dFacts}>
              <FactRow label="Merchant" value={item.merchantName || 'Unknown merchant'} first styles={styles} />
              <FactRow label="Total" value={`R${item.total.toFixed(2)}`} styles={styles} />
              {item.pointsAwarded !== null ? (
                <FactRow label="Flagrr Cash" value={`${item.pointsAwarded} FC${item.pointsCredited ? '' : ' pending'}`} styles={styles} />
              ) : null}
              {item.flagReason ? <FactRow label="Reason" value={item.flagReason} styles={styles} /> : null}
              <FactRow label="Submitted" value={formatDate(item.submittedAt)} styles={styles} />
            </View>
          </View>
        </>
      );
    };

    return (
      <>
        <AdminDesktopFrame activeKey="AdminFraudOversight" breadcrumb="Fraud Review" showRail={false} scrollable={false}>
          <PageTitle>Fraud Review</PageTitle>
          <View style={styles.dSplit}>
            <Tile padded={false} style={styles.dListPane}>
              {error ? (
                <View style={styles.dPanePad}>
                  <ErrorState onRetry={() => load()} />
                </View>
              ) : loading ? (
                <View style={styles.dPanePad}>
                  <SkeletonRows rows={5} />
                </View>
              ) : flagged.length === 0 ? (
                emptyState
              ) : (
                <ScrollView contentContainerStyle={styles.dListContent} showsVerticalScrollIndicator={false}>
                  {flagged.map((item) => (
                    <FraudListRow
                      key={item.id}
                      item={item}
                      selected={selected?.id === item.id}
                      onPress={() => setSelectedId(item.id)}
                      badges={flagBadges(item)}
                      c={c}
                      styles={styles}
                    />
                  ))}
                </ScrollView>
              )}
            </Tile>
            <Tile padded={false} style={styles.dDetailPane}>
              {showDetail && selected ? (
                <ScrollView contentContainerStyle={styles.dDetailContent} showsVerticalScrollIndicator={false}>
                  {renderDetail(selected)}
                </ScrollView>
              ) : (
                <View style={styles.dDetailEmpty}>
                  <Ionicons name="receipt-outline" size={32} color={c.ink3} />
                </View>
              )}
            </Tile>
          </View>
        </AdminDesktopFrame>

        {reasonSheet}
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Fraud Review" onBack={() => navigation.goBack()} />

      {error ? (
        <View style={styles.listContent}>
          <ErrorState onRetry={() => load()} />
        </View>
      ) : loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : (
        <FlatList
          data={flagged}
          keyExtractor={(f) => f.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Tile>{emptyState}</Tile>}
        />
      )}

      <Modal visible={photoModal !== null} transparent animationType="fade" onRequestClose={() => setPhotoModal(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPhotoModal(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Receipt Photo</Text>
              <CircleButton icon="close" size={36} accessibilityLabel="Close" onPress={() => setPhotoModal(null)} />
            </View>
            {photoModal?.imageData ? (
              <Image source={{ uri: photoModal.imageData }} style={styles.photoImage} resizeMode="contain" />
            ) : (
              <Text style={styles.sheetEmptyText}>No photo was saved for this receipt.</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {reasonSheet}
    </View>
  );
}

// One row of the desktop flagged list: selected = neutral `sel`, hover `fill2`.
function FraudListRow({
  item,
  selected,
  onPress,
  badges,
  c,
  styles,
}: {
  item: FlaggedReceipt;
  selected: boolean;
  onPress: () => void;
  badges: React.ReactNode;
  c: AdminColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.memberName}, ${summaryLine(item)}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[
        styles.dListRow,
        hoverTransitionNoTransform,
        selected ? { backgroundColor: c.sel } : hovered ? { backgroundColor: c.fill2 } : null,
      ]}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.memberName}</Text>
        <Text style={styles.cardTime}>{formatDate(item.submittedAt)}</Text>
      </View>
      {badges}
      <Text style={styles.cardBody} numberOfLines={1}>{summaryLine(item)}</Text>
      {item.flagReason ? (
        <Text style={styles.reasonText} numberOfLines={1}>{item.flagReason}</Text>
      ) : null}
    </Pressable>
  );
}

function FactRow({ label, value, first, styles }: { label: string; value: string; first?: boolean; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={[styles.factRow, !first && styles.factRowDivider]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    listContent: { padding: 16, paddingBottom: 32, gap: 12 },
    mCard: { gap: 6 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    cardTitle: { flex: 1, ...adminFont.bodyBold, fontSize: 15, color: c.ink },
    cardTime: { ...adminFont.bodyMedium, ...tabularNums, fontSize: 12, color: c.ink3 },
    cardMeta: { ...adminFont.body, fontSize: 13, color: c.ink2 },
    cardBody: { ...adminFont.body, ...tabularNums, fontSize: 13.5, color: c.ink },
    reasonText: { ...adminFont.body, fontSize: 12.5, color: c.ink2, fontStyle: 'italic' },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
    mBtn: { height: 44 },
    mSpinner: { height: 44, paddingHorizontal: 16 },
    backdrop: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
    sheet: {
      backgroundColor: c.sheet,
      borderRadius: adminRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
      padding: 22,
      width: '100%',
      maxWidth: 480,
      maxHeight: '80%',
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
    sheetTitle: { ...adminFont.title, fontSize: 26, color: c.ink, flex: 1 },
    sheetEmptyText: { ...adminFont.body, fontSize: 14.5, color: c.ink2, textAlign: 'center', paddingVertical: 32 },
    photoImage: { width: '100%', height: 420, borderRadius: adminRadius.sm },
    warnBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: c.negBg,
      borderRadius: adminRadius.md,
      padding: 14,
      marginBottom: 14,
    },
    warnText: { flex: 1, ...adminFont.body, fontSize: 13.5, lineHeight: 19, color: c.ink },
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
    sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
    // Desktop split view
    dSplit: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 16 },
    dListPane: { width: 400, flexShrink: 0, borderRadius: adminRadius.lg, overflow: 'hidden' },
    dPanePad: { padding: 18 },
    dListContent: { padding: 10, gap: 2 },
    dListRow: { borderRadius: adminRadius.md, paddingVertical: 12, paddingHorizontal: 14, gap: 6, minHeight: 52 },
    dDetailPane: { flex: 1, minWidth: 0, borderRadius: adminRadius.lg, overflow: 'hidden' },
    dDetailContent: { padding: 22, gap: 14 },
    dDetailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    dDetailHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
    // Fairway crest with lime initials, the avatar treatment used across tables.
    dAvatar: { width: 46, height: 46, borderRadius: adminRadius.pill, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
    dAvatarText: { ...adminFont.bodyBold, fontSize: 15, color: '#CDDE5C' },
    dDetailWho: { flex: 1, minWidth: 200 },
    dDetailName: { ...adminFont.bodyBold, fontSize: 19, color: c.ink },
    dDetailActions: { flexDirection: 'row', gap: 10 },
    dDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 18, marginTop: 4 },
    dPhotoCol: { width: 300, flexGrow: 1, maxWidth: 420 },
    dPhoto: { width: '100%', height: 420, borderRadius: adminRadius.sm, backgroundColor: c.fill2 },
    dPhotoWell: {
      borderRadius: adminRadius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.edge,
      paddingVertical: 48,
      paddingHorizontal: 18,
      alignItems: 'center',
      gap: 12,
    },
    dWellText: { ...adminFont.bodySemiBold, fontSize: 14, color: c.ink, textAlign: 'center' },
    dFacts: {
      flex: 1,
      minWidth: 260,
      backgroundColor: c.surface2,
      borderRadius: adminRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
      paddingHorizontal: 18,
      paddingVertical: 4,
    },
    factRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
    factRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
    factLabel: { ...adminFont.body, fontSize: 14, color: c.ink2 },
    factValue: { ...adminFont.bodySemiBold, ...tabularNums, fontSize: 14, color: c.ink, textAlign: 'right', flexShrink: 1, maxWidth: '65%' },
  });
}
