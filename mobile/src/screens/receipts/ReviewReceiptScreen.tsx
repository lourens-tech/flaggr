import React from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { useApp } from '../../context/AppContext';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ReviewReceipt'>;

// In production this would come from an OCR/receipt-parsing service; the parsed
// line items below are illustrative placeholders standing in for that result.
const PARSED = {
  courseName: 'Vancouver Fairways Golf Club',
  date: 'Jul 19, 2026 · 2:35 PM',
  items: [
    { label: '3x 9 Holes', amount: 300 },
    { label: '2x Guest Entry', amount: 150 },
  ],
  total: 450,
  pointsAwarded: 250,
};

export function ReviewReceiptScreen({ route, navigation }: Props) {
  const { submitReceipt } = useApp();

  const handleSubmit = () => {
    submitReceipt(
      {
        imageUri: route.params.imageUri,
        courseName: PARSED.courseName,
        items: PARSED.items,
        subtotal: PARSED.total,
        tax: 0,
        total: PARSED.total,
        submittedAt: new Date().toISOString(),
      },
      PARSED.pointsAwarded,
    );
    navigation.replace('ReceiptSuccess', { pointsAwarded: PARSED.pointsAwarded });
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Review Receipt" />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {route.params.imageUri ? (
          <Image source={{ uri: route.params.imageUri }} style={styles.receiptImage} resizeMode="cover" />
        ) : (
          <View style={[styles.receiptImage, styles.receiptImagePlaceholder]}>
            <Text style={styles.placeholderText}>No image captured</Text>
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Club</Text>
          <Text style={styles.summaryValue}>{PARSED.courseName}</Text>

          <Text style={[styles.summaryLabel, { marginTop: spacing.md }]}>Date</Text>
          <Text style={styles.summaryValue}>{PARSED.date}</Text>

          <Text style={[styles.summaryLabel, { marginTop: spacing.md }]}>Items</Text>
          {PARSED.items.map((item) => (
            <View key={item.label} style={styles.itemRow}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text style={styles.itemAmount}>R{item.amount}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Text style={styles.totalLabel}>Estimated Flagrr Bucks</Text>
            <Text style={styles.totalValue}>+{PARSED.pointsAwarded} FB</Text>
          </View>
        </View>

        <View style={{ height: spacing.lg }} />
        <PillButton label="Submit Receipt" onPress={handleSubmit} />
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
  summaryCard: {
    backgroundColor: colors.mintBgAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  summaryLabel: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  summaryValue: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.darkGreen, marginTop: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  itemLabel: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textPrimary },
  itemAmount: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: 'rgba(31,66,52,0.15)', marginVertical: spacing.md },
  totalLabel: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.darkGreen },
  totalValue: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.clubGreen },
  disclaimer: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
