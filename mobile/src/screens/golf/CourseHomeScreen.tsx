import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, RefreshControl, Text, TextInput, View, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { api } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoType } from '../../theme/bento';
import { bentoEasing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import type { GolfCourseSummaryDto, GolfHomeDto, GolfStatsDto } from '../../golf/dto';
import { holeResult, roundTotals } from '../../golf/scoring';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoTile, CountUp, Eyebrow, H1, StatusPill } from '../../components/bento';
import { GolfLoadError, GolfLoading } from '../../components/golf/GolfSheet';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Course'>, NativeStackScreenProps<RootStackParamList>>;

// Nested in a Fraunces line, the unit text names the system font so it doesn't inherit Fraunces.
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });
const dShort = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
// The club badge on the Your club tile (boards: "SG" for Strand Golf Club).
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

// The Course tab: resume a round in progress, start one at your own club (or
// see that its map is coming soon), and search the other courses Flagrr has
// mapped to play them as away courses. Boards: AppCourse, G-D-Course*.
export function CourseHomeScreen({ navigation }: Props) {
  const { t } = useBento();
  const [home, setHome] = useState<GolfHomeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  // "Your game" tile: the same read My Golf makes. Best-effort: if it fails
  // the tile still shows (with "–") as the way into My Golf.
  const [stats, setStats] = useState<GolfStatsDto | null>(null);

  const load = useCallback(async () => {
    try {
      setHome(await api.golfHome());
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not load courses.'));
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
            showAlert('Could not discard the round', friendlyError(e));
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
  const hasAway = home ? home.courses.some((c) => !c.isHome) : false;
  const muted13: TextStyle = { fontSize: 13, lineHeight: 19, color: t.muted };

  return (
    <BentoScreen
      tabBar
      scrollTitle="Course"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View>
        {home?.clubName ? <Eyebrow numberOfLines={1}>{home.clubName}</Eyebrow> : null}
        <H1 style={{ marginTop: 6, fontSize: 36, lineHeight: Math.round(36 * 1.04), letterSpacing: -0.025 * 36 }}>Course</H1>
      </View>
      <View style={{ height: 6 }} />

      {!home && !error ? <GolfLoading style={{ paddingVertical: 40 }} /> : null}
      {error ? <GolfLoadError message={error} onRetry={load} /> : null}

      {home ? (
        <>
          {/* The board's hero photo is a club photo the API doesn't return: drawn without it. */}
          <Appear>
            <BentoTile tone="hero" padding={0} innerStyle={{ height: 200 }}>
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(10,24,17,0.1)', 'rgba(10,24,17,0.85)']}
                locations={[0.1, 1]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
                <Text accessibilityRole="header" style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 28, lineHeight: Math.round(28 * 1.15), letterSpacing: -0.28, color: '#FFFFFF' }}>
                  Play a round
                </Text>
                <Text style={{ fontSize: 13, color: t.onHeroMuted, marginTop: 4 }}>Hole maps, distances and your scorecard</Text>
              </View>
            </BentoTile>
          </Appear>

          {inProgress && progress ? (
            <Appear>
              <BentoTile padding={18}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <PulseDot color={t.accent} />
                  <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 0.12 * 13, textTransform: 'uppercase', color: t.accent }}>Round in progress</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                  <Text style={[bentoType.number, { fontSize: 26, color: t.ink }]}>{progress.nextHole ? `Hole ${progress.nextHole}` : 'All holes in'}</Text>
                  <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 20, color: t.ink, flexShrink: 1, textAlign: 'right' }}>
                    {progress.points} pts
                    <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 13, fontWeight: '400', color: t.muted }}>{` · thru ${thru} of ${inProgress.holes.length}`}</Text>
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: t.muted, marginTop: 2 }}>
                  {inProgress.courseName} · {inProgress.teeName} tees
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <BentoButton label="Resume round" nub compact style={{ flex: 1 }} onPress={() => navigation.navigate('CourseGuide', { roundId: inProgress.id })} />
                  <Pressable
                    onPress={discard}
                    accessibilityRole="button"
                    accessibilityLabel="Discard"
                    style={({ pressed }) => ({ width: 104, height: 48, borderRadius: 999, borderWidth: 1, borderColor: t.hair, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.seg : 'transparent' })}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>Discard</Text>
                  </Pressable>
                </View>
              </BentoTile>
            </Appear>
          ) : null}

          {home.homeCourse ? (
            <Appear>
              <BentoTile>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Pressable
                    onPress={() => startAt(home.homeCourse!)}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${home.homeCourse.name}`}
                    style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                  >
                    <ClubBadge course={home.homeCourse} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13, color: t.muted }}>Your club</Text>
                      <Text style={{ fontSize: 17, fontWeight: '600', color: t.ink }}>{home.homeCourse.name}</Text>
                      <Text style={{ fontSize: 13, color: t.muted, marginTop: 1 }}>
                        {[home.homeCourse.location, `${home.homeCourse.holeCount} holes`].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => startAt(home.homeCourse!)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({ height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: t.accentSoft, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: t.accent }}>Start a round</Text>
                  </Pressable>
                </View>
              </BentoTile>
            </Appear>
          ) : (
            <Appear>
              <BentoTile padding={18}>
                <StatusPill label="Coming soon" tone="muted" />
                <Text style={[bentoType.number, { fontSize: 21, letterSpacing: -0.025 * 21, color: t.ink, marginTop: 10 }]}>
                  {home.isPlaceholderClub || !home.clubName ? 'Your club’s course map' : `${home.clubName}’s course map`}
                </Text>
                <Text style={{ fontSize: 14, lineHeight: 20, color: t.muted, marginTop: 6 }}>
                  {home.isPlaceholderClub
                    ? 'Your club isn’t on Flagrr yet. Once it joins, we’ll build its hole maps and scorecard here.'
                    : 'We build each club’s hole maps and scorecard from its official card. Yours is on the way.'}
                  {home.courses.length ? ' In the meantime you can play any course below.' : ''}
                </Text>
              </BentoTile>
            </Appear>
          )}

          {/* Your game: the way into My Golf, shown even before the first finished round. */}
          <Appear>
            <BentoTile onPress={() => navigation.navigate('MyGolf')} accessibilityLabel="My Golf">
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: t.muted }}>Your game · Stableford average</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                    <CountUp
                      value={stats?.stats.pointsAverage == null ? '–' : stats.stats.pointsAverage.toFixed(1)}
                      style={[bentoType.number, { fontSize: 30, lineHeight: 34, letterSpacing: -0.75, color: t.ink }]}
                    />
                    <Text style={{ fontSize: 14, color: t.muted }}>pts</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: t.accent }}>My Golf</Text>
                  <BentoIcon name="chevronRight" size={16} color={t.accent} strokeWidth={2} />
                </View>
              </View>
            </BentoTile>
          </Appear>

          {recent.length ? (
            <>
              <Text accessibilityRole="header" style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 22, letterSpacing: -0.22, color: t.ink, marginTop: 8 }}>
                Played recently
              </Text>
              <Appear>
                <BentoTile padding={0}>
                  <View style={{ paddingHorizontal: 16 }}>
                    {recent.map((r, i) => (
                      <Pressable
                        key={r.id}
                        onPress={() => navigation.navigate('RoundDetail', { roundId: r.id })}
                        accessibilityRole="button"
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }} numberOfLines={1}>
                            {dShort(r.completedAt)} · {r.courseName}
                          </Text>
                          <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                            {r.points} pts{r.gross != null ? ` · ${r.gross} gross` : ''}
                          </Text>
                        </View>
                        <BentoIcon name="chevronRight" size={17} color={t.muted} strokeWidth={2} />
                      </Pressable>
                    ))}
                  </View>
                </BentoTile>
              </Appear>
            </>
          ) : null}

          <Appear>
            <BentoTile>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>
                  Away courses
                </Text>
                {!hasAway && home.homeCourse ? <StatusPill label="Coming soon" tone="muted" /> : null}
              </View>
              {hasAway ? (
                <>
                  <SearchField value={query} onChangeText={setQuery} />
                  {away.length ? (
                    <View style={{ marginTop: 6 }}>
                      {away.map((c, i) => (
                        <View key={c.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}>
                          <CourseRow course={c} onPress={() => startAt(c)} recent={home.recentCourseIds.includes(c.id)} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 14, lineHeight: 20, color: t.ink, marginTop: 12 }}>No mapped course matches “{query.trim()}”.</Text>
                  )}
                </>
              ) : home.homeCourse ? (
                <>
                  {/* Nothing to search yet: the board shows the field greyed out. */}
                  <View aria-hidden style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, marginTop: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: t.seg, opacity: 0.7 }}>
                    <BentoIcon name="golfSearch" size={18} color={t.muted} strokeWidth={1.8} />
                    <Text style={{ fontSize: 15, color: t.muted }}>Search courses</Text>
                  </View>
                  <Text style={[muted13, { marginTop: 10 }]}>No other courses are mapped yet. More are added as clubs join Flagrr.</Text>
                </>
              ) : (
                <Text style={{ fontSize: 14, lineHeight: 20, color: t.ink, marginTop: 12 }}>Course maps are coming soon. We’re adding them as clubs join Flagrr.</Text>
              )}
              <Text style={[muted13, { marginTop: 12 }]}>Only courses Flagrr has mapped are listed, so every scorecard here matches the club’s official card.</Text>
            </BentoTile>
          </Appear>
        </>
      ) : null}
    </BentoScreen>
  );
}

// The board's search field: a soft grey field with the search icon on the left.
function SearchField({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const { t } = useBento();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, marginTop: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: t.seg }}>
      <BentoIcon name="golfSearch" size={18} color={t.muted} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search courses"
        placeholderTextColor={t.muted}
        accessibilityLabel="Search courses"
        autoCorrect={false}
        style={[{ flex: 1, height: 48, fontSize: 15, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null]}
      />
    </View>
  );
}

function ClubBadge({ course }: { course: GolfCourseSummaryDto }) {
  return (
    <View
      role="img"
      aria-label={course.name}
      style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: bentoBrand.fairway, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {course.logoUrl ? (
        <Image source={{ uri: course.logoUrl }} style={{ width: 52, height: 52 }} />
      ) : (
        <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: bentoBrand.lime }}>{initials(course.name)}</Text>
      )}
    </View>
  );
}

function CourseRow({ course, onPress, recent }: { course: GolfCourseSummaryDto; onPress: () => void; recent?: boolean }) {
  const { t } = useBento();
  return (
    <Pressable onPress={onPress} accessibilityLabel={`Play ${course.name}`} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {course.logoUrl ? <Image source={{ uri: course.logoUrl }} style={{ width: 40, height: 40 }} /> : <BentoIcon name="golfFlag" size={19} color={t.accent} strokeWidth={1.8} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }} numberOfLines={1}>
          {course.name}
        </Text>
        <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
          {[course.location, `${course.holeCount} holes`, recent ? 'Played recently' : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <BentoIcon name="chevronRight" size={16} color={t.muted} strokeWidth={1.8} />
    </Pressable>
  );
}

// The board's pulsing "round in progress" dot (fl-pulse: scale 1 → 1.25 and
// back, fading to .55, every 2.4 s). Still under Reduce Motion.
function PulseDot({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1200, easing: bentoEasing.move, useNativeDriver }),
        Animated.timing(v, { toValue: 0, duration: 1200, easing: bentoEasing.move, useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
      }}
    />
  );
}
