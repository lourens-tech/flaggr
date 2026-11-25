import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { haptic } from '../../utils/haptics';
import { REWARD_CATEGORY_LABELS } from '../../components/common/RewardCard';
import { AdSpace } from '../../components/common/AdSpace';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoType } from '../../theme/bento';
import type { Reward, RewardCategory, RewardVariant } from '../../data/types';
import { PressableScale } from '../../components/motion';
import { Appear, BentoButton, BentoField, BentoIcon, BentoScreen, BentoSheet, CountUp, EmptyState, Eyebrow, H1, Parallax, showToast } from '../../components/bento';

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const NOT_LISTED_POPUP_TITLE = "You're Almost In the Family";
const NOT_LISTED_POPUP_BODY =
  "We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen.";

// Category filter order (only categories with rewards are shown).
const CATEGORY_ORDER: RewardCategory[] = ['rounds', 'dining', 'practice', 'pro-shop', 'experiences'];

// Category tag over a card photo. Rewards board: Pro Shop is a flag-green tag
// with white text; Rounds and Experiences (and Dining on the Filters board) are
// fairway with lime text. Practice is on no board: it keeps the fairway tag.
const CATEGORY_TAG: Partial<Record<RewardCategory, { bg: string; fg: string }>> = {
  'pro-shop': { bg: 'rgba(0,128,90,0.88)', fg: '#FFFFFF' },
};
const DEFAULT_TAG = { bg: 'rgba(31,66,52,0.85)', fg: bentoBrand.lime };

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Rewards'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function RewardsShopScreen({ navigation }: Props) {
  const { t } = useBento();
  const { user, rewards, points, redeemReward } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<RewardCategory | 'all'>('all');
  // Redeem confirmation sheet: the reward and the option the member picked.
  const [confirm, setConfirm] = useState<{ reward: Reward; variant: RewardVariant } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const availableCategories = useMemo(() => CATEGORY_ORDER.filter((c) => rewards.some((r) => r.category === c)), [rewards]);

  const filteredRewards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rewards.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rewards, search, category]);

  // Unlike Home's every-second-open popup, this shows on every visit here —
  // an empty shop needs explaining every time, not just as a standing
  // reminder (see HomeScreen for the alternating version of the same copy).
  useFocusEffect(
    useCallback(() => {
      if (!user.isPlaceholderClub) return;
      showAlert(NOT_LISTED_POPUP_TITLE, NOT_LISTED_POPUP_BODY, [
        { text: 'Contact Support', onPress: () => navigation.navigate('Contact') },
        { text: 'Close', style: 'cancel' },
      ]);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.isPlaceholderClub]),
  );

  const variantLabel = (reward: Reward, variant: RewardVariant) => (variant.label === 'Standard' ? reward.title : `${reward.title} (${variant.label})`);

  const handleRedeem = (reward: Reward, variantId: string) => {
    const variant = reward.variants.find((v) => v.id === variantId);
    if (!variant) return;
    const label = variantLabel(reward, variant);
    if (points.balance < variant.cost) {
      showAlert('Not enough Flagrr Cash', `You need ${variant.cost - points.balance} more Flagrr Cash to redeem ${label}.`);
      return;
    }
    setConfirm({ reward, variant });
  };

  const confirmRedeem = async () => {
    if (!confirm) return;
    setRedeeming(true);
    try {
      const voucher = await redeemReward(confirm.reward.id, confirm.variant.id);
      setRedeeming(false);
      setConfirm(null);
      haptic.success();
      navigation.navigate('Voucher', { voucherId: voucher.id });
      // Owner-approved toast (24 Nov 2026), wording from the motion prototype.
      showToast('Reward redeemed', 'Show the voucher at the club');
    } catch (err) {
      // Owner decision (24 Nov 2026): a failed redeem is no longer silent. Server messages written
      // for members ("Not enough Flagrr Cash", "Reward not found") show word for word.
      setRedeeming(false);
      setConfirm(null);
      showAlert('Couldn’t redeem', friendlyError(err));
    }
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        {user.homeClub ? <Eyebrow numberOfLines={1}>{user.homeClub}</Eyebrow> : null}
        <H1 style={{ marginTop: 6 }}>Rewards Shop</H1>
      </View>
      {/* Tapping the Flagrr Cash opens Member Tiers (approved small addition, 24 Nov 2026). */}
      <Pressable
        onPress={() => navigation.navigate('MemberTiers')}
        accessibilityRole="button"
        accessibilityLabel={`${points.balance.toLocaleString()} Flagrr Cash to spend`}
        accessibilityHint="Opens Member Tiers"
        style={({ pressed }) => ({ minHeight: 44, justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: 4, opacity: pressed ? 0.7 : 1 })}
      >
        <CountUp value={points.balance} style={[bentoType.number, { fontSize: 22, color: t.ink }]} />
        <Text style={{ fontSize: 13, color: t.muted }}>FC to spend</Text>
      </Pressable>
    </View>
  );

  return (
    <BentoScreen tabBar scrollTitle="Rewards Shop">
      {header}
      <View style={{ height: 4 }} />

      {rewards.length === 0 ? (
        <>
          <Appear>
            {user.isPlaceholderClub ? (
              <EmptyState
                icon="rewards"
                title="Nothing Here Yet"
                body="Your golf club hasn't joined the Flagrr family yet — that's why there's nothing to redeem here."
                actionLabel="Contact Support"
                onAction={() => navigation.navigate('Contact')}
              />
            ) : (
              <EmptyState icon="rewards" title="No Rewards Yet" body="Your club hasn't added any rewards yet — check back soon." />
            )}
          </Appear>
          <AdSpace placement="rewardsShop" />
        </>
      ) : (
        <>
          <BentoField
            placeholder="Search rewards…"
            accessibilityLabel="Search rewards"
            value={search}
            onChangeText={setSearch}
            rightIcon="search"
            returnKeyType="search"
          />

          {availableCategories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
              <FilterPill label="All" active={category === 'all'} onPress={() => setCategory('all')} />
              {availableCategories.map((c) => (
                <FilterPill key={c} label={REWARD_CATEGORY_LABELS[c]} active={category === c} onPress={() => setCategory(category === c ? 'all' : c)} />
              ))}
            </ScrollView>
          ) : null}

          {filteredRewards.length === 0 ? (
            <Appear>
              <EmptyState icon="rewardsSearch" title="No rewards match your search." body="Try another word, or clear the search to see everything." />
            </Appear>
          ) : (
            // Paired rows so two cards in a row always match height; the ad
            // spans the grid after the first row.
            chunk(filteredRewards, 2).map((pair, rowIndex) => (
              <React.Fragment key={pair[0].id}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
                  {pair.map((reward) => (
                    <Appear key={reward.id} style={{ flex: 1 }}>
                      <ShopCard reward={reward} onRedeem={(variantId) => handleRedeem(reward, variantId)} />
                    </Appear>
                  ))}
                  {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
                </View>
                {rowIndex === 0 ? <AdSpace placement="rewardsShop" /> : null}
              </React.Fragment>
            ))
          )}
        </>
      )}

      <BentoSheet visible={confirm !== null} title="Redeem reward?" onClose={() => (redeeming ? undefined : setConfirm(null))} closeDisabled={redeeming}>
        {confirm ? (
          <View>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <RewardImage reward={confirm.reward} style={{ width: 76, height: 76, borderRadius: 20 }} iconSize={28} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, color: t.muted }}>
                  {[user.homeClub, REWARD_CATEGORY_LABELS[confirm.reward.category]].filter(Boolean).join(' · ')}
                </Text>
                <Text style={[bentoType.number, { fontSize: 24, lineHeight: 26, color: t.ink, marginTop: 2 }]}>{variantLabel(confirm.reward, confirm.variant)}</Text>
              </View>
            </View>
            <View style={{ marginTop: 16, borderRadius: 20, backgroundColor: t.seg, paddingHorizontal: 16, paddingVertical: 2 }}>
              <SheetRow label="Cost" value={`${confirm.variant.cost.toLocaleString()} FC`} />
              {/* Brand kit: never "balance" for Flagrr Cash; "Left to spend" is the kept-features boards' wording. */}
              <SheetRow label="Left to spend" value={`${(points.balance - confirm.variant.cost).toLocaleString()} FC`} divider />
            </View>
            <BentoButton label="Redeem Now" onPress={confirmRedeem} loading={redeeming} style={{ minHeight: 54, marginTop: 18 }} />
            <Pressable
              onPress={() => setConfirm(null)}
              disabled={redeeming}
              accessibilityRole="button"
              style={{ minHeight: 44, marginTop: 4, alignItems: 'center', justifyContent: 'center', opacity: redeeming ? 0.45 : 1 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: t.muted }}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}
      </BentoSheet>
    </BentoScreen>
  );
}

function SheetRow({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const { t } = useBento();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderTopWidth: divider ? 1 : 0, borderTopColor: t.hair }}>
      <Text style={{ fontSize: 15, color: t.muted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { t } = useBento();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      // 38 pt pill, 44 pt touch target (Filters board).
      hitSlop={{ top: 3, bottom: 3 }}
      style={{
        minHeight: 38,
        paddingHorizontal: 16,
        borderRadius: 999,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: active ? 'transparent' : t.hair,
        backgroundColor: active ? t.accent : t.tile,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: active ? t.accentInk : t.ink }}>{label}</Text>
    </Pressable>
  );
}

// `parallax` lets the photo drift against the page scroll (cards in the
// list only, not the photo in the redeem sheet).
function RewardImage({ reward, style, iconSize = 34, parallax = false }: { reward: Reward; style: object; iconSize?: number; parallax?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = <Image source={{ uri: reward.imageUrl }} onError={() => setFailed(true)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />;
  return (
    <View style={[{ backgroundColor: bentoBrand.fairway, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {reward.imageUrl && !failed ? (
        parallax ? (
          <Parallax travel={10} style={{ position: 'absolute', top: -10, left: 0, right: 0, bottom: -10 }}>{photo}</Parallax>
        ) : (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>{photo}</View>
        )
      ) : (
        <BentoIcon name="rewards" size={iconSize} color={bentoBrand.lime} strokeWidth={1.5} />
      )}
    </View>
  );
}

// Reward card from the Rewards board: photo with its category, title,
// description, option chips when there are several, cost and Redeem Now.
function ShopCard({ reward, onRedeem }: { reward: Reward; onRedeem: (variantId: string) => void }) {
  const { t } = useBento();
  const [selected, setSelected] = useState(0);
  const variant = reward.variants[selected] ?? reward.variants[0];
  if (!variant) return null;
  const tag = CATEGORY_TAG[reward.category] ?? DEFAULT_TAG;
  return (
    <View style={{ flex: 1, padding: 5, borderRadius: 26, backgroundColor: t.shell, boxShadow: `0 0 0 1px ${t.ring}, ${t.shadow}` }}>
      <View style={{ flex: 1, borderRadius: 21, overflow: 'hidden', backgroundColor: t.tile, boxShadow: t.insetHighlight }}>
        <View>
          <RewardImage reward={reward} style={{ height: 112 }} parallax />
          <View style={{ position: 'absolute', top: 10, left: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: tag.bg }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: tag.fg }}>{REWARD_CATEGORY_LABELS[reward.category]}</Text>
          </View>
        </View>
        <View style={{ flex: 1, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }} numberOfLines={2}>
            {reward.title}
          </Text>
          {reward.description ? (
            // Two lines kept for the description (board: 35 pt box), so costs line up across a row.
            <Text style={{ fontSize: 13, lineHeight: 17.5, minHeight: 35, color: t.muted, marginTop: 3 }} numberOfLines={2}>
              {reward.description}
            </Text>
          ) : null}
          {reward.variants.length > 1 ? (
            <View accessibilityRole="radiogroup" accessibilityLabel={`${reward.title} options`} style={{ marginTop: 8 }}>
              {/* Chips wrap onto a second line rather than scrolling sideways, so every option stays
                  visible on a narrow card (the board's single row hid options at 375 pt). */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {reward.variants.map((v, i) => {
                  const on = i === selected;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setSelected(i)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, checked: on }}
                      aria-checked={on}
                      hitSlop={{ top: 11, bottom: 11, left: 2, right: 2 }}
                      style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderColor: t.accent, backgroundColor: on ? t.accent : 'transparent' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: on ? t.accentInk : t.accent }}>{v.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {/* Rows share one height: the cost and Redeem Now sit at the bottom of the card. */}
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
            <Text style={[bentoType.number, { fontSize: 18, color: t.ink }]}>{variant.cost.toLocaleString()}</Text>
            <Text style={{ fontSize: 12, fontWeight: '500', color: t.muted }}>FC</Text>
          </View>
          <PressableScale
            onPress={() => onRedeem(variant.id)}
            accessibilityRole="button"
            accessibilityLabel={`Redeem ${reward.title}${variant.label !== 'Standard' ? ` ${variant.label}` : ''}`}
            style={{ minHeight: 40, marginTop: 10, borderRadius: 999, backgroundColor: bentoBrand.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: bentoBrand.fairway }}>Redeem Now</Text>
            <BentoIcon name="arrowUpRight" size={15} color={bentoBrand.fairway} strokeWidth={2} />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}
