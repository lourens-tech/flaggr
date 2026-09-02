import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { DuplicateReceiptAttempt, FlaggedReceipt } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminFraudOversight'>;

type Tab = 'flagged' | 'duplicates';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  receipt_number: 'Same receipt number',
  image_hash: 'Same receipt image',
};

export function SuperAdminFraudOversightScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const [flaggedRows, duplicateRows] = await Promise.all([
            getSuperAdminFlaggedReceipts(),
            getSuperAdminDuplicateAttempts(),
          ]);
          if (!cancelled) {
            setFlagged(flaggedRows);
            setDuplicates(duplicateRows);
          }
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

  const renderFlagged = ({ item }: { item: FlaggedReceipt }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.memberName}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {item.fraudConfirmedCount > 0 ? (
            <View style={styles.dangerBadge}>
              <Text style={styles.dangerBadgeText}>Confirmed fraud {item.fraudConfirmedCount}×</Text>
            </View>
          ) : null}
          {item.memberFlagCount > 1 ? (
            <View style={styles.warnBadge}>
              <Text style={styles.warnBadgeText}>Flagged {item.memberFlagCount}×</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>{item.memberEmail} · {item.courseName}</Text>
      <Text style={styles.cardBody} numberOfLines={1}>
        {item.merchantName || 'Unknown merchant'} — R{item.total.toFixed(2)}
        {item.pointsAwarded !== null ? ` · ${item.pointsAwarded} FC${item.pointsCredited ? '' : ' pending'}` : ''}
      </Text>
      {item.flagReason ? <Text style={styles.reasonText}>{item.flagReason}</Text> : null}
      <Text style={styles.cardTime}>{formatDate(item.submittedAt)}</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.viewPhotoButton}
          onPress={() => handleViewPhoto(item)}
          disabled={photoLoadingId === item.id}
        >
          {photoLoadingId === item.id ? (
            <ActivityIndicator color={colors.clubGreen} size="small" />
          ) : (
            <>
              <Ionicons name="image-outline" size={15} color={colors.clubGreen} />
              <Text style={styles.viewPhotoText}>View Photo</Text>
            </>
          )}
        </TouchableOpacity>
        {resolvingId === item.id ? (
          <ActivityIndicator color={colors.negative} size="small" />
        ) : (
          <>
            <TouchableOpacity onPress={() => handleApprove(item)}>
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openReasonModal(item)}>
              <Text style={styles.confirmFraudText}>Mark as Fraud</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderDuplicate = ({ item }: { item: DuplicateReceiptAttempt }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.memberName}</Text>
        {item.crossClub ? (
          <View style={styles.dangerBadge}>
            <Text style={styles.dangerBadgeText}>Cross-Club</Text>
          </View>
        ) : null}
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
      <Text style={styles.cardTime}>{formatDate(item.attemptedAt)}</Text>
    </View>
  );

  const emptyText =
    tab === 'flagged'
      ? flagged.length === 0
        ? 'No flagged receipts yet.'
        : 'No flagged receipts match your search.'
      : duplicates.length === 0
        ? 'No duplicate attempts yet.'
        : 'No duplicate attempts match your search.';

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Fraud Oversight" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.searchArea}>
        <TextField placeholder="Search by member or club" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'flagged' && styles.tabButtonActive]}
            onPress={() => setTab('flagged')}
          >
            <Text style={[styles.tabButtonText, tab === 'flagged' && styles.tabButtonTextActive]}>
              Flagged Receipts ({flagged.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'duplicates' && styles.tabButtonActive]}
            onPress={() => setTab('duplicates')}
          >
            <Text style={[styles.tabButtonText, tab === 'duplicates' && styles.tabButtonTextActive]}>
              Duplicate Attempts ({duplicates.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : tab === 'flagged' ? (
        <FlatList
          data={filteredFlagged}
          keyExtractor={(f) => f.id}
          renderItem={renderFlagged}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
        />
      ) : (
        <FlatList
          data={filteredDuplicates}
          keyExtractor={(d) => d.id}
          renderItem={renderDuplicate}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
        />
      )}

      <Modal visible={photoModal !== null} transparent animationType="fade" onRequestClose={() => setPhotoModal(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPhotoModal(null)}>
          <View style={styles.photoSheet}>
            <View style={styles.photoSheetHeader}>
              <Text style={styles.photoSheetTitle}>Receipt Photo</Text>
              <TouchableOpacity onPress={() => setPhotoModal(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {photoModal?.imageData ? (
              <Image source={{ uri: photoModal.imageData }} style={styles.photoImage} resizeMode="contain" />
            ) : (
              <Text style={styles.emptyText}>No photo was saved for this receipt.</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={reasonModal !== null} transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
        <View style={styles.backdrop}>
          <View style={styles.photoSheet}>
            <View style={styles.photoSheetHeader}>
              <Text style={styles.photoSheetTitle}>Mark as Fraud</Text>
              <TouchableOpacity onPress={() => setReasonModal(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.reasonModalHint}>
              This rejects the receipt{reasonModal && !reasonModal.pointsCredited ? '' : " and reverses any Flagrr Cash it already awarded"}.
              {reasonModal?.memberName ? ` ${reasonModal.memberName}` : 'The member'} will be sent the reason below. This can't be undone.
            </Text>
            <TextInput
              placeholder="Explain why this receipt is fraudulent…"
              placeholderTextColor={colors.textSecondary}
              value={reasonText}
              onChangeText={setReasonText}
              multiline
              style={styles.reasonInput}
            />
            <View style={styles.reasonModalActions}>
              <TouchableOpacity style={styles.reasonCancelButton} onPress={() => setReasonModal(null)}>
                <Text style={styles.reasonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reasonSubmitButton, !reasonText.trim() && styles.reasonSubmitButtonDisabled]}
                onPress={handleSubmitFraudReason}
                disabled={!reasonText.trim()}
              >
                <Text style={styles.reasonSubmitText}>Mark as Fraud</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  searchArea: { paddingHorizontal: screenPadding, paddingTop: spacing.md, gap: spacing.sm },
  tabRow: { flexDirection: 'row', gap: spacing.sm },
  tabButton: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.mintBgAlt, alignItems: 'center' },
  tabButtonActive: { backgroundColor: colors.darkGreen },
  tabButtonText: { fontFamily: fontFamily.heading, fontSize: 11, color: colors.textPrimary },
  tabButtonTextActive: { color: colors.white },
  listContent: { padding: screenPadding, gap: spacing.sm },
  card: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  cardMeta: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  cardBody: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textPrimary },
  cardBodyStrong: { fontFamily: fontFamily.bodySemiBold },
  reasonText: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' },
  cardTime: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  warnBadge: { backgroundColor: colors.warningBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  warnBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.warning },
  dangerBadge: { backgroundColor: colors.dangerBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  dangerBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.negative },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, gap: spacing.sm },
  viewPhotoButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  viewPhotoText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen },
  approveText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen },
  confirmFraudText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.negative },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: screenPadding },
  photoSheet: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
  },
  photoSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  photoSheetTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.textPrimary },
  photoImage: { width: '100%', height: 420, borderRadius: radius.sm },
  reasonModalHint: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 17 },
  reasonInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  reasonModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  reasonCancelButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  reasonCancelText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textSecondary },
  reasonSubmitButton: { backgroundColor: colors.negative, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  reasonSubmitButtonDisabled: { opacity: 0.5 },
  reasonSubmitText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.white },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
}
