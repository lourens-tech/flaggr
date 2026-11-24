import React, { useCallback, useState } from 'react';
import { RefreshControl, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types';
import { Appear, BentoButton, BentoScreen, BentoTile, BentoToggle, CountUp, EmptyState, Eyebrow, H1, SegmentedControl, StatusPill } from '../../components/bento';
import { GolfLoadError, GolfLoading } from '../../components/golf/GolfSheet';
import { PressableScale } from '../../components/motion';
import { api } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoType, type BentoTokens } from '../../theme/bento';
import type { GolfStatsDto } from '../../golf/dto';
import { formatIndex, formatWhole } from '../../golf/scoring';
import { handicapPoints } from '../../golf/stats';
import type { StatsPeriod } from '../../data/types';

type Props = StackScreenProps<RootStackParamList, 'MyGolf'>;

const PERIODS: StatsPeriod[] = ['month', 'year', 'all'];
const PERIOD_LABELS: Record<StatsPeriod, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIOD_TEXT: Record<StatsPeriod, string> = { month: 'this month', year: 'this year', all: 'in total' };
const fmt1 = (x: number) => x.toFixed(1);
const sign = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const dShort = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

// Fraunces numbers as on the boards (.fr: 700, -0.025em).
const fr = (size: number): TextStyle => ({ ...bentoType.number, fontSize: size, lineHeight: Math.round(size * 1.1), letterSpacing: -0.025 * size });

// My Golf: how the member is playing, worked out (by the API) only from the
// rounds they've finished in the Course tab — at home or away.
// Boards: AppMyGolf, AppMyGolfEmpty, G-D-MyGolf*.
export function MyGolfScreen({ navigation }: Props) {
  const { t, scheme } = useBento();
  const [period, setPeriod] = useState<StatsPeriod>('year');
  const [data, setData] = useState<GolfStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tip, setTip] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  // Whether the member's club sees their rounds on its course (the admin
  // Golf pages). Flips at once and goes back if the save fails.
  const setShare = async (on: boolean) => {
    if (!data || sharing) return;
    setSharing(true);
    setData({ ...data, shareWithClub: on });
    try {
      await api.saveGolfProfile({ shareWithClub: on });
    } catch (e) {
      setData((d) => (d ? { ...d, shareWithClub: !on } : d));
      showAlert('Couldn’t save that', friendlyError(e, 'Try again.'));
    } finally {
      setSharing(false);
    }
  };

  const load = useCallback(async (p: StatsPeriod) => {
    try {
      setData(await api.golfStats(p));
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not load your stats.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period]),
  );

  const s = data?.stats;
  const par18 = s?.basis ? handicapPoints(s.basis) : 36;

  const comingSoon = data && data.totalRounds === 0 && !data.homeMapLive;
  const noRoundsYet = data && data.totalRounds === 0 && data.homeMapLive;
  const hasRounds = Boolean(data && s && data.totalRounds > 0);
  const goToCourse = () => navigation.popTo('Main', { screen: 'Course' });

  const label13: TextStyle = { fontSize: 13, fontWeight: '600', color: t.ink };
  const sub12: TextStyle = { fontSize: 12, color: t.muted };
  const title16: TextStyle = { fontSize: 16, fontWeight: '600', color: t.ink };
  const mut13: TextStyle = { fontSize: 13, lineHeight: 19, color: t.muted };
  const insight: TextStyle = { fontSize: 14, lineHeight: 20, color: t.ink };
  const h2: TextStyle = { ...bentoType.number, fontSize: 22, lineHeight: 24, letterSpacing: -0.44, color: t.ink, marginTop: 4 };

  return (
    <BentoScreen
      tabBar
      onBack={() => navigation.goBack()}
      scrollTitle="My Golf"
      headerRight={
        hasRounds ? (
          <SegmentedControl
            value={period}
            onChange={(p) => {
              setTip(null);
              setPeriod(p);
            }}
            options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
            accessibilityLabel="Stats period"
          />
        ) : undefined
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(period);
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={{ height: 6 }} />
      <View>
        <Eyebrow>Your game</Eyebrow>
        <H1 style={{ marginTop: 6, fontSize: 36, lineHeight: Math.round(36 * 1.04), letterSpacing: -0.025 * 36 }}>My Golf</H1>
      </View>
      <Text style={{ fontSize: 14, color: t.muted, marginTop: -4, marginBottom: 4 }}>From the scorecards you’ve kept in Flagrr</Text>

      {!data && !error ? <GolfLoading /> : null}
      {error ? <GolfLoadError message={error} onRetry={() => load(period)} /> : null}

      {comingSoon ? (
        <Appear>
          <BentoTile padding={18}>
            <StatusPill label="Coming soon" tone="muted" />
            <Text style={[fr(22), { color: t.ink, marginTop: 10 }]}>My Golf</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: t.muted, marginTop: 6 }}>
              {data!.clubName ? `${data!.clubName}’s course map is on its way.` : 'Your club’s course map is on its way.'} Once you’ve kept a scorecard on a Flagrr course map, your Stableford average,
              scoring by par, toughest holes and more appear here.
            </Text>
            {data!.anyCourseLive ? <BentoButton label="Play an away course" nub compact onPress={goToCourse} style={{ marginTop: 14 }} /> : null}
          </BentoTile>
        </Appear>
      ) : null}

      {noRoundsYet ? (
        <Appear>
          <EmptyState
            icon="golfStatsBars"
            title="Play your first round"
            body="Keep your scorecard in the Course tab and your stats appear here when you finish."
            actionLabel="Go to Course"
            onAction={goToCourse}
          />
        </Appear>
      ) : null}

      {data && s && hasRounds ? (
        <>
          <Appear>
            <BentoTile tone="hero" padding={18}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontSize: 14, color: t.onHeroMuted }}>Stableford average</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                    <CountUp value={s.pointsAverage == null ? '–' : fmt1(s.pointsAverage)} style={[bentoType.number, { fontSize: 56, lineHeight: 58, letterSpacing: -1.4, color: '#FFFFFF' }]} />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#FFFFFF' }}>pts</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
                    {s.basisRounds ? `${s.basisRounds} ${s.basis}-hole round${s.basisRounds === 1 ? '' : 's'} ${PERIOD_TEXT[period]}` : `No rounds ${PERIOD_TEXT[period]}`}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Handicap Index</Text>
                  <Text style={[fr(26), { color: bentoBrand.lime, marginTop: 4 }]}>{data.handicapIndex == null ? '–' : formatIndex(data.handicapIndex)}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>as entered</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <HeroCell value={s.basisRounds ? `${s.playedToHandicap} of ${s.basisRounds}` : '–'} label={`played to handicap (${par18}+ pts)`} />
                <HeroCell value={s.bestPoints ? `${s.bestPoints.points} pts` : '–'} label={s.bestPoints ? `best · ${dShort(s.bestPoints.completedAt)}` : 'best round'} />
              </View>
              {s.rounds > 0 && s.pointsTrend.length ? (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginTop: 18 }}>Points per round</Text>
                  <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                    Stableford, {s.pointsTrend.length >= 20 ? 'your last 20 rounds' : 'oldest to newest'}. The line at {par18} is playing to your handicap.
                  </Text>
                  <PointsChart data={s.pointsTrend} refLine={par18} tip={tip} onTip={setTip} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{dShort(s.pointsTrend[0].completedAt)}</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{dShort(s.pointsTrend[s.pointsTrend.length - 1].completedAt)}</Text>
                  </View>
                  {tip != null && s.pointsTrend[tip] ? (
                    <Text style={{ fontSize: 13, fontWeight: '600', color: bentoBrand.lime, marginTop: 8 }}>
                      {s.pointsTrend[tip].points} pts{s.pointsTrend[tip].gross != null ? ` · ${s.pointsTrend[tip].gross} gross` : ''} · {dShort(s.pointsTrend[tip].completedAt)} · {s.pointsTrend[tip].courseName}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>Tap a column for that round.</Text>
                  )}
                </>
              ) : null}
            </BentoTile>
          </Appear>

          <Text accessibilityRole="header" style={h2}>
            Stats
          </Text>

          {s.rounds === 0 ? (
            <BentoTile>
              <Text style={insight}>No rounds {PERIOD_TEXT[period]}. Pick Year or All to see earlier rounds.</Text>
            </BentoTile>
          ) : (
            <>
              <Appear>
                <BentoTile>
                  <Grid2
                    t={t}
                    cells={[
                      { value: String(s.rounds), label: 'Rounds', sub: `${s.holesPlayed} holes` },
                      { value: s.scoringAverage == null ? '–' : fmt1(s.scoringAverage), label: 'Scoring average', sub: `handicap score, ${s.basis} holes` },
                      { value: s.bestGross ? String(s.bestGross.gross) : '–', label: 'Best score', sub: s.bestGross ? dShort(s.bestGross.completedAt) : 'no round without a pick-up' },
                      { value: s.mixPer18 ? fmt1(s.mixPer18.doubleOrWorse) : '–', label: 'Doubles or worse', sub: 'per 18 holes' },
                    ]}
                    labelStyle={label13}
                    subStyle={sub12}
                  />
                </BentoTile>
              </Appear>

              {s.parAverages.length ? (
                <Appear>
                  <BentoTile>
                    <Text style={title16}>Average score by par</Text>
                    <Text style={[mut13, { marginTop: 2, marginBottom: 8 }]}>Strokes per hole, with pick-ups counted as net double bogey</Text>
                    {s.parAverages.map((p) => (
                      <View key={p.par} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.hair }}>
                        <Text style={{ width: 44, fontSize: 14, fontWeight: '600', color: t.ink }}>Par {p.par}</Text>
                        <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: t.seg, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: `${Math.min(100, (Math.max(0, p.average - p.par) / 2) * 100)}%`, borderRadius: 5, backgroundColor: t.accent }} />
                        </View>
                        <Text style={{ width: 88, textAlign: 'right' }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: t.ink, fontVariant: ['tabular-nums'] }}>{p.average.toFixed(2)}</Text>
                          <Text style={{ fontSize: 13, color: t.muted, fontVariant: ['tabular-nums'] }}>{`  ${sign(p.average - p.par)}`}</Text>
                        </Text>
                      </View>
                    ))}
                    {(() => {
                      const worst = s.parAverages.reduce((a, b) => (b.overParPerRound > a.overParPerRound ? b : a));
                      return worst.overParPerRound > 0 ? (
                        <Text style={[insight, { marginTop: 10 }]}>
                          Par {worst.par}s cost you the most: {fmt1(worst.overParPerRound)} shots a round over par.
                        </Text>
                      ) : null;
                    })()}
                  </BentoTile>
                </Appear>
              ) : null}

              {s.mixPer18 ? (
                <Appear>
                  <BentoTile>
                    <MixCard mix={s.mixPer18} t={t} dark={scheme === 'dark'} />
                    {s.doubleCostPer18 ? (
                      <Text style={[insight, { marginTop: 12 }]}>
                        Doubles cost you {fmt1(s.doubleCostPer18)} shots per 18 more than bogeys would. Turning half of them into bogeys is worth about {fmt1(s.doubleCostPer18 / 2)} shots.
                      </Text>
                    ) : null}
                  </BentoTile>
                </Appear>
              ) : null}

              {s.toughestHoles ? (
                <Appear>
                  <BentoTile>
                    <Text style={title16}>Your toughest holes</Text>
                    <Text style={[mut13, { marginTop: 2, marginBottom: 6 }]}>
                      At {s.toughestHoles.courseName} · {s.toughestHoles.rounds} rounds
                    </Text>
                    {s.toughestHoles.holes.map((hh) => (
                      <View key={hh.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.hair }}>
                        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: t.seg, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={[fr(16), { color: t.ink }]}>{hh.n}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>
                            Par {hh.par} · Stroke index {hh.si}
                          </Text>
                          <Text style={mut13}>{fmt1(hh.points)} points on average</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: t.negative, fontVariant: ['tabular-nums'] }}>{sign(hh.overPar)}</Text>
                          <Text style={sub12}>avg over par</Text>
                        </View>
                      </View>
                    ))}
                  </BentoTile>
                </Appear>
              ) : null}

              {s.nines ? (
                <Appear>
                  <BentoTile>
                    <Text style={title16}>Front nine and back nine</Text>
                    <View style={{ flexDirection: 'row', marginTop: 10 }}>
                      <View style={{ flex: 1, paddingTop: 2, paddingBottom: 4 }}>
                        <Text style={[fr(26), { color: t.ink }]}>{fmt1(s.nines.front)}</Text>
                        <Text style={mut13}>Front nine</Text>
                      </View>
                      <View style={{ flex: 1, paddingTop: 2, paddingBottom: 4, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: t.hair }}>
                        <Text style={[fr(26), { color: t.ink }]}>{fmt1(s.nines.back)}</Text>
                        <Text style={mut13}>Back nine</Text>
                      </View>
                    </View>
                    <Text style={[insight, { marginTop: 10 }]}>
                      {Math.abs(s.nines.front - s.nines.back) < 0.5
                        ? 'You score about the same on both nines.'
                        : `You average ${fmt1(Math.abs(s.nines.front - s.nines.back))} more on the ${s.nines.front > s.nines.back ? 'front' : 'back'} nine${
                            s.nines.front > s.nines.back ? '. A proper warm-up could help.' : '. Watch for fatigue and a slipping routine late in the round.'
                          }`}
                    </Text>
                  </BentoTile>
                </Appear>
              ) : null}

              <Appear>
                <BentoTile>
                  <Text style={title16}>Putting and ball striking</Text>
                  {s.putting ? (
                    <>
                      <Text style={[mut13, { marginTop: 2, marginBottom: 10 }]}>From the {s.putting.holes} holes where you entered putts</Text>
                      <Grid2
                        t={t}
                        cells={[
                          { value: fmt1(s.putting.puttsPer18), label: 'Putts', sub: 'per 18 holes' },
                          { value: fmt1(s.putting.threePuttsPer18), label: 'Three-putts', sub: 'per 18 holes' },
                          { value: `${Math.round(s.putting.girPct)}%`, label: 'Greens in reg.', sub: 'of holes' },
                          {
                            value: s.putting.fairwayPct == null ? '–' : `${Math.round(s.putting.fairwayPct)}%`,
                            label: 'Fairways',
                            sub:
                              s.putting.fairwayPct == null
                                ? 'enter fairways on par 4s and 5s'
                                : `missed ${Math.round(s.putting.missLeftPct ?? 0)}% left · ${Math.round(s.putting.missRightPct ?? 0)}% right`,
                          },
                        ]}
                        labelStyle={label13}
                        subStyle={sub12}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={[mut13, { marginTop: 2 }]}>Turn on “Putts and fairways” when you start a round to unlock these</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        {['Putts', 'Fairways', 'Greens in reg.'].map((l) => (
                          <View key={l} style={{ flex: 1, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.hair, padding: 10, alignItems: 'center' }}>
                            <Text style={[fr(22), { color: t.muted }]}>–</Text>
                            <Text style={sub12}>{l}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </BentoTile>
              </Appear>

              <Text accessibilityRole="header" style={h2}>
                Recent rounds
              </Text>
              <Appear>
                <BentoTile padding={0}>
                  <View style={{ paddingHorizontal: 16 }}>
                    {s.recent.slice(0, 8).map((r, i) => (
                      <PressableScale
                        key={r.id}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}
                        onPress={() => navigation.navigate('RoundDetail', { roundId: r.id })}
                        accessibilityRole="button"
                      >
                        <View style={{ width: 44, height: 46, borderRadius: 13, backgroundColor: t.seg, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={[bentoType.number, { fontSize: 17, lineHeight: 18, color: t.ink }]}>{new Date(r.completedAt).getDate()}</Text>
                          <Text style={sub12}>{new Date(r.completedAt).toLocaleDateString('en-ZA', { month: 'short' })}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink, flexShrink: 1 }} numberOfLines={1}>
                              {r.courseName}
                            </Text>
                            {r.isBest ? (
                              <View style={{ marginLeft: 6, height: 20, paddingHorizontal: 9, borderRadius: 999, backgroundColor: bentoBrand.lime, justifyContent: 'center' }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: bentoBrand.fairway }}>BEST</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: r.teeColor, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.55)' }} />
                            <Text style={[mut13, { flexShrink: 1 }]}>
                              {r.teeName} tees · {r.holeCount === 18 ? '18 holes' : `holes ${r.firstHole}–${r.firstHole + r.holeCount - 1}`}
                              {r.playingHandicap != null ? ` · playing ${formatWhole(r.playingHandicap)}` : ''}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink, fontVariant: ['tabular-nums'] }}>{r.points} pts</Text>
                          <Text style={sub12}>{r.gross != null ? `${r.gross} gross` : `${r.adjusted} adj.`}</Text>
                        </View>
                      </PressableScale>
                    ))}
                  </View>
                </BentoTile>
              </Appear>
            </>
          )}
        </>
      ) : null}

      {data && !data.isPlaceholderClub ? (
        <Appear>
          <BentoTile>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>Share my rounds with {data.clubName || 'my club'}</Text>
                <Text style={[mut13, { marginTop: 4 }]}>
                  {data.shareWithClub
                    ? 'Your club can see the rounds you play on its course, your scorecards and the stats from them. Turn this off to keep them to yourself.'
                    : 'Your rounds are private. Your club can’t see your scorecards or golf stats.'}
                </Text>
              </View>
              <BentoToggle value={data.shareWithClub} onValueChange={setShare} disabled={sharing} accessibilityLabel={`Share my rounds with ${data.clubName || 'my club'}`} />
            </View>
          </BentoTile>
        </Appear>
      ) : null}
    </BentoScreen>
  );
}

function HeroCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text style={[fr(20), { color: '#FFFFFF' }]}>{value}</Text>
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

// Two-by-two stat grid (Stats and Putting tiles): a hairline between the columns.
function Grid2({
  t,
  cells,
  labelStyle,
  subStyle,
}: {
  t: BentoTokens;
  cells: Array<{ value: string; label: string; sub: string }>;
  labelStyle: TextStyle;
  subStyle: TextStyle;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {cells.map((c, i) => {
        const right = i % 2 === 1;
        const cell: ViewStyle = { width: '50%', paddingTop: i > 1 ? 14 : 2, paddingBottom: 4, paddingLeft: right ? 16 : 0, borderLeftWidth: right ? 1 : 0, borderLeftColor: t.hair };
        return (
          <View key={c.label} style={cell}>
            <CountUp value={c.value} style={[fr(26), { color: t.ink }]} />
            <Text style={labelStyle}>{c.label}</Text>
            <Text style={subStyle}>{c.sub}</Text>
          </View>
        );
      })}
    </View>
  );
}

function MixCard({ mix, t, dark }: { mix: NonNullable<GolfStatsDto['stats']['mixPer18']>; t: BentoTokens; dark: boolean }) {
  // Board colours (AppMyGolf light / dark), best to worst.
  const parts = [
    { name: 'Birdie or better', v: mix.birdieOrBetter, c: dark ? '#CDDE5C' : '#00704F' },
    { name: 'Par', v: mix.par, c: dark ? '#8FBF6A' : '#5FA36F' },
    { name: 'Bogey', v: mix.bogey, c: '#C9B36A' },
    { name: 'Double+', v: mix.doubleOrWorse, c: '#B5643F' },
  ];
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Score mix</Text>
        <Text style={{ fontSize: 13, color: t.muted }}>Holes per 18</Text>
      </View>
      <View
        accessibilityRole="image"
        accessibilityLabel={parts.map((p) => `${p.name} ${fmt1(p.v)}`).join(', ')}
        style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 12 }}
      >
        {parts
          .filter((p) => p.v > 0)
          .map((p) => (
            <View key={p.name} style={{ flex: p.v, backgroundColor: p.c, height: '100%' }} />
          ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 14, marginTop: 12 }}>
        {parts.map((p) => (
          <View key={p.name} style={{ width: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.c }} />
            <Text style={{ flex: 1, fontSize: 13, color: t.ink }} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: t.ink, fontVariant: ['tabular-nums'] }}>{fmt1(p.v)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// Points per round, drawn in the hero tile as on the boards: a bar per round
// (lime at or above the handicap line), faint lines every 10 points, the
// dashed line at playing-to-handicap, the best round labelled. Tap a column to
// see that round; tap it again to hide it.
const CHART_H = 120;
const LABEL_SPACE = 18;
const BAR_GAP = 4;
// Left gutter for the 0 / 10 / 20 / 30 / 40 values (kept from the earlier chart; not on the boards).
const AXIS_W = 20;

function PointsChart({
  data,
  refLine,
  tip,
  onTip,
}: {
  data: GolfStatsDto['stats']['pointsTrend'];
  refLine: number;
  tip: number | null;
  onTip: (i: number | null) => void;
}) {
  const [W, setW] = useState(0);
  const ih = CHART_H - LABEL_SPACE;
  const yMax = Math.max(refLine + 9, ...data.map((d) => d.points + 2));
  const y = (v: number) => CHART_H - (v / yMax) * ih;
  const plotW = Math.max(1, W - AXIS_W);
  const bw = Math.max(2, (plotW - BAR_GAP * (data.length - 1)) / data.length);
  const slot = bw + BAR_GAP;
  const bx = (i: number) => AXIS_W + i * slot;
  const best = data.reduce((a, b, i) => (b.points > data[a].points ? i : a), 0);
  const grid = [0, 10, 20, 30, 40].filter((v) => v < yMax);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel={`Stableford points for ${data.length} rounds`} style={{ height: CHART_H, marginTop: 10 }}>
      {W > 0 ? (
        <Svg width={W} height={CHART_H}>
          {grid.map((v) => (
            <React.Fragment key={v}>
              <Line x1={AXIS_W} x2={W} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
              <SvgText x={AXIS_W - 6} y={Math.min(y(v) + 3.5, CHART_H - 1)} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.6)">
                {v}
              </SvgText>
            </React.Fragment>
          ))}
          {data.map((d, i) => {
            const top = y(d.points);
            const h = Math.max(0, CHART_H - top);
            const fill = tip === i ? '#FFFFFF' : d.points >= refLine ? bentoBrand.lime : 'rgba(255,255,255,0.18)';
            return <Rect key={d.id} x={bx(i)} y={top} width={bw} height={h} rx={Math.min(5, bw / 2, h / 2)} fill={fill} />;
          })}
          <Line x1={AXIS_W} x2={W} y1={y(refLine)} y2={y(refLine)} stroke="rgba(205,222,92,0.75)" strokeWidth={1.5} strokeDasharray="4 3" />
          <SvgText
            x={Math.min(Math.max(bx(best) + bw / 2, AXIS_W + 10), W - 10)}
            y={y(data[best].points) - 5}
            textAnchor="middle"
            fontSize={12}
            fontWeight="700"
            fill="#FFFFFF"
          >
            {data[best].points}
          </SvgText>
          {data.map((d, i) => (
            <Rect key={`hit${d.id}`} x={bx(i) - BAR_GAP / 2} y={0} width={slot} height={CHART_H} fill="transparent" onPress={() => onTip(tip === i ? null : i)} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

