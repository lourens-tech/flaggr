import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { showAlert } from '../../utils/alert';
import { useBento } from '../../context/ThemeContext';
import { bentoType } from '../../theme/bento';
import type { ActivityEntry } from '../../data/types';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoTile, Eyebrow, SegmentedControl } from '../../components/bento';

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

  const handleEntryPress = (entry: ActivityEntry) => {
    if (entry.type !== 'redeem' || !entry.voucherId) return;
    const voucher = vouchers.find((v) => v.id === entry.voucherId);
    if (!voucher) {
      showAlert('Voucher not found', 'We couldn’t find this voucher’s details.');
      return;
    }
    if (voucher.status === 'active') {
      navigation.navigate('Voucher', { voucherId: voucher.id });
      return;
    }
    const label = voucher.variantLabel && voucher.variantLabel !== 'Standard' ? ` — ${voucher.variantLabel}` : '';
    showAlert(
      voucher.status === 'expired' ? 'Voucher expired' : 'Already redeemed',
      voucher.status === 'expired'
        ? `${voucher.rewardTitle}${label} has expired.`
        : `${voucher.rewardTitle}${label} has already been scanned and redeemed at the club.`,
    );
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
    if (!v || v.status === 'active') return null;
    return (
      <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: v.status === 'expired' ? t.seg : t.accentSoft }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: v.status === 'expired' ? t.muted : t.accent }}>{v.status === 'expired' ? 'Expired' : 'Already redeemed'}</Text>
      </View>
    );
  };

  return (
    <BentoScreen title="Reward Activity" onBack={() => navigation.goBack()}>
      <SegmentedControl
        fill
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Show activity"
        options={[
          { value: 'all', label: 'All' },
          { value: 'earn', label: 'Earned' },
          { value: 'redeem', label: 'Redeemed' },
        ]}
        style={{ marginTop: 6 }}
      />

      {activity.length === 0 ? (
        <Appear>
          <BentoTile padding={18}>
            <View style={{ alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 }}>
              <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <BentoIcon name="activity" size={30} color={t.accent} strokeWidth={1.7} />
              </View>
              <Text style={[bentoType.number, { fontSize: 22, color: t.ink, marginTop: 14, textAlign: 'center' }]}>No activity yet</Text>
              <Text style={[bentoType.body, { color: t.muted, marginTop: 6, textAlign: 'center', maxWidth: 270 }]}>
                No activity yet — play a round or scan a receipt to get started.
              </Text>
              <BentoButton label="Scan a receipt" nub compact onPress={() => navigation.navigate('ScanFlow')} style={{ marginTop: 18, alignSelf: 'stretch' }} />
            </View>
          </BentoTile>
        </Appear>
      ) : grouped.length === 0 ? (
        <Text style={[bentoType.body, { color: t.muted, textAlign: 'center', marginTop: 12 }]}>
          {filter === 'earn' ? 'Nothing earned yet.' : 'Nothing redeemed yet.'}
        </Text>
      ) : null}

      {grouped.map((group) => (
        <Appear key={group.label}>
          <Eyebrow style={{ marginTop: 8, marginBottom: 8, marginLeft: 4 }}>{group.label}</Eyebrow>
          <BentoTile padding={0}>
            <View style={{ paddingHorizontal: 16 }}>
              {group.entries.map((entry, i) => {
                const isEarn = entry.type === 'earn';
                const isTappable = entry.type === 'redeem' && !!entry.voucherId;
                return (
                  <Pressable
                    key={entry.id}
                    disabled={!isTappable}
                    onPress={() => handleEntryPress(entry)}
                    accessibilityRole={isTappable ? 'button' : undefined}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair, opacity: pressed ? 0.7 : 1 })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: isEarn ? t.accentSoft : t.seg, alignItems: 'center', justifyContent: 'center' }}>
                      <BentoIcon name={isEarn ? 'receipt' : 'rewards'} size={20} color={isEarn ? t.accent : t.ink} strokeWidth={1.7} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{entry.title}</Text>
                      <Text style={{ fontSize: 13, color: t.muted }}>
                        {isEarn ? 'Earned' : 'Redeemed'} · {formatTime(entry.date)}
                      </Text>
                      {statusPill(entry) ? <View style={{ flexDirection: 'row' }}>{statusPill(entry)}</View> : null}
                    </View>
                    <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: isEarn ? t.accent : t.ink, fontVariant: ['tabular-nums'] }}>{formatAmount(entry.amount)}</Text>
                    {isTappable ? <BentoIcon name="chevronRight" size={16} color={t.muted} /> : null}
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
