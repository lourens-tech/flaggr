import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { Receipt } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptHistory'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function ReceiptHistoryScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { receipts, getReceiptImage } = useApp();
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{ imageData: string | null } | null>(null);

  const handleViewPhoto = async (receipt: Receipt) => {
    setPhotoLoadingId(receipt.id);
    try {
      const imageData = await getReceiptImage(receipt.id);
      setPhotoModal({ imageData });
    } catch {
      showAlert('Couldn’t load photo', 'Something went wrong. Please try again.');
    } finally {
      setPhotoLoadingId(null);
    }
  };

  const renderItem = ({ item }: { item: Receipt }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.courseName || 'Unrecognized merchant'}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status] ?? item.status}</Text>
        </View>
      </View>
      {item.flagged ? (
        <View style={styles.reviewBadge}>
          <Ionicons name="alert-circle-outline" size={12} color="#8a6100" />
          <Text style={styles.reviewBadgeText}>Under review</Text>
        </View>
      ) : null}
      <Text style={styles.cardMeta}>{formatDate(item.submittedAt)}</Text>
      <Text style={styles.cardBody}>
        R{item.total.toFixed(2)}
        {item.pointsAwarded !== null ? ` · ${item.pointsAwarded} FC earned` : ''}
      </Text>
      {item.flagged ? (
        <Text style={styles.reviewNote}>
          Flagged for manual review{item.flagReason ? ` (${item.flagReason})` : ''} — your Flagrr Cash has already
          been credited, no action is needed.
        </Text>
      ) : null}
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
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Receipt History" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <FlatList
        data={receipts}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No receipts yet — scan one from the Home screen to get started.</Text>
        }
      />

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
  statusBadge: { backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.textPrimary },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(230,168,55,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reviewBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: '#8a6100' },
  reviewNote: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, fontStyle: 'italic' },
  viewPhotoButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs, alignSelf: 'flex-start' },
  viewPhotoText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen },
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
