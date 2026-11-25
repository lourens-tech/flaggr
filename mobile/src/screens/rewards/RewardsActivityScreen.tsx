import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { showAlert } from '../../utils/alert';
import { voucherStatus } from '../../utils/vouchers';
import { useBento } from '../../context/ThemeContext';
import { bentoType } from '../../theme/bento';
import type { ActivityEntry } from '../../data/types';
import { Appear, BentoIcon, BentoScreen, BentoTile, EmptyState, SegmentedControl, StatusPill } from '../../components/bento';

type Props = StackScreenProps<RootStackParamList, 'Activity'>;

type Filter = 'all' | 'earn' | 'redeem';

function groupLabel(dateIso: string): string {
  const date = new Date(dateIso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  const daysAgo = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 7) return 'This Week';
  return 'Earlier';
}

function formatTime(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatAmount(amount: number) {
  if (amount > 0) return `+${amount.toLocaleString()} FC`;
  if (amount < 0) return `−${Math.abs(amount).toLocaleString()} FC`;
  return `${amount} FC`;
}

export function RewardsActivityScreen({ navigation }: Props) {
  const { t } = useBento();
  const { activity, vouchers } = useApp();
  // All / Earned / Redeemed: filters the list on the device.
  const [filter, setFilter] = useState<Filter>('all');
  const visible = useMemo(() => (filter === 'all' ? activity : activity.filter((e) => e.type === filter)), [activity, filter]);

  // Owner decision (24 Nov 2026): a "Receipt scanned" row opens that receipt in Receipt History.
  // The server links new rows to their receipt (activity.receipt_id, migration 052); older rows,
  // bonus rows and a server without the migration have no receiptId and stay plain.
  const opensReceipt = (entry: ActivityEntry) => entry.type === 'earn' && !!entry.receiptId;

  const handleEntryPress = (entry: ActivityEntry) => {
    if (opensReceipt(entry)) {
      navigation.navigate('ReceiptHistory', { receiptId: entry.receiptId! });
      return;
    }
    if (entry.type !== 'redeem' || !entry.voucherId) return;
    const voucher = vouchers.find((v) => v.id === entry.voucherId);
    if (!voucher) {
      showAlert('Voucher not found', 'We couldn’t find this voucher’s details.');
      return;
    }
    // Owner decision 25 Nov 2026: every voucher opens the Voucher screen; used and
    // expired ones show their badge there instead of an alert.
    navigation.navigate('Voucher', { voucherId: voucher.id });
  };

  const grouped = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    for (const entry of visible) {
      const label = groupLabel(entry.date);
      groups[label] = groups[label] ?? [];
      groups[label].push(entry);
    }
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    return order.filter((label) => groups[label]?.length).map((label) => ({ label, entries: groups[label] }));
  }, [visible]);

  const statusPill = (entry: ActivityEntry) => {
    if (entry.type !== 'redeem' || !entry.voucherId) return null;
    const v = vouchers.find((x) => x.id === entry.voucherId);
    const status = v ? voucherStatus(v) : 'active';
    if (!v || status === 'active') return null;
    // Reward Activity board: "Already redeemed" grey, "Expired" red.
    return status === 'expired' ? <StatusPill label="Expired" tone="danger" /> : <StatusPill label="Already redeemed" tone="muted" />;
  };

  return (
    <BentoScreen title="Reward Activity" onBack={() => navigation.goBack()}>
      <View style={{ height: 4 }} />
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Show activity"
        options={[
          { value: 'all', label: 'All' },
          { value: 'earn', label: 'Earned' },
          { value: 'redeem', label: 'Redeemed' },
        ]}
      />

      {activity.length === 0 ? (
        <Appear>
          <EmptyState
            icon="rewardsActivity"
            title="No activity yet"
            body="No activity yet — play a round or scan a receipt to get started."
            actionLabel="Scan a receipt"
            onAction={() => navigation.navigate('ScanFlow')}
          />
        </Appear>
      ) : grouped.length === 0 ? (
        <Text style={[bentoType.body, { color: t.muted, textAlign: 'center', paddingVertical: 48 }]}>
          {filter === 'earn' ? 'Nothing earned yet.' : 'Nothing redeemed yet.'}
        </Text>
      ) : null}

      {grouped.map((group) => (
        <Appear key={group.label} style={{ gap: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 0.12 * 13, textTransform: 'uppercase', color: t.muted, marginTop: 6 }}>{group.label}</Text>
          <BentoTile padding={0}>
            <View style={{ paddingHorizontal: 16 }}>
              {group.entries.map((entry, i) => {
                const isEarn = entry.type === 'earn';
                // Voucher rows open the voucher; "Receipt scanned" rows with a receipt id open that receipt.
                const isTappable = (entry.type === 'redeem' && !!entry.voucherId) || opensReceipt(entry);
                const pill = statusPill(entry);
                return (
                  <Pressable
                    key={entry.id}
                    disabled={!isTappable}
                    onPress={() => handleEntryPress(entry)}
                    accessibilityRole={isTappable ? 'button' : undefined}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair, opacity: pressed ? 0.7 : 1 })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: isEarn ? t.accentSoft : t.seg, alignItems: 'center', justifyContent: 'center' }}>
                      <BentoIcon name={isEarn ? 'receipt' : 'rewards'} size={20} color={isEarn ? t.accent : t.muted} strokeWidth={1.8} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{entry.title}</Text>
                      <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                        {isEarn ? 'Earned' : 'Redeemed'} · {formatTime(entry.date)}
                      </Text>
                      {pill ? <View style={{ flexDirection: 'row', marginTop: 6 }}>{pill}</View> : null}
                    </View>
                    <Text numberOfLines={1} style={{ flexShrink: 0, fontSize: 16, fontWeight: '600', color: isEarn ? t.accent : t.ink, fontVariant: ['tabular-nums'] }}>
                      {formatAmount(entry.amount)}
                    </Text>
                    {isTappable ? <BentoIcon name="chevronRight" size={16} color={t.muted} strokeWidth={1.8} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </BentoTile>
        </Appear>
      ))}
    </BentoScreen>
  );
}
