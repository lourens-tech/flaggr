import React, { useState } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { ApiError } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ReviewReceipt'>;

export function ReviewReceiptScreen({ route, navigation }: Props) {
  const { submitReceipt } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const { scanResult, imageBase64, imageUri } = route.params;

  const merchantName = scanResult.merchant?.name ?? scanResult.merchantNameGuess ?? 'Unrecognized merchant';
  const isLowConfidence = scanResult.ocrConfidence < 55;
  const isAwayClub = scanResult.awayClub;
  const hasUnmatchedItems = !isAwayClub && scanResult.items.some((i) => !i.matchedProductId && !i.matchedActivityId);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitReceipt(imageBase64, imageUri);
      navigation.replace('ReceiptSuccess', { pointsAwarded: scanResult.totalPointsAwarded });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t submit receipt', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Review Receipt" />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.receiptImage} resizeMode="cover" />
        ) : (
          <View style={[styles.receiptImage, styles.receiptImagePlaceholder]}>
            <Text style={styles.placeholderText}>No image captured</Text>
          </View>
        )}

        {isLowConfidence ? (
          <View style={styles.warningBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.negative} />
            <Text style={styles.warningText}>
              This scan wasn’t fully clear — some details below may be inaccurate. It’s still been submitted for
              review.
            </Text>
          </View>
        ) : null}

        {isAwayClub ? (
          <View style={styles.awayClubBanner}>
            <Ionicons name="information-circle-outline" size={18} color={colors.clubGreen} />
            <Text style={styles.awayClubText}>
              Not your home club — Flagrr Cash earned at the standard away-club rate of R1 = 1 FC.
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Merchant</Text>
          <Text style={styles.summaryValue}>{merchantName}</Text>

          {scanResult.receiptNumber ? (
            <>
              <Text style={[styles.summaryLabel, { marginTop: spacing.md }]}>Receipt Number</Text>
              <Text style={styles.summaryValueSmall}>{scanResult.receiptNumber}</Text>
            </>
          ) : null}

          {scanResult.date || scanResult.time ? (
            <>
              <Text style={[styles.summaryLabel, { marginTop: spacing.md }]}>Date</Text>
              <Text style={styles.summaryValueSmall}>
                {[scanResult.date, scanResult.time].filter(Boolean).join(' · ')}
              </Text>
            </>
          ) : null}

          <Text style={[styles.summaryLabel, { marginTop: spacing.md }]}>Items</Text>
          {scanResult.items.length === 0 ? (
            <Text style={styles.noItemsText}>No line items were recognized on this receipt.</Text>
          ) : (
            scanResult.items.map((item, index) => (
              <View key={`${item.description}-${index}`} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>
                    {item.quantity > 1 ? `${item.quantity}x ` : ''}
                    {item.description}
                  </Text>
                  {isAwayClub ? null : item.matchedName ? (
                    <Text style={styles.itemMatched}>Matched: {item.matchedName}</Text>
                  ) : (
                    <Text style={styles.itemUnmatched}>Not eligible for points</Text>
                  )}
                </View>
                <Text style={styles.itemAmount}>
                  {isAwayClub ? `R${item.price.toFixed(2)}` : item.pointsAwarded > 0 ? `+${item.pointsAwarded} FC` : '—'}
                </Text>
              </View>
            ))
          )}

          {hasUnmatchedItems ? (
            <Text style={styles.unmatchedHint}>
              Some items weren’t recognized as eligible golf products or activities, so no points were awarded for
              them.
            </Text>
          ) : null}

          <View style={styles.divider} />
          {scanResult.grandTotal !== null ? (
            <View style={styles.itemRow}>
              <Text style={styles.totalLabel}>Receipt Total</Text>
              <Text style={styles.totalValueSmall}>R{scanResult.grandTotal.toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={styles.itemRow}>
            <Text style={styles.totalLabel}>Flagrr Cash Earned</Text>
            <Text style={styles.totalValue}>+{scanResult.totalPointsAwarded} FC</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Extracted details can’t be edited — if something looks wrong, rescan with a clearer photo.
        </Text>

        <View style={{ height: spacing.lg }} />
        <PillButton label="Submit Receipt" onPress={handleSubmit} loading={submitting} />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding },
  receiptImage: { width: '100%', height: 220, borderRadius: radius.md },
  receiptImagePlaceholder: { backgroundColor: colors.imagePlaceholder, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontFamily: fontFamily.body, color: colors.textSecondary },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginTop: spacing.md,
  },
  warningText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.negative, lineHeight: 16 },
  awayClubBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.mintBg,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginTop: spacing.md,
  },
  awayClubText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.darkGreen, lineHeight: 16 },
  summaryCard: {
    backgroundColor: colors.mintBgAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  summaryLabel: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  summaryValue: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.darkGreen, marginTop: 2 },
  summaryValueSmall: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.textPrimary, marginTop: 2 },
  noItemsText: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  itemLabel: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textPrimary },
  itemMatched: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.clubGreen, marginTop: 1 },
  itemUnmatched: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 1 },
  itemAmount: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.textPrimary },
  unmatchedHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  divider: { height: 1, backgroundColor: 'rgba(31,66,52,0.15)', marginVertical: spacing.md },
  totalLabel: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.darkGreen },
  totalValue: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.clubGreen },
  totalValueSmall: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.textPrimary },
  disclaimer: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
