import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';
import { bentoBrand, bentoType } from '../../theme/bento';
import type { Receipt } from '../../data/types';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoSheet, BentoTile } from '../../components/bento';

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
  const { height } = useWindowDimensions();
  const { receipts, getReceiptImage } = useApp();
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{ imageData: string | null; receipt: Receipt } | null>(null);

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

  const pill = (label: string, bg: string, fg: string) => (
    <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: bg }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: fg }}>{label}</Text>
    </View>
  );

  const renderRow = (item: Receipt, index: number) => {
    const approved = item.status === 'approved';
    const badge = approved && item.pointsAwarded !== null
      ? null
      : approved
        ? pill(STATUS_LABELS.approved, t.accentSoft, t.accent)
        : item.status === 'rejected'
        ? pill(STATUS_LABELS.rejected, t.seg, t.negative)
        : pill(item.flagged ? 'Under review' : STATUS_LABELS[item.status] ?? item.status, t.warnBg, t.warnInk);
    return (
      <View key={item.id} style={{ paddingVertical: 13, borderTopWidth: index ? 1 : 0, borderTopColor: t.hair }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <BentoIcon name="receipt" size={20} color={t.accent} strokeWidth={1.7} />
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
        <View style={{ marginLeft: 52, marginTop: 6, gap: 4 }}>
          {!approved && item.pointsAwarded !== null ? (
            <Text style={{ fontSize: 13, color: t.muted }}>
              {item.pointsAwarded} FC {item.status === 'pending' ? 'pending' : 'earned'}
            </Text>
          ) : null}
          {item.flagged ? (
            <Text style={{ fontSize: 13, lineHeight: 18, color: t.muted }}>
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
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 24 }}
          >
            {photoLoadingId === item.id ? (
              <ActivityIndicator color={t.accent} size="small" />
            ) : (
              <>
                <BentoIcon name="gallery" size={15} color={t.accent} strokeWidth={1.8} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent }}>View Photo</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <BentoScreen title="Receipt History" onBack={() => navigation.goBack()}>
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

      <BentoSheet
        visible={photoModal !== null}
        title="Receipt Photo"
        subtitle={
          photoModal
            ? `${photoModal.receipt.courseName || 'Unrecognized merchant'} · ${formatDate(photoModal.receipt.submittedAt)}${photoModal.receipt.pointsAwarded !== null ? ` · ${photoModal.receipt.status === 'approved' ? '+' : ''}${photoModal.receipt.pointsAwarded} FC` : ''}`
            : undefined
        }
        onClose={() => setPhotoModal(null)}
      >
        {photoModal?.imageData ? (
          <Image source={{ uri: photoModal.imageData }} style={{ width: '100%', height: Math.round(height * 0.55), borderRadius: 18, backgroundColor: t.seg }} resizeMode="contain" accessibilityLabel="Receipt photo" />
        ) : (
          <Text style={[bentoType.body, { color: t.muted }]}>No photo was saved for this receipt.</Text>
        )}
      </BentoSheet>
    </BentoScreen>
  );
}
