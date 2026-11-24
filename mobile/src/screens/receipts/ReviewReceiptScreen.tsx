import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { ScanFlowParamList } from '../../navigation/types';
import { ApiError } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { showAlert } from '../../utils/alert';
import { useBento } from '../../context/ThemeContext';
import { bentoType } from '../../theme/bento';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoTile, Eyebrow, type BentoIconName } from '../../components/bento';

type Props = StackScreenProps<ScanFlowParamList, 'ReviewReceipt'>;

export function ReviewReceiptScreen({ route, navigation }: Props) {
  const { t } = useBento();
  const { submitReceipt } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const { scanResult, imageBase64, imageUri } = route.params;

  const merchantName = scanResult.merchant?.name ?? scanResult.merchantNameGuess ?? 'Unrecognized merchant';
  const isLowConfidence = scanResult.ocrConfidence < 55;
  const isAwayClub = scanResult.awayClub;
  const isNonParticipatingClub = scanResult.nonParticipatingClub;
  // Earned on the slip total (always the case away or at a non-participating
  // club), so line items just show what they cost rather than their own FC.
  const earnsOnTotal = isAwayClub || isNonParticipatingClub || scanResult.pointsBasis === 'total';
  // A pre-paid (R0) line matched to the club's catalog still earns its catalog
  // value on top of the total — the server only leaves FC on such lines when
  // it counted them.
  const isPrepaidEarning = (item: { price: number; pointsAwarded: number }) => item.price === 0 && item.pointsAwarded > 0;
  const hasPrepaidEarning = earnsOnTotal && scanResult.items.some(isPrepaidEarning);
  // A catalog item already on another of today's slips earns once: the server
  // zeroes a repeat pre-paid line, or takes an earlier pre-paid credit off a
  // paid one (see applySameDay in api/_lib/pointsEngine.ts).
  const homeClubTotal = earnsOnTotal && !isAwayClub && !isNonParticipatingClub;
  const isAlreadyEarnedToday = (item: { price: number; pointsAwarded: number; matchedName: string | null }) =>
    homeClubTotal &&
    item.matchedName !== null &&
    (item.price === 0 ? item.pointsAwarded === 0 : item.pointsAwarded < Math.round(item.price));
  const hasUnmatchedItems =
    !earnsOnTotal && scanResult.items.some((i) => !i.matchedProductId && !i.matchedActivityId);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const receipt = await submitReceipt(imageBase64, imageUri);
      navigation.replace('ReceiptSuccess', { pointsAwarded: scanResult.totalPointsAwarded, flagged: receipt.flagged });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t submit receipt', message);
    } finally {
      setSubmitting(false);
    }
  };

  const amountText = (item: (typeof scanResult.items)[number]) =>
    earnsOnTotal && isPrepaidEarning(item)
      ? `+${item.pointsAwarded} FC`
      : earnsOnTotal
        ? `R${item.price.toFixed(2)}`
        : item.pointsAwarded > 0
          ? `+${item.pointsAwarded} FC`
          : '—';

  return (
    <BentoScreen title="Review Receipt" onBack={() => navigation.goBack()}>
      <View style={{ height: 6 }} />

      {isLowConfidence ? (
        <Notice icon="info" bg={t.warnBg} ink={t.warnInk}>
          This scan wasn’t fully clear — some details below may be inaccurate. It’s still been submitted for review.
        </Notice>
      ) : null}

      {isNonParticipatingClub ? (
        <Notice icon="info" bg={t.accentSoft} ink={t.ink}>
          Your club is between subscriptions right now — Flagrr Cash earned at the standard rate of R1 = 1 FC.
        </Notice>
      ) : isAwayClub ? (
        <Notice icon="info" bg={t.accentSoft} ink={t.ink}>
          Not your home club — Flagrr Cash earned at the standard away-club rate of R1 = 1 FC.
        </Notice>
      ) : null}

      <Appear>
        <BentoTile>
          {/* Photo thumbnail and the slip's details */}
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 72, height: 92, borderRadius: 14, overflow: 'hidden', backgroundColor: t.seg, boxShadow: `0 0 0 1px ${t.ring}`, alignItems: 'center', justifyContent: 'center' }}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={{ width: 72, height: 92 }} resizeMode="cover" accessibilityLabel="Your receipt photo" />
              ) : (
                <Text style={{ fontSize: 11, color: t.muted, textAlign: 'center', padding: 6 }}>No image captured</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Detail label="Merchant" value={merchantName} />
              {scanResult.receiptNumber ? <Detail label="Receipt Number" value={scanResult.receiptNumber} /> : null}
              {scanResult.date || scanResult.time ? <Detail label="Date" value={[scanResult.date, scanResult.time].filter(Boolean).join(' · ')} /> : null}
            </View>
          </View>

          <Eyebrow style={{ fontSize: 13, letterSpacing: 1.56, marginTop: 14, paddingBottom: 4 }}>Items</Eyebrow>
          {scanResult.items.length === 0 ? (
            <Text style={[bentoType.body, { color: t.muted, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.hair }]}>
              No line items were recognized on this receipt.
            </Text>
          ) : (
            scanResult.items.map((item, index) => {
              const prepaid = earnsOnTotal && isPrepaidEarning(item);
              const already = !prepaid && isAlreadyEarnedToday(item);
              const matched = !prepaid && !already && !earnsOnTotal && Boolean(item.matchedName);
              const notEligible = !prepaid && !already && !earnsOnTotal && !item.matchedName;
              const amount = amountText(item);
              const amountColor = amount.startsWith('+') ? t.accent : amount === '—' ? (already || notEligible ? t.negative : t.muted) : t.ink;
              return (
                <View key={`${item.description}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.hair }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>
                      {item.quantity > 1 ? `${item.quantity}x ` : ''}
                      {item.description}
                    </Text>
                    {prepaid ? (
                      <ItemNote icon="check" color={t.accent}>Pre-paid · Matched: {item.matchedName}</ItemNote>
                    ) : already ? (
                      <ItemNote color={t.negative}>Already earned on another slip today</ItemNote>
                    ) : matched ? (
                      <ItemNote icon="check" color={t.accent}>Matched: {item.matchedName}</ItemNote>
                    ) : notEligible ? (
                      <ItemNote color={t.negative}>Not eligible for points</ItemNote>
                    ) : null}
                  </View>
                  <Text style={[amount.startsWith('R') ? { fontSize: 15, fontWeight: '600' } : { fontFamily: 'Fraunces_600SemiBold', fontSize: 18 }, { color: amountColor, fontVariant: ['tabular-nums'] }]}>
                    {amount}
                  </Text>
                </View>
              );
            })
          )}

          {hasUnmatchedItems ? (
            <Text style={{ fontSize: 13, lineHeight: 19, color: t.muted, marginTop: 10 }}>
              Some items weren’t recognized as eligible golf products or activities, so no points were awarded for them.
            </Text>
          ) : null}

          {earnsOnTotal ? (
            <Text style={{ fontSize: 13, lineHeight: 19, color: t.muted, marginTop: 10 }}>
              {hasPrepaidEarning ? 'Flagrr Cash is earned on the slip total, plus the club value of pre-paid items.' : 'Flagrr Cash is earned on the slip total.'}
            </Text>
          ) : null}

          {scanResult.grandTotal !== null ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: t.hair, paddingTop: 12, marginTop: 12 }}>
              <Text style={{ fontSize: 15, color: t.muted }}>Receipt Total</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>R{scanResult.grandTotal.toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, paddingTop: 8, paddingBottom: 4, marginTop: scanResult.grandTotal === null ? 12 : 0, borderTopWidth: scanResult.grandTotal === null ? 1 : 0, borderTopColor: t.hair }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Flagrr Cash Earned</Text>
            <Text style={[bentoType.number, { fontSize: 30, lineHeight: 34, color: t.accent }]}>+{scanResult.totalPointsAwarded} FC</Text>
          </View>
        </BentoTile>
      </Appear>

      <Text style={{ fontSize: 13, lineHeight: 19, color: t.muted, paddingHorizontal: 4 }}>
        Extracted details can’t be edited — if something looks wrong, rescan with a clearer photo.
      </Text>

      <View style={{ height: 4 }} />
      <BentoButton label="Submit Receipt" nub onPress={handleSubmit} loading={submitting} />
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: t.accent }}>Rescan</Text>
      </Pressable>
    </BentoScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { t } = useBento();
  return (
    <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: 14, color: t.muted, minWidth: 104 }}>{label}</Text>
      <Text style={{ flex: 1, minWidth: 90, fontSize: 14, fontWeight: '600', color: t.ink }}>{value}</Text>
    </View>
  );
}

function ItemNote({ children, color, icon }: { children: React.ReactNode; color: string; icon?: BentoIconName }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
      {icon ? <BentoIcon name={icon} size={14} color={color} strokeWidth={2.2} /> : null}
      <Text style={{ flexShrink: 1, fontSize: 13, color }}>{children}</Text>
    </View>
  );
}

function Notice({ children, icon, bg, ink }: { children: React.ReactNode; icon: BentoIconName; bg: string; ink: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: bg }}>
      <BentoIcon name={icon} size={18} color={ink} strokeWidth={1.8} />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: ink }}>{children}</Text>
    </View>
  );
}
