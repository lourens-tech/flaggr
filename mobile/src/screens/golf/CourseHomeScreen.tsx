import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { api } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoType } from '../../theme/bento';
import type { GolfCourseSummaryDto, GolfHomeDto, GolfStatsDto } from '../../golf/dto';
import { holeResult, roundTotals } from '../../golf/scoring';
import { Appear, BentoButton, BentoField, BentoIcon, BentoScreen, BentoTile, CountUp, Eyebrow, H1 } from '../../components/bento';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Course'>, NativeStackScreenProps<RootStackParamList>>;

const dShort = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// The Course tab: resume a round in progress, start one at your own club (or
// see that its map is coming soon), and search the other courses Flagrr has
// mapped to play them as away courses.
export function CourseHomeScreen({ navigation }: Props) {
  const { t } = useBento();
  const [home, setHome] = useState<GolfHomeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  // "Your game" tile: the same read My Golf makes. Best-effort; the tile
  // is left out if it fails.
  const [stats, setStats] = useState<GolfStatsDto | null>(null);

  const load = useCallback(async () => {
    try {
      setHome(await api.golfHome());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load courses.');
    }
    api.golfStats('year').then(setStats).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const startAt = (course: GolfCourseSummaryDto) => {
    if (home?.inProgress) {
      showAlert('Round in progress', `Finish or discard your round at ${home.inProgress.courseName} before starting another.`, [
        { text: 'Resume round', onPress: () => navigation.navigate('CourseGuide', { roundId: home.inProgress!.id }) },
        { text: 'Close', style: 'cancel' },
      ]);
      return;
    }
    navigation.navigate('RoundSetup', { golfCourseId: course.id });
  };

  const discard = () => {
    const round = home?.inProgress;
    if (!round) return;
    showAlert('Discard this round?', `Your scores at ${round.courseName} will be deleted. This can't be undone.`, [
      {
        text: 'Discard round',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.golfRoundDelete(round.id);
            await load();
          } catch (e) {
            showAlert('Could not discard the round', e instanceof Error ? e.message : undefined);
          }
        },
      },
      { text: 'Keep it', style: 'cancel' },
    ]);
  };

  const away = useMemo(() => {
    if (!home) return [];
    const q = query.trim().toLowerCase();
    const list = home.courses.filter((c) => !c.isHome && (!q || c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)));
    const rank = (c: GolfCourseSummaryDto) => {
      const i = home.recentCourseIds.indexOf(c.id);
      return i === -1 ? 99 : i;
    };
    return list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [home, query]);

  const inProgress = home?.inProgress;
  const thru = inProgress ? roundTotals({ holes: inProgress.holes, handicaps: null }, inProgress.entries).holesPlayed : 0;

  const progress = useMemo(() => {
    if (!inProgress) return null;
    const setup = {
      holes: inProgress.holes,
      handicaps: inProgress.courseHandicap == null || inProgress.playingHandicap == null ? null : { course: inProgress.courseHandicap, playing: inProgress.playingHandicap },
    };
    const next = inProgress.holes.findIndex((_, i) => !holeResult(setup, i, inProgress.entries[i]).played);
    return { points: roundTotals(setup, inProgress.entries).points, nextHole: next === -1 ? null : inProgress.holes[next].n };
  }, [inProgress]);
  const recent = stats?.stats.recent.slice(0, 3) ?? [];

  return (
    <BentoScreen
      tabBar
      scrollTitle="Course"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <View>
        {home?.clubName ? <Eyebrow numberOfLines={1}>{home.clubName}</Eyebrow> : null}
        <H1 style={{ marginTop: 6 }}>Play a round</H1>
        <Text style={[bentoType.body, { color: t.muted, marginTop: 6 }]}>Hole maps, distances and your scorecard</Text>
      </View>
      <View style={{ height: 4 }} />

      {!home && !error ? <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} /> : null}
      {error ? (
        <BentoTile>
          <Text style={[bentoType.body, { color: t.muted, marginBottom: 12 }]}>{error}</Text>
          <BentoButton label="Try again" variant="secondary" onPress={load} />
        </BentoTile>
      ) : null}

      {home ? (
        <>
          {inProgress && progress ? (
            <Appear>
              <BentoTile tone="hero">
                <Text style={[bentoType.eyebrow, { color: bentoBrand.lime }]}>Round in progress</Text>
                <Text style={[bentoType.number, { fontSize: 30, lineHeight: 34, color: '#FFFFFF', marginTop: 8 }]}>
                  {progress.nextHole ? `Hole ${progress.nextHole}` : 'All holes in'}
                </Text>
                <Text style={{ fontSize: 15, color: t.onHeroMuted, marginTop: 2 }}>
                  {progress.points} pts · thru {thru} of {inProgress.holes.length}
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>
                  {inProgress.courseName} · {inProgress.teeName} tees
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
                  <BentoButton label="Resume round" variant="lime" nub compact style={{ flex: 1 }} onPress={() => navigation.navigate('CourseGuide', { roundId: inProgress.id })} />
                  <Pressable onPress={discard} accessibilityRole="button" style={{ paddingVertical: 12, paddingHorizontal: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Discard</Text>
                  </Pressable>
                </View>
              </BentoTile>
            </Appear>
          ) : null}

          {home.homeCourse ? (
            <Appear>
              <BentoTile>
                <Eyebrow style={{ color: t.accent }}>Your club</Eyebrow>
                <CourseRow course={home.homeCourse} onPress={() => startAt(home.homeCourse!)} />
                <BentoButton label="Start a round" nub onPress={() => startAt(home.homeCourse!)} style={{ marginTop: 4 }} />
              </BentoTile>
            </Appear>
          ) : (
            <Appear>
              <BentoTile>
                <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: t.seg }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>Coming soon</Text>
                </View>
                <Text style={[bentoType.number, { fontSize: 20, color: t.ink, marginTop: 10 }]}>
                  {home.isPlaceholderClub || !home.clubName ? 'Your club’s course map' : `${home.clubName}’s course map`}
                </Text>
                <Text style={[bentoType.body, { color: t.muted, marginTop: 6 }]}>
                  {home.isPlaceholderClub
                    ? 'Your club isn’t on Flagrr yet. Once it joins, we’ll build its hole maps and scorecard here.'
                    : 'We build each club’s hole maps and scorecard from its official card. Yours is on the way.'}
                  {home.courses.length ? ' In the meantime you can play any course below.' : ''}
                </Text>
              </BentoTile>
            </Appear>
          )}

          {/* Your game: the way into My Golf, with the latest rounds. */}
          {stats && stats.totalRounds > 0 ? (
            <Appear>
              <BentoTile padding={0}>
                <Pressable
                  onPress={() => navigation.navigate('MyGolf')}
                  accessibilityRole="button"
                  accessibilityLabel="My Golf"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: t.muted }}>Your game · Stableford average</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                      <CountUp
                        value={stats.stats.pointsAverage == null ? '–' : stats.stats.pointsAverage.toFixed(1)}
                        style={[bentoType.number, { fontSize: 28, lineHeight: 32, color: t.ink }]}
                      />
                      <Text style={{ fontSize: 14, color: t.muted }}>pts</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: t.accent }}>My Golf</Text>
                  <BentoIcon name="chevronRight" size={16} color={t.accent} />
                </Pressable>
                {recent.length ? (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
                    <Eyebrow style={{ paddingTop: 10, paddingBottom: 4, borderTopWidth: 1, borderTopColor: t.hair }}>Played recently</Eyebrow>
                    {recent.map((r, i) => (
                      <Pressable
                        key={r.id}
                        onPress={() => navigation.navigate('RoundDetail', { roundId: r.id })}
                        accessibilityRole="button"
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}
                      >
                        <Text style={{ flex: 1, fontSize: 14, color: t.ink }} numberOfLines={1}>
                          {dShort(r.completedAt)} · {r.courseName}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>
                          {r.points} pts{r.gross != null ? ` · ${r.gross} gross` : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </BentoTile>
            </Appear>
          ) : null}

          <Text accessibilityRole="header" style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: t.ink, marginTop: 8 }}>
            Away courses
          </Text>
          {home.courses.filter((c) => !c.isHome).length ? (
            <>
              <BentoField value={query} onChangeText={setQuery} placeholder="Search courses" accessibilityLabel="Search courses" autoCorrect={false} rightIcon="search" />
              {away.length ? (
                <BentoTile padding={0}>
                  <View style={{ paddingHorizontal: 16 }}>
                    {away.map((c, i) => (
                      <View key={c.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}>
                        <CourseRow course={c} onPress={() => startAt(c)} recent={home.recentCourseIds.includes(c.id)} />
                      </View>
                    ))}
                  </View>
                </BentoTile>
              ) : (
                <BentoTile>
                  <Text style={[bentoType.body, { color: t.muted, textAlign: 'center' }]}>No mapped course matches “{query.trim()}”.</Text>
                </BentoTile>
              )}
            </>
          ) : (
            <BentoTile>
              <Text style={[bentoType.body, { color: t.muted, textAlign: 'center' }]}>
                {home.homeCourse
                  ? 'No other courses are mapped yet. More are added as clubs join Flagrr.'
                  : 'Course maps are coming soon. We’re adding them as clubs join Flagrr.'}
              </Text>
            </BentoTile>
          )}
          <Text style={{ fontSize: 13, lineHeight: 19, color: t.muted, paddingHorizontal: 4 }}>
            Only courses Flagrr has mapped are listed, so every scorecard here matches the club’s official card.
          </Text>
        </>
      ) : null}
    </BentoScreen>
  );
}

function CourseRow({ course, onPress, recent }: { course: GolfCourseSummaryDto; onPress: () => void; recent?: boolean }) {
  const { t } = useBento();
  return (
    <Pressable onPress={onPress} accessibilityLabel={`Play ${course.name}`} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {course.logoUrl ? <Image source={{ uri: course.logoUrl }} style={{ width: 40, height: 40 }} /> : <BentoIcon name="golfFlag" size={20} color={t.accent} strokeWidth={1.8} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }} numberOfLines={1}>
          {course.name}
        </Text>
        <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }} numberOfLines={1}>
          {[course.location, `${course.holeCount} holes`, recent ? 'Played recently' : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <BentoIcon name="chevronRight" size={16} color={t.muted} />
    </Pressable>
  );
}
