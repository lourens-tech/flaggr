import React, { useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { AdminVoucherLookup } from '../../data/adminTypes';

const STATUS_LABEL: Record<AdminVoucherLookup['status'], string> = {
  active: 'Active — ready to redeem',
  redeemed: 'Already redeemed',
  expired: 'Expired',
};

export function AdminVoucherRedeemScreen() {
  const { lookupVoucher, redeemVoucher } = useAdmin();
  const [code, setCode] = useState('');
  const [voucher, setVoucher] = useState<AdminVoucherLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLooking(true);
    setVoucher(null);
    try {
      setVoucher(await lookupVoucher(code.trim()));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Voucher not found', message);
    } finally {
      setLooking(false);
    }
  };

  const handleRedeem = async () => {
    if (!voucher) return;
    setRedeeming(true);
    try {
      const updated = await redeemVoucher(voucher.code);
      setVoucher(updated);
      showAlert('Redeemed', `${voucher.rewardTitle} marked as redeemed for ${voucher.memberName}.`);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t redeem voucher', message);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Redeem a Voucher</Text>
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        <Text style={styles.helpText}>
          Enter the voucher code shown on the member's QR code screen to check and redeem it.
        </Text>

        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder="FLGR-XXXX-XXXX"
              variant="onLight"
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
              onSubmitEditing={handleLookup}
              returnKeyType="search"
            />
          </View>
        </View>
        <View style={{ height: spacing.md }} />
        <PillButton label="Look Up" icon="search" onPress={handleLookup} loading={looking} disabled={!code.trim()} />

        {voucher ? (
          <View style={styles.card}>
            <Text style={styles.rewardTitle}>{voucher.rewardTitle}</Text>
            <Text style={styles.variantLabel}>{voucher.variantLabel} · {voucher.cost.toLocaleString()} FC</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Ionicons name="person-outline" size={16} color={colors.clubGreen} />
              <Text style={styles.rowText}>{voucher.memberName} ({voucher.memberEmail})</Text>
            </View>
            <View style={styles.row}>
              <Ionicons
                name={voucher.status === 'active' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={16}
                color={voucher.status === 'active' ? colors.clubGreen : colors.negative}
              />
              <Text style={[styles.rowText, voucher.status !== 'active' && { color: colors.negative }]}>
                {STATUS_LABEL[voucher.status]}
              </Text>
            </View>

            {voucher.status === 'active' ? (
              <>
                <View style={{ height: spacing.md }} />
                <PillButton label="Confirm Redeem" variant="dark" icon="checkmark" onPress={handleRedeem} loading={redeeming} />
              </>
            ) : null}
          </View>
        ) : looking ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  content: { padding: screenPadding },
  helpText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textSecondary, marginBottom: spacing.md },
  searchRow: { flexDirection: 'row' },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rewardTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.darkGreen },
  variantLabel: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  rowText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
});
