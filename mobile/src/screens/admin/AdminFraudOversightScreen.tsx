import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { FlaggedReceipt } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminFraudOversight'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function AdminFraudOversightScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { getFlaggedReceipts, confirmReceiptFraud, clearReceiptFlag, getReceiptImage } = useAdmin();
  const [flagged, setFlagged] = useState<FlaggedReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{ imageData: string | null } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const rows = await getFlaggedReceipts();
          if (!cancelled) setFlagged(rows);
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

  const handleViewPhoto = async (item: FlaggedReceipt) => {
    setPhotoLoadingId(item.id);
    try {
      const imageData = await getReceiptImage(item.id);
      setPhotoModal({ imageData });
    } catch {
      showAlert('Couldn’t load photo', 'Something went wrong. Please try again.');
    } finally {
      setPhotoLoadingId(null);
    }
  };

  const handleConfirmFraud = (item: FlaggedReceipt) => {
    showAlert(
      'Confirm this receipt as fraud?',
      `This rejects the receipt and reverses the ${item.pointsAwarded ?? 0} Flagrr Cash it awarded from ` +
        `${item.memberName}'s balance. They'll be notified. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Fraud',
          style: 'destructive',
          onPress: async () => {
            setResolvingId(item.id);
            try {
              await confirmReceiptFraud(item.id);
              setFlagged((prev) => prev.filter((f) => f.id !== item.id));
            } catch {
              showAlert('Couldn’t confirm fraud', 'Something went wrong. Please try again.');
            } finally {
              setResolvingId(null);
            }
          },
        },
      ],
    );
  };

  const handleClearFlag = (item: FlaggedReceipt) => {
    setResolvingId(item.id);
    (async () => {
      try {
        await clearReceiptFlag(item.id);
        setFlagged((prev) => prev.filter((f) => f.id !== item.id));
      } catch {
        showAlert('Couldn’t clear flag', 'Something went wrong. Please try again.');
      } finally {
        setResolvingId(null);
      }
    })();
  };

  const renderItem = ({ item }: { item: FlaggedReceipt }) => (
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
      <Text style={styles.cardMeta} numberOfLines={1}>{item.memberEmail}</Text>
      <Text style={styles.cardBody} numberOfLines={1}>
        {item.merchantName || 'Unknown merchant'} — R{item.total.toFixed(2)}
        {item.pointsAwarded !== null ? ` · ${item.pointsAwarded} FC` : ''}
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
            <TouchableOpacity onPress={() => handleClearFlag(item)}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleConfirmFraud(item)}>
              <Text style={styles.confirmFraudText}>Confirm Fraud</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Fraud Review" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={flagged}
          keyExtractor={(f) => f.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No flagged receipts awaiting review.</Text>}
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
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
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
  reasonText: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' },
  cardTime: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  warnBadge: { backgroundColor: 'rgba(230,168,55,0.2)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  warnBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: '#8a6100' },
  dangerBadge: { backgroundColor: 'rgba(222,92,92,0.15)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  dangerBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.negative },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, gap: spacing.sm },
  viewPhotoButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  viewPhotoText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen },
  clearText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textSecondary },
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
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
}
