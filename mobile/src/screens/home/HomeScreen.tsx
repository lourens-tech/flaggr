import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/types';
import type { RootStackParamList } from '../../navigation/types';
import { AdSpace } from '../../components/common/AdSpace';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';
import { api } from '../../api/client';
import { holeResult, roundTotals } from '../../golf/scoring';
import type { RoundDto } from '../../golf/dto';
import type { Reward, StatsPeriod } from '../../data/types';
import { bentoBrand, bentoType } from '../../theme/bento';
import { PressableScale } from '../../components/motion';
import {
  Appear,
  BentoButton,
  BentoIcon,
  BentoScreen,
  BentoTile,
  CountUp,
  Eyebrow,
  GlassIconButton,
  H1,
  Parallax,
  Ring,
  SegmentedControl,
} from '../../components/bento';
import { BentoAvatar } from '../../components/bento/BentoAvatar';
import { BentoBarChart, compactNumber } from '../../components/bento/BentoBarChart';

const NOT_LISTED_POPUP_TITLE = "You're Almost In the Family";
const NOT_LISTED_POPUP_BODY =
  "We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen.";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const PERIOD_OPTIONS: Array<{ value: StatsPeriod; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];
// "All" has no prior window to compare against (see api/_lib/periods.ts),
// so its deltaPct is always forced to 0 server-side — show no delta at all
// there rather than a misleading "0%".
const DELTA_LABELS: Record<StatsPeriod, string> = { month: 'vs Last Month', year: 'vs Last Year', all: '' };

// Hero grid rows (Home board: two 168 pt rows, the Flagrr Cash hero spans
// both). Minimum heights, so larger text grows the tiles instead of clipping.
const ROW = 168;

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

function dateLine(now: Date) {
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const day = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  return `${weekday} · ${day}`;
}

// The in-progress round for the Resume tile: next hole to play, and points
// so far (same scoring module as the hole view).
function roundProgress(r: RoundDto) {
  const setup = {
    holes: r.holes,
    handicaps: r.courseHandicap == null || r.playingHandicap == null ? null : { course: r.courseHandicap, playing: r.playingHandicap },
  };
  const totals = roundTotals(setup, r.entries);
  const next = r.holes.findIndex((_, i) => !holeResult(setup, i, r.entries[i]).played);
  return { thru: totals.holesPlayed, points: totals.points, nextHole: next === -1 ? null : r.holes[next].n };
}

export function HomeScreen({ navigation }: Props) {
  const { t } = useBento();
  const { user, points, streak, stats, rewards, unreadNotificationCount, statsPeriod, setStatsPeriod } = useApp();
  const [inProgress, setInProgress] = useState<RoundDto | null>(null);
  const now = new Date();

  // Shows every second app open rather than every single one, so it's a
  // standing reminder without nagging on every launch — see RewardsShopScreen
  // for the same club, which shows it on every visit instead (there, the
  // alternative is a silently empty shop, which needs explaining every time).
  useEffect(() => {
    if (!user.id || !user.isPlaceholderClub) return;
    (async () => {
      const key = `flagrr_not_listed_popup_opens_${user.id}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        const openCount = (raw ? parseInt(raw, 10) : 0) + 1;
        await AsyncStorage.setItem(key, String(openCount));
        if (openCount % 2 === 1) {
          showAlert(NOT_LISTED_POPUP_TITLE, NOT_LISTED_POPUP_BODY, [
            { text: 'Contact Support', onPress: () => navigation.navigate('Contact') },
            { text: 'Close', style: 'cancel' },
          ]);
        }
      } catch {
        // Best-effort — skip the popup rather than blocking Home on a storage error.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.isPlaceholderClub]);

  // Resume round tile: the same read the Course tab makes. Best-effort; if it
  // fails, the tile offers the Course tab instead.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api
        .golfHome()
        .then((h) => {
          if (alive) setInProgress(h.inProgress);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const progress = inProgress ? roundProgress(inProgress) : null;
  const topTier = points.nextTier === null;
  const balanceSize = points.balance >= 100000 ? 30 : points.balance >= 10000 ? 38 : 42;
  // The tier gauge fills the hero tile's width (measured), between 96 and 148 pt.
  const [ringSize, setRingSize] = useState(132);
  const weeksLeft = Math.max(0, streak.nextMilestoneWeeks - streak.weeks);
  const streakSince =
    streak.weeks > 0
      ? `You've played every week since ${new Date(streak.activeSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
      : 'Play a round this week to start your streak';

  return (
    <BentoScreen tabBar scrollTitle="Home">
      {/* Greeting, date, notifications and avatar */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{dateLine(now)}</Eyebrow>
          <H1 style={{ marginTop: 6, fontSize: 36, lineHeight: 37 }}>
            {greeting(now)},{'\n'}
            {user.firstName}
          </H1>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}>
          <View>
            <GlassIconButton
              icon="bell"
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel={unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : 'Notifications'}
            />
            {unreadNotificationCount > 0 ? (
              <View pointerEvents="none" style={{ position: 'absolute', top: -4, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: bentoBrand.lime, alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px ${t.ground}` }}>
                <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 12, fontWeight: '700', color: bentoBrand.fairway }}>
                  {unreadNotificationCount}
                </Text>
              </View>
            ) : null}
          </View>
          <PressableScale onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Profile" hitSlop={2}>
            <BentoAvatar size={42} />
          </PressableScale>
        </View>
      </View>

      {!user.verifiedMember ? (
        <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.warnBg, marginTop: 6 }}>
          <BentoIcon name="info" size={18} color={t.warnInk} strokeWidth={1.8} />
          <Text style={[bentoType.body, { flex: 1, fontSize: 14, lineHeight: 20, color: t.warnInk }]}>
            Your club hasn't verified your membership yet — you can still earn Flagrr Cash, but tier progress is on hold.
          </Text>
        </View>
      ) : null}

      <View style={{ height: 10 }} />

      {/* Hero grid: Flagrr Cash (spans both rows) | Streak / Resume round */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Appear style={{ flex: 1.2 }}>
          <BentoTile tone="hero" style={{ flex: 1, minHeight: ROW * 2 + 12 }} innerStyle={{ justifyContent: 'space-between', gap: 12 }}>
            <View>
              <Text style={[bentoType.label, { fontWeight: '400', color: t.onHeroMuted }]}>Flagrr Cash</Text>
              <CountUp
                value={points.balance}
                accessibilityLabel={`${points.balance.toLocaleString()} Flagrr Cash`}
                style={[bentoType.number, { fontSize: balanceSize, lineHeight: balanceSize + 2, letterSpacing: -0.03 * balanceSize, color: t.onHero, marginTop: 10 }]}
              />
              <Text style={[bentoType.label, { fontWeight: '400', color: 'rgba(255,255,255,0.88)', marginTop: 6 }]}>
                <Text style={{ color: bentoBrand.lime, fontWeight: '600' }}>{user.tier}</Text> Member
              </Text>
            </View>
            {/* Tier gauge: as wide as the tile and centred (owner's choice, 24 Nov 2026), so the tile reads balanced. */}
            <View style={{ alignSelf: 'stretch', alignItems: 'center' }} onLayout={(e) => setRingSize(Math.max(96, Math.min(148, Math.floor(e.nativeEvent.layout.width))))}>
            <PressableScale
              onPress={() => navigation.navigate('MemberTiers')}
              accessibilityRole="button"
              accessibilityLabel={topTier ? `Member tiers: ${user.tier}, top tier` : `Member tiers: ${points.pointsToNextTier.toLocaleString()} to ${points.nextTier}`}
            >
              <Ring size={ringSize} stroke={9} progress={topTier ? 1 : points.tierProgress} color={bentoBrand.lime} track="rgba(255,255,255,0.14)">
                {topTier ? (
                  <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={[bentoType.number, { fontSize: 20, lineHeight: 22, color: t.onHero, textAlign: 'center' }]}>Top tier</Text>
                ) : (
                  <>
                    <Text style={[bentoType.number, { fontSize: 22, lineHeight: 24, color: t.onHero }]}>{points.pointsToNextTier < 100000 ? points.pointsToNextTier.toLocaleString() : compactNumber(points.pointsToNextTier)}</Text>
                    <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>
                      to {points.nextTier}
                    </Text>
                  </>
                )}
              </Ring>
            </PressableScale>
            </View>
            <BentoButton label="Redeem" variant="lime" nub compact onPress={() => navigation.navigate('Rewards')} accessibilityLabel="Redeem Flagrr Cash" />
          </BentoTile>
        </Appear>

        <View style={{ flex: 1, gap: 12 }}>
          <Appear style={{ flex: 1 }}>
            <BentoTile style={{ flex: 1, minHeight: ROW }} padding={15} innerStyle={{ justifyContent: 'space-between' }}>
              <View accessible accessibilityLabel={`${streak.weeks}-week streak. ${streakSince}.`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <BentoIcon name="flame" size={20} color={t.accent} strokeWidth={1.8} />
                <Text style={{ fontSize: 13, color: t.muted }}>Streak</Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <CountUp value={streak.weeks} style={[bentoType.number, { fontSize: 38, lineHeight: 40, color: t.ink }]} />
                  <Text style={{ fontSize: 15, color: t.muted }}>{streak.weeks === 1 ? 'week' : 'weeks'}</Text>
                </View>
                <View
                  accessibilityRole="image"
                  accessibilityLabel={`Played ${streak.weeksPlayed.filter(Boolean).length} of the last ${streak.weeksPlayed.length} weeks`}
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 9 }}
                >
                  {streak.weeksPlayed.map((played, i) => (
                    <View key={i} style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: played ? t.accent : t.dotOff }} />
                  ))}
                </View>
                <Text style={{ fontSize: 12, lineHeight: 16, color: t.muted, marginTop: 8 }}>
                  {weeksLeft} more week{weeksLeft === 1 ? '' : 's'} to a {streak.nextMilestoneAmount} FC bonus
                </Text>
              </View>
            </BentoTile>
          </Appear>

          <Appear style={{ flex: 1 }}>
            {inProgress && progress ? (
              <BentoTile
                tone="hero"
                style={{ flex: 1, minHeight: ROW }}
                padding={14}
                innerStyle={{ justifyContent: 'flex-end' }}
                onPress={() => navigation.navigate('CourseGuide', { roundId: inProgress.id })}
                accessibilityLabel={`Resume round at ${inProgress.courseName}${progress.nextHole ? `, hole ${progress.nextHole}` : ''}, ${progress.points} points thru ${progress.thru}`}
              >
                <View style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                  <BentoIcon name="arrowUpRight" size={17} color={bentoBrand.fairway} strokeWidth={2} />
                </View>
                <Text style={[bentoType.number, { fontFamily: 'Fraunces_600SemiBold', fontSize: 20, lineHeight: 23, color: t.onHero }]}>
                  {progress.nextHole ? `Hole ${progress.nextHole}` : 'All holes in'}
                </Text>
                <Text style={{ fontSize: 13, color: t.onHeroMuted, marginTop: 4 }}>
                  {progress.points} pts thru {progress.thru}
                </Text>
              </BentoTile>
            ) : (
              <BentoTile
                style={{ flex: 1, minHeight: ROW }}
                padding={14}
                innerStyle={{ justifyContent: 'space-between' }}
                onPress={() => navigation.navigate('Course')}
                accessibilityLabel="Play a round: open the Course tab"
              >
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <BentoIcon name="golfFlag" size={20} color={t.accent} strokeWidth={1.8} />
                </View>
                <View>
                  <Text style={[bentoType.number, { fontSize: 20, lineHeight: 21, letterSpacing: -0.5, color: t.ink }]}>Play a round</Text>
                  <Text style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Hole maps and your scorecard</Text>
                </View>
              </BentoTile>
            )}
          </Appear>
        </View>
      </View>

      {/* Your Club */}
      <Appear>
        <BentoTile padding={0} onPress={() => navigation.navigate('Profile')} accessibilityLabel={`Your Club: ${user.homeClub || 'Not specified'}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {user.courseLogoUrl ? (
                <Image source={{ uri: user.courseLogoUrl }} style={{ width: 40, height: 40 }} />
              ) : (
                <BentoIcon name="golfFlag" size={20} color={t.accent} strokeWidth={1.8} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>Your Club</Text>
              <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }} numberOfLines={2}>
                {user.homeClub || 'Not specified'}
              </Text>
            </View>
            <BentoIcon name="chevronRight" size={18} color={t.muted} />
          </View>
        </BentoTile>
      </Appear>

      {/* Ads never animate. */}
      <AdSpace placement="homeTop" style={{ marginTop: 6 }} />

      {/* My Stats */}
      <Appear style={{ marginTop: 6 }}>
        <BentoTile>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Text style={[bentoType.tileTitle, { color: t.ink }]}>My Stats</Text>
            <SegmentedControl value={statsPeriod} onChange={(p) => setStatsPeriod(p)} options={PERIOD_OPTIONS} accessibilityLabel="Stats period" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Stat value={stats.roundsPlayed9} label="Rounds (9 Holes)" delta={stats.roundsPlayed9DeltaPct} period={statsPeriod} pos={0} />
            <Stat value={stats.roundsPlayed18} label="Rounds (18 Holes)" delta={stats.roundsPlayed18DeltaPct} period={statsPeriod} pos={1} />
            <Stat value={stats.bucksEarned} label="Cash Earned" delta={stats.bucksEarnedDeltaPct} period={statsPeriod} pos={2} />
            <Stat value={stats.bucksRedeemed} label="Cash Redeemed" delta={stats.bucksRedeemedDeltaPct} period={statsPeriod} pos={3} />
          </View>
        </BentoTile>
      </Appear>

      {/* Points Earned Per Month, with the way into My Golf */}
      <Appear>
        <BentoTile>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: t.ink }}>Points Earned Per Month</Text>
            <Pressable onPress={() => navigation.navigate('MyGolf')} accessibilityRole="link" hitSlop={12}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: t.accent }}>My Golf</Text>
            </Pressable>
          </View>
          {stats.monthly.length ? (
            <BentoBarChart data={stats.monthly} />
          ) : (
            <Text style={{ fontSize: 14, color: t.muted }}>Scan a receipt to start your chart.</Text>
          )}
        </BentoTile>
      </Appear>

      <AdSpace placement="home" style={{ marginTop: 6 }} />

      {/* Rewards preview */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
        <Text accessibilityRole="header" style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 22, letterSpacing: -0.22, color: t.ink }}>
          Rewards
        </Text>
        <Pressable onPress={() => navigation.navigate('Rewards')} accessibilityRole="link" hitSlop={12}>
          <Text style={{ fontSize: 15, fontWeight: '500', color: t.accent }}>View All</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 12, paddingBottom: 4 }}>
        {rewards.slice(0, 5).map((reward) => (
          <RewardMini key={reward.id} reward={reward} onPress={() => navigation.navigate('Rewards')} />
        ))}
      </ScrollView>
    </BentoScreen>
  );
}

// One cell of the My Stats 2×2 grid, with hairlines between cells.
function Stat({ value, label, delta, period, pos }: { value: number; label: string; delta: number; period: StatsPeriod; pos: 0 | 1 | 2 | 3 }) {
  const { t } = useBento();
  const right = pos % 2 === 1;
  const bottom = pos >= 2;
  const showDelta = period !== 'all';
  const up = delta >= 0;
  return (
    <View
      style={{
        width: '50%',
        paddingTop: bottom ? 14 : 2,
        paddingBottom: 4,
        paddingLeft: right ? 16 : 0,
        paddingRight: right ? 0 : 8,
        borderLeftWidth: right ? 1 : 0,
        borderTopWidth: bottom ? 1 : 0,
        borderColor: t.hair,
      }}
    >
      <CountUp value={value} style={[bentoType.number, { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, lineHeight: 29, color: t.ink }]} />
      <Text style={{ fontSize: 13, color: t.muted, marginTop: 3 }}>{label}</Text>
      {showDelta ? (
        <Text style={{ fontSize: 12, fontWeight: '600', color: up ? t.accent : t.negative, marginTop: 3 }}>
          {up ? '+' : '−'}
          {Math.abs(delta)}% <Text style={{ fontWeight: '400', color: t.muted }}>{DELTA_LABELS[period]}</Text>
        </Text>
      ) : null}
    </View>
  );
}

// Reward card in the Home rail: photo, title and the first option's cost,
// as the previous card showed.
function RewardMini({ reward, onPress }: { reward: Reward; onPress: () => void }) {
  const { t } = useBento();
  const [failed, setFailed] = useState(false);
  const cost = reward.variants[0]?.cost;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${reward.title}${cost != null ? `, ${cost} Flagrr Cash` : ''}`} style={{ width: 200 }}>
      <View style={{ padding: 5, borderRadius: 24, backgroundColor: t.shell, boxShadow: `0 0 0 1px ${t.ring}, ${t.shadow}` }}>
        <View style={{ borderRadius: 19, overflow: 'hidden', backgroundColor: t.tile, boxShadow: t.insetHighlight }}>
          <View style={{ height: 112, backgroundColor: bentoBrand.fairway, alignItems: 'center', justifyContent: 'center' }}>
            {reward.imageUrl && !failed ? (
              <Parallax travel={8} style={{ position: 'absolute', top: -8, left: 0, right: 0, bottom: -8 }}>
                <Image source={{ uri: reward.imageUrl }} onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Parallax>
            ) : (
              <BentoIcon name="rewards" size={34} color={bentoBrand.lime} strokeWidth={1.5} />
            )}
          </View>
          <View style={{ paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }} numberOfLines={2}>
              {reward.title}
            </Text>
            {cost != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                <Text style={[bentoType.number, { fontSize: 17, color: t.ink }]}>{cost.toLocaleString()}</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: t.muted }}>Flagrr Cash</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}
