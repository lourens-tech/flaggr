import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { Scorecard } from '../../components/golf/Scorecard';
import { api } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, spacing } from '../../theme';
import type { RoundDto } from '../../golf/dto';
import { formatIndex, formatWhole } from '../../golf/scoring';

type Props = NativeStackScreenProps<RootStackParamList, 'RoundDetail'>;

// A finished round from My Golf: its scorecard, with options to correct a
// score on the map or delete the round.
export function RoundDetailScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [round, setRound] = useState<RoundDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .golfRound(route.params.roundId)
        .then((r) => {
          setRound(r);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the round.'));
    }, [route.params.roundId]),
  );

  const remove = () => {
    if (!round) return;
    showAlert('Delete this round?', 'It will be removed from your scorecards and My Golf stats. This can’t be undone.', [
      {
        text: 'Delete round',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.golfRoundDelete(round.id);
            navigation.goBack();
          } catch (e) {
            showAlert('Could not delete the round', e instanceof Error ? e.message : undefined);
          }
        },
      },
      { text: 'Keep it', style: 'cancel' },
    ]);
  };

  const when = round?.completedAt ?? round?.startedAt;
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Round" onBack={() => navigation.goBack()} />
      </SafeAreaView>
      {!round && !error ? <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} /> : null}
      {error ? <Text style={[styles.meta, { margin: spacing.md }]}>{error}</Text> : null}
      {round ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View>
            <Text style={styles.title}>{round.courseName}</Text>
            <Text style={styles.meta}>
              {when ? new Date(when).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : ''} · {round.teeName} tees (
              {round.ratingGender}) · CR {round.courseRating.toFixed(1)} / {round.slope}
            </Text>
            <Text style={styles.meta}>
              {round.handicapIndex == null
                ? 'No Handicap Index (scratch)'
                : `Index ${formatIndex(round.handicapIndex)} · course handicap ${formatWhole(round.courseHandicap ?? 0)} · playing ${formatWhole(round.playingHandicap ?? 0)} (${Math.round(round.allowance * 100)}%)`}
            </Text>
          </View>
          <Scorecard
            setup={{
              holes: round.holes,
              handicaps: round.courseHandicap == null || round.playingHandicap == null ? null : { course: round.courseHandicap, playing: round.playingHandicap },
            }}
            entries={round.entries}
            format={round.format}
            trackStats={round.trackStats}
          />
          <View style={styles.actions}>
            <PillButton label={round.status === 'completed' ? 'Correct a score' : 'Resume round'} icon="create-outline" onPress={() => navigation.navigate('CourseGuide', { roundId: round.id })} />
            <TouchableOpacity onPress={remove} style={styles.deleteBtn} accessibilityRole="button">
              <Text style={styles.deleteText}>Delete round</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerSafeArea: { backgroundColor: colors.clubGreen },
    content: { padding: spacing.md + 2, gap: spacing.md, paddingBottom: spacing.xxl, maxWidth: 640, width: '100%', alignSelf: 'center' },
    title: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.textPrimary },
    meta: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
    deleteBtn: { paddingVertical: 8, paddingHorizontal: 6 },
    deleteText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.negative },
  });
}
