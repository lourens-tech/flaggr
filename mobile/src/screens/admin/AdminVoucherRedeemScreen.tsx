import React, { useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
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

const VOUCHER_QR_PREFIX = 'flagrr://voucher/';

export function AdminVoucherRedeemScreen() {
  const { lookupVoucher, redeemVoucher } = useAdmin();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [voucher, setVoucher] = useState<AdminVoucherLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const hasScannedRef = useRef(false);

  const performLookup = async (rawCode: string) => {
    if (!rawCode.trim()) return;
    setLooking(true);
    setVoucher(null);
    try {
      setVoucher(await lookupVoucher(rawCode.trim()));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Voucher not found', message);
    } finally {
      setLooking(false);
    }
  };

  const handleLookup = () => performLookup(code);

  const handleOpenScanner = () => {
    hasScannedRef.current = false;
    setScanning(true);
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (hasScannedRef.current) return;
    if (!data.startsWith(VOUCHER_QR_PREFIX)) return;
    hasScannedRef.current = true;
    const scannedCode = data.slice(VOUCHER_QR_PREFIX.length).toUpperCase();
    setScanning(false);
    setCode(scannedCode);
    performLookup(scannedCode);
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

  if (scanning) {
    return (
      <View style={styles.scannerScreen}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setScanning(false)} hitSlop={12} accessibilityLabel="Cancel scan">
              <Ionicons name="chevron-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Voucher QR</Text>
            <View style={{ width: 24 }} />
          </View>
        </SafeAreaView>

        {!permission ? null : !permission.granted ? (
          <SafeAreaView style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={48} color={colors.white} />
            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionBody}>
              Flagrr needs camera access to scan a member's voucher QR code.
            </Text>
            <View style={{ height: spacing.lg }} />
            <PillButton label="Allow Camera Access" onPress={requestPermission} />
          </SafeAreaView>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.alignBadge}>
                <Text style={styles.alignBadgeText}>Align the member's QR code</Text>
              </View>
              <View style={styles.frame} />
            </View>
          </CameraView>
        )}
      </View>
    );
  }

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
          Enter the voucher code, or scan the QR code shown on the member's screen, to check and redeem it.
        </Text>

        <PillButton label="Scan QR Code" icon="scan-outline" variant="dark" onPress={handleOpenScanner} />
        <View style={{ height: spacing.md }} />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>
        <View style={{ height: spacing.md }} />

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
  scannerScreen: { flex: 1, backgroundColor: colors.darkGreen },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  content: { padding: screenPadding },
  helpText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textSecondary, marginBottom: spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EEE' },
  dividerText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
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
  scannerHeader: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
  },
  camera: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  alignBadge: {
    position: 'absolute',
    top: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  alignBadgeText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.white },
  frame: {
    width: '80%',
    height: '40%',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.lime,
    borderStyle: 'dashed',
  },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenPadding },
  permissionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white, marginTop: spacing.md },
  permissionBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
