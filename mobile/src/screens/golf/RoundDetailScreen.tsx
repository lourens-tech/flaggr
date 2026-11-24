import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { Scorecard } from '../../components/golf/Scorecard';
import { api } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { useBento } from '../../context/ThemeContext';
import { bentoType } from '../../theme/bento';
import type { RoundDto } from '../../golf/dto';
import { formatIndex, formatWhole, roundTotals } from '../../golf/scoring';
import { Appear, BentoButton, BentoScreen, BentoTile } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'RoundDetail'>;

// A finished round from My Golf: its scorecard, with options to correct a
// score on the map or delete the round.
export function RoundDetailScreen({ navigation, route }: Props) {
  const { t } = useBento();
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
  const setup = useMemo(
    () =>
      round
        ? {
            holes: round.holes,
            handicaps: round.courseHandicap == null || round.playingHandicap == null ? null : { course: round.courseHandicap, playing: round.playingHandicap },
          }
        : null,
    [round],
  );
  const totals = round && setup ? roundTotals(setup, round.entries) : null;

  return (
    <BentoScreen title="Round" onBack={() => navigation.goBack()}>
      {!round && !error ? <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={[bentoType.body, { color: t.muted }]}>{error}</Text> : null}
      {round && setup && totals ? (
        <>
          <Appear>
            <BentoTile tone="hero">
              <Text style={[bentoType.number, { fontSize: 24, lineHeight: 28, color: '#FFFFFF' }]} accessibilityRole="header">
                {round.courseName}
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 18, color: t.onHeroMuted, marginTop: 4 }}>
                {when ? new Date(when).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : ''} · {round.teeName} tees ({round.ratingGender}) · CR{' '}
                {round.courseRating.toFixed(1)} / {round.slope}
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 18, color: t.onHeroMuted, marginTop: 2 }}>
                {round.handicapIndex == null
                  ? 'No Handicap Index (scratch)'
                  : `Index ${formatIndex(round.handicapIndex)} · course handicap ${formatWhole(round.courseHandicap ?? 0)} · playing ${formatWhole(round.playingHandicap ?? 0)} (${Math.round(round.allowance * 100)}%)`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 24, marginTop: 14 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                    <Text style={[bentoType.number, { fontSize: 38, lineHeight: 42, color: '#FFFFFF' }]}>{totals.points}</Text>
                    <Text style={{ fontSize: 15, color: t.onHeroMuted }}>pts</Text>
                  </View>
                </View>
                {totals.gross != null ? (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                    <Text style={[bentoType.number, { fontSize: 38, lineHeight: 42, color: '#FFFFFF' }]}>{totals.gross}</Text>
                    <Text style={{ fontSize: 15, color: t.onHeroMuted }}>gross</Text>
                  </View>
                  </View>
                ) : null}
              </View>
            </BentoTile>
          </Appear>
          <Appear>
            <BentoTile padding={12}>
              <Scorecard setup={setup} entries={round.entries} format={round.format} trackStats={round.trackStats} />
            </BentoTile>
          </Appear>
          <BentoButton label={round.status === 'completed' ? 'Correct a score' : 'Resume round'} nub onPress={() => navigation.navigate('CourseGuide', { roundId: round.id })} />
          <Pressable onPress={remove} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: t.danger }}>Delete round</Text>
          </Pressable>
        </>
      ) : null}
    </BentoScreen>
  );
}
