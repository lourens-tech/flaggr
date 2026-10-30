import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminButton, Muted, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { PressableScale } from '../../components/motion';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminVoucherLookup } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';

const STATUS_LABEL: Record<AdminVoucherLookup['status'], string> = {
  active: 'Active — ready to redeem',
  redeemed: 'Already redeemed',
  expired: 'Expired',
};

const VOUCHER_QR_PREFIX = 'flagrr://voucher/';

export function AdminVoucherRedeemScreen() {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
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

  const handleRedeem = () => {
    if (!voucher) return;
    // Confirm first, naming the reward and member the lookup returned.
    const reward = voucher.rewardTitle?.trim();
    const member = voucher.memberName?.trim();
    const summary = reward && member ? `${reward} for ${member}.` : reward ? `${reward}.` : member ? `For ${member}.` : undefined;
    showAlert('Redeem this voucher?', summary, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redeem',
        onPress: async () => {
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
        },
      },
    ]);
  };

  if (scanning) {
    return (
      <View style={styles.scannerScreen}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.scannerHeader}>
            <Pressable
              onPress={() => setScanning(false)}
              hitSlop={12}
              accessibilityLabel="Cancel scan"
              accessibilityRole="button"
              style={({ pressed }) => [styles.scannerBack, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="chevron-back" size={24} color={WHITE} />
            </Pressable>
            <Text style={styles.headerTitle}>Scan Voucher QR</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>

        {!permission ? null : !permission.granted ? (
          <SafeAreaView edges={['bottom']} style={styles.permissionContainer}>
            <View style={[styles.permissionCard, { backgroundColor: c.surface, borderColor: c.edge }]}>
              <View style={[styles.permissionIcon, { backgroundColor: c.fill }]}>
                <Ionicons name="camera-outline" size={30} color={c.icon} />
              </View>
              <Text style={[styles.permissionTitle, { color: c.ink }]}>Camera access needed</Text>
              <Text style={[styles.permissionBody, { color: c.ink2 }]}>
                Flagrr needs camera access to scan a member's voucher QR code.
              </Text>
              <View style={{ height: 18 }} />
              <PillButton label="Continue" onPress={requestPermission} />
            </View>
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
              <View style={styles.frame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
            </View>
          </CameraView>
        )}
      </View>
    );
  }

  const canRedeem = voucher?.status === 'active';

  const lookupPanel = (
    <Tile style={styles.lookupTile}>
      <Muted style={styles.helpText}>
        Enter the voucher code, or scan the QR code shown on the member's screen, to check and redeem it.
      </Muted>

      <PressableScale
        onPress={handleOpenScanner}
        accessibilityRole="button"
        accessibilityLabel="Scan QR Code"
        style={[styles.scanButton, isDesktop ? [styles.dScanButton, { backgroundColor: c.fill }] : styles.mScanButton]}
      >
        <View style={[styles.scanIcon, !isDesktop && styles.mScanIcon]}>
          <Ionicons name="scan-outline" size={isDesktop ? 28 : 34} color={LIME} />
        </View>
        <Text style={[styles.scanLabel, { color: isDesktop ? c.ink : WHITE }]}>Scan QR Code</Text>
      </PressableScale>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: c.edge }]} />
        <Text style={[styles.dividerText, { color: c.ink3 }]}>or enter manually</Text>
        <View style={[styles.dividerLine, { backgroundColor: c.edge }]} />
      </View>

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
        <AdminButton
          variant={canRedeem ? 'glass' : 'accent'}
          icon="search"
          label="Look Up"
          size="lg"
          onPress={handleLookup}
          loading={looking}
          disabled={!code.trim()}
        />
      </View>
    </Tile>
  );

  const result = voucher ? (
    <Tile padded={false} style={styles.resultTile}>
      <View style={styles.resultHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rewardTitle, { color: c.ink }]}>{voucher.rewardTitle}</Text>
          <Text style={[styles.variantLabel, { color: c.ink2 }]}>{voucher.variantLabel} · {voucher.cost.toLocaleString()} FC</Text>
        </View>
      </View>
      <View style={[styles.row, { borderTopColor: c.edge }]}>
        <Ionicons name="person-outline" size={18} color={c.icon} />
        <Text style={[styles.rowText, { color: c.ink }]}>{voucher.memberName} ({voucher.memberEmail})</Text>
      </View>
      <View style={[styles.row, { borderTopColor: c.edge }]}>
        <Ionicons
          name={voucher.status === 'active' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          size={18}
          color={voucher.status === 'active' ? c.pos : c.neg}
        />
        <Text style={[styles.rowText, styles.statusText, { color: voucher.status === 'active' ? c.pos : c.neg }]}>
          {STATUS_LABEL[voucher.status]}
        </Text>
      </View>

      {voucher.status === 'active' ? (
        <View style={styles.redeemArea}>
          <AdminButton variant="accent" size="lg" icon="checkmark" label="Confirm Redeem" onPress={handleRedeem} loading={redeeming} fullWidth />
        </View>
      ) : null}
    </Tile>
  ) : looking ? (
    <Tile>
      <SkeletonRows rows={3} />
    </Tile>
  ) : null;

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminVouchers" breadcrumb="Voucher Redemption" showRail={false}>
        <PageTitle>Redeem a Voucher</PageTitle>
        <View style={styles.dCols}>
          <View style={styles.dCol}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.ink }]}>Look Up a Voucher</Text>
            {lookupPanel}
          </View>
          <View style={[styles.dCol, styles.dResultCol]}>
            {result ?? (
              <View style={[styles.placeholder, { borderColor: c.edge }]}>
                <Ionicons name="ticket-outline" size={30} color={c.icon} />
              </View>
            )}
          </View>
        </View>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Redeem a Voucher" showBack={false} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {lookupPanel}
        {result}
      </ScrollView>
    </View>
  );
}

// Brand constants used on the Fairway scan tile and over the live camera:
// they read the same in both schemes.
const WHITE = '#FFFFFF';
const LIME = '#CDDE5C';
const FAIRWAY = '#1F4234';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  scannerScreen: { flex: 1, backgroundColor: FAIRWAY },
  headerSafeArea: { backgroundColor: FAIRWAY },
  headerTitle: { ...adminFont.bodyBold, fontSize: 17, color: WHITE },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120, gap: 16 },
  lookupTile: { gap: 14 },
  helpText: { fontSize: 14.5, lineHeight: 21 },
  scanButton: { borderRadius: adminRadius.md, alignItems: 'center' },
  mScanButton: { backgroundColor: FAIRWAY, height: 180, justifyContent: 'center', gap: 14, borderRadius: adminRadius.lg },
  dScanButton: { flexDirection: 'row', gap: 16, padding: 18 },
  scanIcon: { width: 56, height: 56, borderRadius: adminRadius.sm, backgroundColor: FAIRWAY, alignItems: 'center', justifyContent: 'center' },
  mScanIcon: { width: 72, height: 72, borderRadius: adminRadius.md, backgroundColor: 'rgba(205,222,92,0.14)' },
  scanLabel: { ...adminFont.bodyBold, fontSize: 17 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { ...adminFont.bodyBold, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultTile: { overflow: 'hidden' },
  resultHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18 },
  rewardTitle: { ...adminFont.heading, fontSize: 24, lineHeight: 30 },
  variantLabel: { ...adminFont.body, ...tabularNums, fontSize: 14.5, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: { ...adminFont.body, fontSize: 15, flex: 1 },
  statusText: { ...adminFont.bodySemiBold },
  redeemArea: { padding: 18, paddingTop: 8 },
  sectionTitle: { ...adminFont.bodyBold, fontSize: 17, marginBottom: 12 },
  dCols: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 18, alignItems: 'flex-start' },
  dCol: { flexGrow: 1, flexBasis: 360, maxWidth: 560 },
  dResultCol: { paddingTop: 36 },
  placeholder: {
    borderRadius: adminRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  scannerHeader: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  scannerBack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  camera: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  alignBadge: {
    position: 'absolute',
    top: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: adminRadius.pill,
  },
  alignBadgeText: { ...adminFont.bodySemiBold, fontSize: 14, color: WHITE },
  frame: { width: 240, height: 240 },
  corner: { position: 'absolute', width: 44, height: 44, borderColor: LIME },
  cornerTL: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: adminRadius.md },
  cornerTR: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: adminRadius.md },
  cornerBL: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: adminRadius.md },
  cornerBR: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: adminRadius.md },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  permissionCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: adminRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  permissionIcon: { width: 64, height: 64, borderRadius: adminRadius.md, alignItems: 'center', justifyContent: 'center' },
  permissionTitle: { ...adminFont.bodyBold, fontSize: 20, marginTop: 14, textAlign: 'center' },
  permissionBody: {
    ...adminFont.body,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
});
