import React from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { memberTiers } from '../../data/mockData';
import { bentoBrand, bentoType } from '../../theme/bento';
import { Appear, BentoIcon, BentoScreen, BentoTile, CountUp, FillBar, StatusPill } from '../../components/bento';
import type { TierName } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberTiers'>;

// Owner-approved wording (25 Nov 2026): tiers qualify on Flagrr Cash earned per calendar
// quarter (api/_lib/tiers.ts); bonuses: api/_lib/streakRewards.ts, tierRewards.ts, referrals.ts.
const STEPS = [
  { number: '01', title: 'Scan', body: 'Scan your receipts from your club.' },
  { number: '02', title: 'Earn', body: 'Every receipt earns Flagrr Cash, plus bonuses for streaks, birthdays and referrals.' },
  { number: '03', title: 'Upgrade', body: 'Earn enough this quarter to move up a tier and earn more on your receipts.' },
];

// Tier multipliers for the badges and the balance card: the ones the server applies
// (api/_lib/tiers.ts TIER_MULTIPLIERS). The perk lines are memberTiers' perks
// (data/mockData.ts), worded per the owner's decision of 24 Nov 2026: keep the
// multiplier, drop rands.
const MULTIPLIER: Record<TierName, number> = { Bronze: 1, Silver: 1.2, Gold: 1.5, Platinum: 1.7 };
// Tier badge fills, copied from the AppTiers boards (the same in light and dark).
// Darker than the brand kit's tier marks so the white multiplier stays readable.
const TIER_FILL: Record<TierName, string> = { Bronze: '#A0693A', Silver: '#8E9894', Gold: '#B8862E', Platinum: '#5C625E' };

export function MemberTiersScreen({ navigation }: Props) {
  const { t } = useBento();
  const { user, points } = useApp();
  const topTier = points.nextTier === null;
  const next = memberTiers.find((x) => x.name === points.nextTier) ?? null;
  // Flagrr Cash earned this quarter. The server qualifies tiers on FC earned per
  // calendar quarter and sends pointsToNextTier = next threshold − earned this quarter
  // (api/_lib/tiers.ts), so this is exact for a verified member below the top tier.
  // An unverified member is held at Bronze whatever they earn, so it isn't shown then.
  const quarterEarned = next && user.verifiedMember ? Math.max(0, next.minPoints - points.pointsToNextTier) : null;

  return (
    <BentoScreen title="Member Tiers" onBack={() => navigation.goBack()}>
      <View style={{ height: 4 }} />

      {/* Balance and tier */}
      <Appear>
        <BentoTile tone="hero" padding={18}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 14, color: t.onHeroMuted }}>Flagrr Cash</Text>
              <CountUp
                value={points.balance}
                accessibilityLabel={`${points.balance.toLocaleString()} Flagrr Cash`}
                style={[bentoType.number, { fontSize: 40, lineHeight: 42, color: t.onHero, marginTop: 6 }]}
              />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[bentoType.number, { fontSize: 24, lineHeight: 28, color: bentoBrand.lime }]}>{user.tier}</Text>
              {MULTIPLIER[user.tier] ? <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>earning ×{MULTIPLIER[user.tier]}</Text> : null}
            </View>
          </View>
        </BentoTile>
      </Appear>

      {!user.verifiedMember ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: t.warnBg }}>
          <BentoIcon name="info" size={18} color={t.warnInk} strokeWidth={1.8} />
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: t.warnInk }}>
            Your club hasn't verified your membership yet, so tier progress is on hold — you can still earn and redeem Flagrr Cash as normal. Ask your golf club to add you to their member list.
          </Text>
        </View>
      ) : null}

      {/* Quarterly progress to the next tier, then the three steps */}
      <Appear>
        <BentoTile padding={18}>
          <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>
            How to Reach the Next Tier
          </Text>
          <Text style={[bentoType.number, { fontSize: 26, lineHeight: 30, letterSpacing: -0.025 * 26, color: t.ink, marginTop: 10 }]}>
            {topTier ? 'You’ve reached the top tier' : `${points.pointsToNextTier.toLocaleString()} FC to ${points.nextTier}`}
          </Text>
          {quarterEarned !== null ? <Text style={{ fontSize: 14, lineHeight: 20, color: t.muted, marginTop: 4 }}>Earn it before this quarter ends.</Text> : null}
          <FillBar
            progress={topTier ? 1 : points.tierProgress}
            color={t.accent}
            track={t.track}
            height={10}
            style={{ marginTop: quarterEarned !== null ? 16 : 14 }}
            accessibilityLabel="Tier progress"
          />
          {quarterEarned !== null && next ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: t.muted }}>{quarterEarned.toLocaleString()} FC this quarter</Text>
              <Text style={{ fontSize: 13, color: t.muted }}>{next.minPoints.toLocaleString()}</Text>
            </View>
          ) : null}
          <View style={{ marginTop: 16 }}>
            {STEPS.map((s) => (
              <View key={s.number} style={{ flexDirection: 'row', gap: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.hair }}>
                <Text style={[bentoType.number, { fontSize: 20, lineHeight: 24, letterSpacing: -0.5, color: t.accent, width: 30 }]}>{s.number}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{s.title}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: t.muted, marginTop: 2 }}>{s.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </BentoTile>
      </Appear>

      {/* All four tiers as rows (owner decision 24 Nov 2026: the board's layout replaces the tier tabs). */}
      <Appear>
        <BentoTile padding={0} innerStyle={{ paddingTop: 4, paddingBottom: 4, paddingHorizontal: 16 }}>
          <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', color: t.ink, paddingTop: 14 }}>
            Tier Benefits
          </Text>
          {memberTiers.map((tier, i) => {
            const current = tier.name === user.tier;
            const isNext = tier.name === points.nextTier;
            return (
              <View
                key={tier.name}
                testID={`tier-${tier.name}`}
                style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: t.hair }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    backgroundColor: TIER_FILL[tier.name],
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: bentoType.number.fontFamily, fontSize: 14, color: '#FFFFFF' }}>
                    ×{MULTIPLIER[tier.name]}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>{tier.name}</Text>
                    {current ? <StatusPill label="Current" tone="accent" /> : isNext ? <StatusPill label="Next" tone="muted" /> : null}
                  </View>
                  <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                    {tier.minPoints === 0 ? 'From 0 FC' : `From ${tier.minPoints.toLocaleString()} FC a quarter`}
                  </Text>
                  {tier.perks.map((perk, j) => (
                    <Text key={perk} style={{ fontSize: 14, lineHeight: 19, color: t.ink, marginTop: j === 0 ? 4 : 2 }}>
                      {perk}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </BentoTile>
      </Appear>
    </BentoScreen>
  );
}
