import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { HeaderAvatar } from '../../components/common/HeaderAvatar';
import { PillButton } from '../../components/common/PillButton';
import { FadeIn, PressableScale } from '../../components/motion';
import { api } from '../../api/client';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { GolfStatsDto } from '../../golf/dto';
import { formatIndex, formatWhole } from '../../golf/scoring';
import { handicapPoints } from '../../golf/stats';
import type { StatsPeriod } from '../../data/types';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'MyGolf'>, NativeStackScreenProps<RootStackParamList>>;

const PERIODS: StatsPeriod[] = ['month', 'year', 'all'];
const PERIOD_LABELS: Record<StatsPeriod, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIOD_TEXT: Record<StatsPeriod, string> = { month: 'this month', year: 'this year', all: 'in total' };
const fmt1 = (x: number) => x.toFixed(1);
const sign = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const dShort = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

// My Golf: how the member is playing, worked out (by the API) only from the
// rounds they've finished in the Course tab — at home or away.
export function MyGolfScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [period, setPeriod] = useState<StatsPeriod>('year');
  const [data, setData] = useState<GolfStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tip, setTip] = useState<number | null>(null);

  const load = useCallback(async (p: StatsPeriod) => {
    try {
      setData(await api.golfStats(p));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your stats.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period]),
  );

  const s = data?.stats;
  const par18 = s?.basis ? handicapPoints(s.basis) : 36;

  const header = (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <FlagrrLogo color="white" size={20} showTagline={false} />
          <Text style={styles.topBarTitle}>My Golf</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} accessibilityLabel="Profile">
          <HeaderAvatar size={32} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const comingSoon = data && data.totalRounds === 0 && !data.homeMapLive;
  const noRoundsYet = data && data.totalRounds === 0 && data.homeMapLive;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(period); setRefreshing(false); }} />}
      >
        <View style={styles.band}>
          <Text style={styles.bandTitle}>Your game</Text>
          <Text style={styles.bandSub}>From the scorecards you’ve kept in Flagrr</Text>
        </View>

        {!data && !error ? <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl + spacing.md }} /> : null}
        {error ? (
          <View style={[styles.card, styles.lift]}>
            <Text style={styles.body}>{error}</Text>
            <PillButton label="Try again" onPress={() => load(period)} variant="outline" />
          </View>
        ) : null}

        {comingSoon ? (
          <FadeIn style={[styles.cup, styles.lift]}>
            <View style={styles.soonChip}>
              <Text style={styles.soonChipText}>Coming soon</Text>
            </View>
            <Text style={styles.cupTitle}>My Golf</Text>
            <Text style={styles.cupBody}>
              {data!.clubName ? `${data!.clubName}’s course map is on its way.` : 'Your club’s course map is on its way.'} Once you’ve kept a scorecard on a
              Flagrr course map, your Stableford average, scoring by par, toughest holes and more appear here.
            </Text>
            {data!.anyCourseLive ? <PillButton label="Play an away course" onPress={() => navigation.navigate('Course')} variant="primary" /> : null}
          </FadeIn>
        ) : null}

        {noRoundsYet ? (
          <FadeIn style={[styles.card, styles.lift]}>
            <Text style={styles.cardTitle}>Play your first round</Text>
            <Text style={styles.body}>Keep your scorecard in the Course tab and your stats appear here when you finish.</Text>
            <PillButton label="Go to Course" onPress={() => navigation.navigate('Course')} />
          </FadeIn>
        ) : null}

        {data && s && data.totalRounds > 0 ? (
          <>
            <FadeIn style={[styles.hero, styles.lift]}>
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroSmall}>Stableford average</Text>
                  <Text style={styles.heroBig}>
                    {s.pointsAverage == null ? '–' : fmt1(s.pointsAverage)}
                    <Text style={styles.heroUnit}> pts</Text>
                  </Text>
                  <Text style={styles.heroSmall}>
                    {s.basisRounds
                      ? `${s.basisRounds} ${s.basis}-hole round${s.basisRounds === 1 ? '' : 's'} ${PERIOD_TEXT[period]}`
                      : `No rounds ${PERIOD_TEXT[period]}`}
                  </Text>
                </View>
                <View style={styles.hcpPill}>
                  <Text style={styles.heroSmall}>Handicap Index</Text>
                  <Text style={styles.hcpVal}>{data.handicapIndex == null ? '–' : formatIndex(data.handicapIndex)}</Text>
                  <Text style={styles.heroSmall}>as entered</Text>
                </View>
              </View>
              <View style={styles.heroRow}>
                <View style={styles.heroCell}>
                  <Text style={styles.heroCellVal}>{s.basisRounds ? `${s.playedToHandicap} of ${s.basisRounds}` : '–'}</Text>
                  <Text style={styles.heroCellLabel}>played to handicap ({par18}+ pts)</Text>
                </View>
                <View style={styles.heroCell}>
                  <Text style={styles.heroCellVal}>{s.bestPoints ? `${s.bestPoints.points} pts` : '–'}</Text>
                  <Text style={styles.heroCellLabel}>{s.bestPoints ? `best · ${dShort(s.bestPoints.completedAt)}` : 'best round'}</Text>
                </View>
              </View>
            </FadeIn>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Stats</Text>
              <View style={styles.period} accessibilityRole="radiogroup">
                {PERIODS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setTip(null);
                      setPeriod(p);
                    }}
                    style={[styles.periodBtn, period === p && styles.periodBtnOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: period === p }}
                  >
                    <Text style={[styles.periodText, period === p && styles.periodTextOn]}>{PERIOD_LABELS[p]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {s.rounds === 0 ? (
              <Text style={styles.empty}>No rounds {PERIOD_TEXT[period]}. Pick Year or All to see earlier rounds.</Text>
            ) : (
              <>
                <View style={styles.tiles}>
                  <Tile styles={styles} label="Rounds" value={String(s.rounds)} sub={`${s.holesPlayed} holes`} />
                  <Tile styles={styles} label="Scoring average" value={s.scoringAverage == null ? '–' : fmt1(s.scoringAverage)} sub={`handicap score, ${s.basis} holes`} />
                  <Tile styles={styles} label="Best score" value={s.bestGross ? String(s.bestGross.gross) : '–'} sub={s.bestGross ? dShort(s.bestGross.completedAt) : 'no round without a pick-up'} />
                  <Tile styles={styles} label="Doubles or worse" value={s.mixPer18 ? fmt1(s.mixPer18.doubleOrWorse) : '–'} sub="per 18 holes" />
                </View>

                {s.pointsTrend.length ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Points per round</Text>
                    <Text style={styles.sub}>
                      Stableford, {s.pointsTrend.length >= 20 ? 'your last 20 rounds' : 'oldest to newest'}. The line at {par18} is playing to your handicap.
                    </Text>
                    <PointsChart data={s.pointsTrend} refLine={par18} colors={colors} tip={tip} onTip={setTip} />
                    {tip != null && s.pointsTrend[tip] ? (
                      <Text style={styles.tip}>
                        {s.pointsTrend[tip].points} pts{s.pointsTrend[tip].gross != null ? ` · ${s.pointsTrend[tip].gross} gross` : ''} · {dShort(s.pointsTrend[tip].completedAt)} · {s.pointsTrend[tip].courseName}
                      </Text>
                    ) : (
                      <Text style={styles.tipHint}>Tap a column for that round.</Text>
                    )}
                  </View>
                ) : null}

                {s.parAverages.length ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Average score by par</Text>
                    <Text style={styles.sub}>Strokes per hole, with pick-ups counted as net double bogey</Text>
                    {s.parAverages.map((p) => (
                      <View key={p.par} style={styles.parRow}>
                        <Text style={styles.parLabel}>Par {p.par}</Text>
                        <View style={styles.track}>
                          <View style={[styles.fill, { width: `${Math.min(100, (Math.max(0, p.average - p.par) / 2) * 100)}%` }]} />
                        </View>
                        <Text style={styles.parVal}>
                          <Text style={styles.bold}>{p.average.toFixed(2)}</Text> <Text style={styles.muted}>{sign(p.average - p.par)}</Text>
                        </Text>
                      </View>
                    ))}
                    {(() => {
                      const worst = s.parAverages.reduce((a, b) => (b.overParPerRound > a.overParPerRound ? b : a));
                      return worst.overParPerRound > 0 ? (
                        <Text style={styles.insight}>
                          Par {worst.par}s cost you the most: <Text style={styles.bold}>{fmt1(worst.overParPerRound)} shots a round</Text> over par.
                        </Text>
                      ) : null;
                    })()}
                  </View>
                ) : null}

                {s.mixPer18 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Score mix</Text>
                    <Text style={styles.sub}>Holes per 18</Text>
                    <MixBar mix={s.mixPer18} colors={colors} styles={styles} />
                    {s.doubleCostPer18 ? (
                      <Text style={styles.insight}>
                        Doubles cost you <Text style={styles.bold}>{fmt1(s.doubleCostPer18)} shots per 18</Text> more than bogeys would. Turning half of them into
                        bogeys is worth about {fmt1(s.doubleCostPer18 / 2)} shots.
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {s.toughestHoles ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Your toughest holes</Text>
                    <Text style={styles.sub}>
                      At {s.toughestHoles.courseName} · {s.toughestHoles.rounds} rounds
                    </Text>
                    {s.toughestHoles.holes.map((hh, i) => (
                      <View key={hh.n} style={[styles.holeRow, i > 0 && styles.rowSep]}>
                        <View style={styles.holeNo}>
                          <Text style={styles.holeNoText}>{hh.n}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>
                            Par {hh.par} · Stroke index {hh.si}
                          </Text>
                          <Text style={styles.rowSub}>{fmt1(hh.points)} points on average</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.rowTitle}>{sign(hh.overPar)}</Text>
                          <Text style={styles.rowSub}>avg over par</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {s.nines ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Front nine and back nine</Text>
                    <View style={styles.nines}>
                      <View style={styles.nine}>
                        <Text style={styles.rowSub}>Front nine</Text>
                        <Text style={styles.nineVal}>{fmt1(s.nines.front)}</Text>
                      </View>
                      <View style={styles.nine}>
                        <Text style={styles.rowSub}>Back nine</Text>
                        <Text style={styles.nineVal}>{fmt1(s.nines.back)}</Text>
                      </View>
                    </View>
                    <Text style={styles.insight}>
                      {Math.abs(s.nines.front - s.nines.back) < 0.5 ? (
                        'You score about the same on both nines.'
                      ) : (
                        <>
                          You average <Text style={styles.bold}>{fmt1(Math.abs(s.nines.front - s.nines.back))} more on the {s.nines.front > s.nines.back ? 'front' : 'back'} nine</Text>
                          {s.nines.front > s.nines.back ? '. A proper warm-up could help.' : '. Watch for fatigue and a slipping routine late in the round.'}
                        </>
                      )}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Putting and ball striking</Text>
                  {s.putting ? (
                    <>
                      <Text style={styles.sub}>From the {s.putting.holes} holes where you entered putts</Text>
                      <View style={styles.statGrid}>
                        <Stat styles={styles} label="Putts" value={fmt1(s.putting.puttsPer18)} sub="per 18 holes" />
                        <Stat styles={styles} label="Three-putts" value={fmt1(s.putting.threePuttsPer18)} sub="per 18 holes" />
                        <Stat styles={styles} label="Greens in reg." value={`${Math.round(s.putting.girPct)}%`} sub="of holes" />
                        <Stat
                          styles={styles}
                          label="Fairways"
                          value={s.putting.fairwayPct == null ? '–' : `${Math.round(s.putting.fairwayPct)}%`}
                          sub={
                            s.putting.fairwayPct == null
                              ? 'enter fairways on par 4s and 5s'
                              : `missed ${Math.round(s.putting.missLeftPct ?? 0)}% left · ${Math.round(s.putting.missRightPct ?? 0)}% right`
                          }
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.sub}>Turn on “Putts and fairways” when you start a round to unlock these</Text>
                      <View style={styles.locked}>
                        {['Putts', 'Fairways', 'Greens in reg.'].map((l) => (
                          <View key={l} style={styles.lockedCell}>
                            <Text style={styles.rowSub}>{l}</Text>
                            <Text style={[styles.nineVal, styles.muted]}>–</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Recent rounds</Text>
                  {s.recent.slice(0, 8).map((r, i) => (
                    <PressableScale key={r.id} style={[styles.roundRow, i > 0 && styles.rowSep]} onPress={() => navigation.navigate('RoundDetail', { roundId: r.id })} accessibilityRole="button">
                      <View style={styles.date}>
                        <Text style={styles.dateDay}>{new Date(r.completedAt).getDate()}</Text>
                        <Text style={styles.dateMonth}>{new Date(r.completedAt).toLocaleDateString('en-ZA', { month: 'short' })}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {r.courseName}
                          {r.isBest ? '  ' : ''}
                          {r.isBest ? <Text style={styles.pb}> BEST </Text> : null}
                        </Text>
                        <View style={styles.teeLine}>
                          <View style={[styles.teeDot, { backgroundColor: r.teeColor }]} />
                          <Text style={styles.rowSub} numberOfLines={1}>
                            {r.teeName} tees · {r.holeCount === 18 ? '18 holes' : `holes ${r.firstHole}–${r.firstHole + r.holeCount - 1}`}
                            {r.playingHandicap != null ? ` · playing ${formatWhole(r.playingHandicap)}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.rowTitle}>{r.points} pts</Text>
                        <Text style={styles.rowSub}>{r.gross != null ? `${r.gross} gross` : `${r.adjusted} adj.`}</Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Tile({ styles, label, value, sub }: { styles: ReturnType<typeof createStyles>; label: string; value: string; sub: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.rowSub}>{label}</Text>
      <Text style={styles.tileVal}>{value}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

function Stat({ styles, label, value, sub }: { styles: ReturnType<typeof createStyles>; label: string; value: string; sub: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.rowSub}>{label}</Text>
      <Text style={styles.nineVal}>{value}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

function MixBar({ mix, colors, styles }: { mix: NonNullable<GolfStatsDto['stats']['mixPer18']>; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  // Four categorical colours from the brand-neutral chart palette, ordered best to worst.
  const parts = [
    { name: 'Birdie or better', v: mix.birdieOrBetter, c: '#2a78d6' },
    { name: 'Par', v: mix.par, c: '#1baf7a' },
    { name: 'Bogey', v: mix.bogey, c: '#eda100' },
    { name: 'Double+', v: mix.doubleOrWorse, c: '#e87ba4' },
  ];
  return (
    <>
      <View style={styles.mixBar} accessibilityLabel={parts.map((p) => `${p.name} ${fmt1(p.v)}`).join(', ')}>
        {parts.filter((p) => p.v > 0).map((p) => (
          <View key={p.name} style={{ flex: p.v, backgroundColor: p.c, height: '100%' }} />
        ))}
      </View>
      <View style={styles.mixLegend}>
        {parts.map((p) => (
          <View key={p.name} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: p.c }} />
              <Text style={[styles.tileSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
            <Text style={styles.nineVal}>{fmt1(p.v)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function PointsChart({
  data,
  refLine,
  colors,
  tip,
  onTip,
}: {
  data: GolfStatsDto['stats']['pointsTrend'];
  refLine: number;
  colors: ThemeColors;
  tip: number | null;
  onTip: (i: number | null) => void;
}) {
  const [W, setW] = useState(0);
  const H = 150;
  const m = { l: 24, r: 6, t: 12, b: 20 };
  const iw = Math.max(1, W - m.l - m.r);
  const ih = H - m.t - m.b;
  const yMax = Math.max(refLine + 9, ...data.map((d) => d.points + 2));
  const y = (v: number) => m.t + ih - (v / yMax) * ih;
  const slot = iw / data.length;
  const bw = Math.min(24, Math.max(6, slot * 0.62));
  const best = data.reduce((a, b, i) => (b.points > data[a].points ? i : a), 0);
  const ticks = [0, 10, 20, 30, 40].filter((v) => v <= yMax);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel={`Stableford points for ${data.length} rounds`}>
      {W > 0 ? (
        <Svg width={W} height={H}>
          {ticks.map((v) => (
            <React.Fragment key={v}>
              <Line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={m.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fontFamily={fontFamily.body} fill={colors.textMuted}>
                {v}
              </SvgText>
            </React.Fragment>
          ))}
          {data.map((d, i) => {
            const x = m.l + slot * i + (slot - bw) / 2;
            const top = y(d.points);
            const h = m.t + ih - top;
            const rad = Math.min(4, h / 2);
            return (
              <Path
                key={d.id}
                d={`M${x} ${m.t + ih}V${top + rad}Q${x} ${top} ${x + rad} ${top}H${x + bw - rad}Q${x + bw} ${top} ${x + bw} ${top + rad}V${m.t + ih}Z`}
                fill={tip === i ? colors.darkGreen : colors.clubGreen}
              />
            );
          })}
          <Line x1={m.l} x2={W - m.r} y1={y(refLine)} y2={y(refLine)} stroke={colors.textSecondary} strokeWidth={1} />
          <SvgText
            x={Math.min(Math.max(m.l + slot * best + slot / 2, m.l + 30), W - 40)}
            y={y(data[best].points) - 5}
            textAnchor="middle"
            fontSize={10}
            fontFamily={fontFamily.bodySemiBold}
            fill={colors.textPrimary}
          >
            {data[best].points}
          </SvgText>
          <SvgText x={m.l} y={H - 4} fontSize={10} fontFamily={fontFamily.body} fill={colors.textMuted}>
            {dShort(data[0].completedAt)}
          </SvgText>
          <SvgText x={W - m.r} y={H - 4} textAnchor="end" fontSize={10} fontFamily={fontFamily.body} fill={colors.textMuted}>
            {dShort(data[data.length - 1].completedAt)}
          </SvgText>
          {data.map((d, i) => (
            <Rect key={`hit${d.id}`} x={m.l + slot * i} y={m.t} width={slot} height={ih} fill="transparent" onPress={() => onTip(tip === i ? null : i)} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    safeArea: { backgroundColor: colors.clubGreen },
    topBar: { height: 62, backgroundColor: colors.clubGreen, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: screenPadding },
    topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    topBarTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
    scroll: { paddingBottom: 124, gap: spacing.sm + 4 },
    band: { backgroundColor: colors.clubGreen, paddingHorizontal: screenPadding, paddingTop: 4, paddingBottom: spacing.xxl - 4 },
    bandTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
    bandSub: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    lift: { marginTop: -spacing.xl - spacing.sm },
    body: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    hero: { backgroundColor: colors.darkGreen, marginHorizontal: spacing.md, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm + 4 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm + 4 },
    heroSmall: { fontFamily: fontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
    heroBig: { fontFamily: fontFamily.heading, fontSize: 40, lineHeight: 46, color: colors.white },
    heroUnit: { fontFamily: fontFamily.bodyMedium, fontSize: 14, color: 'rgba(255,255,255,0.75)' },
    hcpPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'flex-end', alignSelf: 'flex-start' },
    hcpVal: { fontFamily: fontFamily.bodySemiBold, fontSize: 18, color: colors.lime },
    heroRow: { flexDirection: 'row', gap: spacing.sm },
    heroCell: { flex: 1, backgroundColor: colors.clubGreen, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
    heroCellVal: { fontFamily: fontFamily.bodySemiBold, fontSize: 15, color: colors.white },
    heroCellLabel: { fontFamily: fontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: screenPadding - 4, paddingTop: spacing.sm, gap: spacing.sm },
    sectionTitle: { fontFamily: fontFamily.heading, fontSize: 21, color: colors.textPrimary },
    period: { flexDirection: 'row', backgroundColor: colors.mintBg, borderRadius: radius.pill, padding: 3 },
    periodBtn: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
    periodBtnOn: { backgroundColor: colors.clubGreen },
    periodText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.clubGreen },
    periodTextOn: { color: colors.white },
    empty: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, marginHorizontal: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, textAlign: 'center' },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: spacing.md },
    tile: { width: '47%', flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
    tileVal: { fontFamily: fontFamily.bodySemiBold, fontSize: 22, color: colors.textPrimary },
    tileSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textSecondary },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginHorizontal: spacing.md, padding: 14, gap: 8, backgroundColor: colors.surface },
    cardTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: 14.5, color: colors.textPrimary },
    sub: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, marginTop: -6 },
    tip: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.textPrimary },
    tipHint: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted },
    insight: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textSecondary, backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, lineHeight: 18 },
    bold: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
    muted: { color: colors.textMuted },
    parRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    parLabel: { width: 44, fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textPrimary },
    track: { flex: 1, height: 14, borderRadius: 4, backgroundColor: colors.inputBg, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: colors.clubGreen, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
    parVal: { width: 86, textAlign: 'right', fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textPrimary },
    mixBar: { flexDirection: 'row', gap: 2, height: 18, borderRadius: 4, overflow: 'hidden' },
    mixLegend: { flexDirection: 'row', gap: 4 },
    holeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    rowSep: { borderTopWidth: 1, borderTopColor: colors.border },
    holeNo: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
    holeNoText: { fontFamily: fontFamily.headingBold, fontSize: 15, color: colors.lime },
    rowTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.textPrimary },
    rowSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textMuted },
    nines: { flexDirection: 'row', gap: 10 },
    nine: { flex: 1, backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
    nineVal: { fontFamily: fontFamily.bodySemiBold, fontSize: 18, color: colors.textPrimary },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statCell: { width: '47%', flexGrow: 1, backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
    locked: { flexDirection: 'row', gap: 8 },
    lockedCell: { flex: 1, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
    roundRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
    date: { width: 44, alignItems: 'center', backgroundColor: colors.mintBgAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 4 },
    dateDay: { fontFamily: fontFamily.bodySemiBold, fontSize: 15, color: colors.textPrimary, lineHeight: 18 },
    dateMonth: { fontFamily: fontFamily.body, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textMuted },
    pb: { fontFamily: fontFamily.bodySemiBold, fontSize: 9.5, letterSpacing: 0.5, backgroundColor: colors.lime, color: colors.darkGreen, borderRadius: 10, overflow: 'hidden' },
    teeLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    teeDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.3)' },
    cup: { backgroundColor: colors.darkGreen, marginHorizontal: spacing.md, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
    soonChip: { alignSelf: 'flex-start', backgroundColor: colors.lime, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
    soonChipText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.darkGreen },
    cupTitle: { fontFamily: fontFamily.heading, fontSize: 20, color: colors.white },
    cupBody: { fontFamily: fontFamily.body, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 19 },
  });
}
