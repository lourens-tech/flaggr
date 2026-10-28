import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import { showAlert } from '../../utils/alert';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { GolfCourseSummaryDto, GolfHomeDto } from '../../golf/dto';
import { roundTotals } from '../../golf/scoring';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Course'>, NativeStackScreenProps<RootStackParamList>>;

// The Course tab: resume a round in progress, start one at your own club (or
// see that its map is coming soon), and search the other courses Flagrr has
// mapped to play them as away courses.
export function CourseHomeScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [home, setHome] = useState<GolfHomeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setHome(await api.golfHome());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load courses.');
    }
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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <FlagrrLogo color="white" size={20} showTagline={false} />
            <Text style={styles.topBarTitle}>Course</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} accessibilityLabel="Profile">
            <HeaderAvatar size={32} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.band}>
          <Text style={styles.bandTitle}>Play a round</Text>
          <Text style={styles.bandSub}>Hole maps, distances and your scorecard</Text>
        </View>

        {!home && !error ? <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} /> : null}
        {error ? (
          <View style={styles.card}>
            <Text style={styles.cardBody}>{error}</Text>
            <PillButton label="Try again" onPress={load} variant="outline" />
          </View>
        ) : null}

        {home ? (
          <>
            {inProgress ? (
              <FadeIn style={[styles.card, styles.resume]}>
                <Text style={styles.kicker}>Round in progress</Text>
                <Text style={styles.resumeTitle}>{inProgress.courseName}</Text>
                <Text style={styles.resumeSub}>
                  {inProgress.teeName} tees · thru {thru} of {inProgress.holes.length}
                </Text>
                <View style={styles.row}>
                  <PillButton label="Resume round" onPress={() => navigation.navigate('CourseGuide', { roundId: inProgress.id })} />
                  <TouchableOpacity onPress={discard} style={styles.textButton} accessibilityRole="button">
                    <Text style={styles.textButtonLabel}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </FadeIn>
            ) : null}

            {home.homeCourse ? (
              <FadeIn style={styles.card}>
                <Text style={styles.kickerDark}>Your club</Text>
                <CourseRow course={home.homeCourse} styles={styles} colors={colors} onPress={() => startAt(home.homeCourse!)} />
                <PillButton label="Start a round" icon="flag-outline" onPress={() => startAt(home.homeCourse!)} />
              </FadeIn>
            ) : (
              <FadeIn style={[styles.card, styles.soon]}>
                <View style={styles.soonChip}>
                  <Text style={styles.soonChipText}>Coming soon</Text>
                </View>
                <Text style={styles.soonTitle}>
                  {home.isPlaceholderClub || !home.clubName ? 'Your club’s course map' : `${home.clubName}’s course map`}
                </Text>
                <Text style={styles.soonBody}>
                  {home.isPlaceholderClub
                    ? 'Your club isn’t on Flagrr yet. Once it joins, we’ll build its hole maps and scorecard here.'
                    : 'We build each club’s hole maps and scorecard from its official card. Yours is on the way.'}
                  {home.courses.length ? ' In the meantime you can play any course below.' : ''}
                </Text>
              </FadeIn>
            )}

            <Text style={styles.sectionTitle}>Away courses</Text>
            {home.courses.filter((c) => !c.isHome).length ? (
              <>
                <View style={styles.search}>
                  <Ionicons name="search" size={16} color={colors.textMuted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search courses"
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                    autoCorrect={false}
                    accessibilityLabel="Search courses"
                  />
                </View>
                {away.length ? (
                  <View style={styles.list}>
                    {away.map((c) => (
                      <CourseRow key={c.id} course={c} styles={styles} colors={colors} onPress={() => startAt(c)} recent={home.recentCourseIds.includes(c.id)} />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.empty}>No mapped course matches “{query.trim()}”.</Text>
                )}
              </>
            ) : (
              <Text style={styles.empty}>
                {home.homeCourse
                  ? 'No other courses are mapped yet. More are added as clubs join Flagrr.'
                  : 'Course maps are coming soon. We’re adding them as clubs join Flagrr.'}
              </Text>
            )}
            <Text style={styles.footnote}>Only courses Flagrr has mapped are listed, so every scorecard here matches the club’s official card.</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function CourseRow({
  course,
  styles,
  colors,
  onPress,
  recent,
}: {
  course: GolfCourseSummaryDto;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onPress: () => void;
  recent?: boolean;
}) {
  return (
    <PressableScale style={styles.courseRow} onPress={onPress} accessibilityLabel={`Play ${course.name}`} accessibilityRole="button">
      {course.logoUrl ? (
        <Image source={{ uri: course.logoUrl }} style={styles.logo} />
      ) : (
        <View style={[styles.logo, styles.logoFallback]}>
          <Ionicons name="golf-outline" size={17} color={colors.clubGreen} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.courseName} numberOfLines={1}>
          {course.name}
        </Text>
        <Text style={styles.courseMeta} numberOfLines={1}>
          {[course.location, `${course.holeCount} holes`, recent ? 'Played recently' : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </PressableScale>
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
    band: { backgroundColor: colors.clubGreen, paddingHorizontal: screenPadding, paddingTop: 4, paddingBottom: spacing.xl + spacing.sm, marginBottom: -spacing.xl },
    bandTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
    bandSub: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, marginHorizontal: spacing.md, padding: spacing.md, gap: spacing.sm + 2, borderWidth: 1, borderColor: colors.border },
    cardBody: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary },
    resume: { backgroundColor: colors.darkGreen, borderColor: colors.darkGreen },
    kicker: { fontFamily: fontFamily.bodySemiBold, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.lime },
    kickerDark: { fontFamily: fontFamily.bodySemiBold, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.clubGreen },
    resumeTitle: { fontFamily: fontFamily.heading, fontSize: 20, color: colors.white },
    resumeSub: { fontFamily: fontFamily.body, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: -6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    textButton: { paddingVertical: 8, paddingHorizontal: 4 },
    textButtonLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.white, textDecorationLine: 'underline' },
    soon: { borderStyle: 'dashed', borderWidth: 1.5 },
    soonChip: { alignSelf: 'flex-start', backgroundColor: colors.lime, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
    soonChipText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.darkGreen },
    soonTitle: { fontFamily: fontFamily.heading, fontSize: 18, color: colors.textPrimary },
    soonBody: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    sectionTitle: { fontFamily: fontFamily.heading, fontSize: 21, color: colors.textPrimary, marginHorizontal: screenPadding - 4, marginTop: spacing.sm },
    search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, backgroundColor: colors.inputBg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 14, height: 44 },
    searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.textPrimary, height: 44 },
    list: { marginHorizontal: spacing.md, gap: spacing.sm },
    courseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, padding: spacing.sm + 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    logo: { width: 38, height: 38, borderRadius: 10 },
    logoFallback: { backgroundColor: colors.mintBg, alignItems: 'center', justifyContent: 'center' },
    courseName: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    courseMeta: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted },
    empty: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, marginHorizontal: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, textAlign: 'center' },
    footnote: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, marginHorizontal: screenPadding - 4 },
  });
}
