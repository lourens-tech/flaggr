import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { api } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';
import { bentoBrand, bentoType } from '../../theme/bento';
import { prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import type { Receipt } from '../../data/types';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoTile, StatusPill } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptHistory'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function ReceiptHistoryScreen({ navigation, route }: Props) {
  const { t } = useBento();
  const insets = useSafeAreaInsets();
  const { receipts: loaded, getReceiptImage } = useApp();
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{ imageData: string | null; receipt: Receipt } | null>(null);

  // Refreshes each time it opens (owner decision 24 Nov 2026), so a receipt an admin has since
  // approved or rejected shows its new status. The list loaded at app start stays on screen while
  // the new one loads (no blank flash); if the refresh fails, that list simply stays.
  const [fresh, setFresh] = useState<Receipt[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      api
        .receipts()
        .then((list) => {
          if (live) setFresh(list);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );
  const receipts = fresh ?? loaded;

  const handleViewPhoto = async (receipt: Receipt) => {
    setPhotoLoadingId(receipt.id);
    try {
      const imageData = await getReceiptImage(receipt.id);
      setPhotoModal({ imageData, receipt });
    } catch {
      showAlert('Couldn’t load photo', 'Something went wrong. Please try again.');
    } finally {
      setPhotoLoadingId(null);
    }
  };

  // Opened for one receipt (a "Receipt scanned" row in Reward Activity): show it once the list has it.
  const openedFor = useRef<string | null>(null);
  const wanted = route.params?.receiptId;
  useEffect(() => {
    if (!wanted || openedFor.current === wanted) return;
    const r = receipts.find((x) => x.id === wanted);
    if (!r) return;
    openedFor.current = wanted;
    void handleViewPhoto(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, receipts]);

  // Summary tile: Flagrr Cash from approved receipts submitted this calendar
  // month, and how many receipts were submitted this month.
  const summary = useMemo(() => {
    const now = new Date();
    const thisMonth = receipts.filter((r) => {
      const d = new Date(r.submittedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const earned = thisMonth.reduce((sum, r) => sum + (r.status === 'approved' && r.pointsAwarded ? r.pointsAwarded : 0), 0);
    return { month: now.toLocaleDateString(undefined, { month: 'long' }), earned, count: thisMonth.length };
  }, [receipts]);

  const renderRow = (item: Receipt, index: number) => {
    const approved = item.status === 'approved';
    // Pills as on AppReceipts and kept boards G-B-HistoryStatuses: Approved (accent), Rejected
    // (seg fill, negative text), Under review / Pending / any other status (warm).
    const badge =
      approved && item.pointsAwarded !== null ? null : approved ? (
        <StatusPill label={STATUS_LABELS.approved} tone="accent" style={styles.pill} />
      ) : item.status === 'rejected' ? (
        <View style={[styles.rejected, { backgroundColor: t.seg }]}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: t.negative }} maxFontSizeMultiplier={1.4}>
            {STATUS_LABELS.rejected}
          </Text>
        </View>
      ) : (
        <StatusPill label={item.flagged ? 'Under review' : (STATUS_LABELS[item.status] ?? item.status)} tone="warn" style={styles.pill} />
      );
    return (
      <View key={item.id} style={{ paddingVertical: 13, borderTopWidth: index ? 1 : 0, borderTopColor: t.hair }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <BentoIcon name="receipt" size={20} color={t.accent} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }} numberOfLines={2}>
              {item.courseName || 'Unrecognized merchant'}
            </Text>
            <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
              {formatDate(item.submittedAt)} · R{item.total.toFixed(2)}
            </Text>
          </View>
          {badge ?? (
            <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: t.accent, fontVariant: ['tabular-nums'] }}>
              +{item.pointsAwarded?.toLocaleString()} FC
            </Text>
          )}
        </View>
        <View style={{ marginLeft: 52 }}>
          {!approved && item.pointsAwarded !== null ? (
            <Text style={[styles.subline, { color: t.muted }]}>
              {item.pointsAwarded} FC {item.status === 'pending' ? 'pending' : 'earned'}
            </Text>
          ) : null}
          {item.flagged ? (
            <Text style={[styles.subline, { color: t.muted }]}>
              {item.status === 'pending'
                ? `Flagged for manual review${item.flagReason ? ` (${item.flagReason})` : ''} — your Flagrr Cash will be added once it's approved.`
                : `Flagged for manual review${item.flagReason ? ` (${item.flagReason})` : ''} — your Flagrr Cash has already been credited, no action is needed.`}
            </Text>
          ) : null}
          <Pressable
            onPress={() => handleViewPhoto(item)}
            disabled={photoLoadingId === item.id}
            accessibilityRole="button"
            accessibilityLabel={`View photo of ${item.courseName || 'receipt'}`}
            hitSlop={{ top: 12, bottom: 12, right: 12 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 18, marginTop: 8 }}
          >
            {photoLoadingId === item.id ? (
              <Ring track={t.track} color={t.accent} />
            ) : (
              <>
                <BentoIcon name="eye" size={15} color={t.accent} strokeWidth={1.8} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent }}>View Photo</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  const closePhoto = () => setPhotoModal(null);
  const photoCaption = photoModal
    ? `${photoModal.receipt.courseName || 'Unrecognized merchant'} · ${formatDate(photoModal.receipt.submittedAt)}${photoModal.receipt.pointsAwarded !== null ? ` · ${photoModal.receipt.status === 'approved' ? '+' : ''}${photoModal.receipt.pointsAwarded} FC` : ''}`
    : '';

  return (
    <BentoScreen title="Receipt History" onBack={() => navigation.goBack()} contentStyle={{ paddingBottom: 60 + insets.bottom }}>
      <View style={{ height: 6 }} />
      {receipts.length === 0 ? (
        <Appear>
          <BentoTile padding={18}>
            <View style={{ alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 }}>
              <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <BentoIcon name="receipt" size={30} color={t.accent} strokeWidth={1.7} />
              </View>
              <Text style={[bentoType.number, { fontSize: 22, color: t.ink, marginTop: 14, textAlign: 'center' }]}>No receipts yet</Text>
              <Text style={[bentoType.body, { color: t.muted, marginTop: 6, textAlign: 'center', maxWidth: 270 }]}>
                No receipts yet — scan one from the Home screen to get started.
              </Text>
              <BentoButton label="Scan a receipt" nub compact onPress={() => navigation.navigate('ScanFlow')} style={{ marginTop: 18, alignSelf: 'stretch' }} />
            </View>
          </BentoTile>
        </Appear>
      ) : (
        <>
          <Appear>
            <BentoTile tone="hero" padding={0}>
              <View style={{ paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Earned from receipts · {summary.month}</Text>
                  <Text style={[bentoType.number, { fontSize: 30, lineHeight: 34, color: '#FFFFFF', marginTop: 4 }]}>{summary.earned.toLocaleString()} FC</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[bentoType.number, { fontSize: 22, color: bentoBrand.lime }]}>{summary.count}</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{summary.count === 1 ? 'receipt' : 'receipts'}</Text>
                </View>
              </View>
            </BentoTile>
          </Appear>
          <Appear>
            <BentoTile padding={0}>
              <View style={{ paddingHorizontal: 16 }}>{receipts.map(renderRow)}</View>
            </BentoTile>
          </Appear>
        </>
      )}

      {/* The receipt photo, full screen (owner decision 24 Nov 2026: the mockup layout wins; board DlgPhoto,
          kept board G-B-PhotoNoImage). Closed by X, a tap anywhere outside the X, or the system back. */}
      <Modal visible={photoModal !== null} transparent animationType="fade" onRequestClose={closePhoto} statusBarTranslucent>
        <StatusBar barStyle="light-content" />
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,10,8,0.86)' }]} onPress={closePhoto} accessibilityRole="button" accessibilityLabel="Close" />
        <View
          accessibilityViewIsModal
          style={[styles.viewer, { paddingTop: insets.top + 8, paddingBottom: Math.max(40, insets.bottom + 6), paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right }]}
        >
          <View style={styles.viewerBar}>
            <View style={{ width: 42 }} />
            <Text accessibilityRole="header" style={[bentoType.navTitle, styles.passThrough, { color: '#FFFFFF' }]}>
              Receipt Photo
            </Text>
            <Pressable onPress={closePhoto} accessibilityRole="button" accessibilityLabel="Close" hitSlop={2} style={styles.viewerClose}>
              <BentoIcon name="closeWide" size={18} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.viewerBody}>
            {photoModal?.imageData ? (
              <Image source={{ uri: photoModal.imageData }} style={[styles.passThrough, { flex: 1, width: '100%' }]} resizeMode="contain" accessibilityLabel="Receipt photo" />
            ) : (
              <View style={[styles.passThrough, styles.noPhoto]}>
                <Text style={{ fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>No photo was saved for this receipt.</Text>
              </View>
            )}
          </View>
          <Text style={[styles.passThrough, { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }]}>{photoCaption}</Text>
        </View>
      </Modal>
    </BentoScreen>
  );
}

// The 18 pt ring that stands in for "View Photo" while that row's photo loads (kept board G-B-HistoryStatuses1).
function Ring({ track, color }: { track: string; color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading photo"
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2.5,
        borderColor: track,
        borderTopColor: color,
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'center' },
  rejected: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  subline: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  // Taps on everything but the X fall through to the backdrop, which closes the photo.
  viewer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'box-none' },
  viewerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'box-none' },
  viewerClose: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  viewerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 16, pointerEvents: 'box-none' },
  noPhoto: { width: '100%', height: 300, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  passThrough: { pointerEvents: 'none' },
});
