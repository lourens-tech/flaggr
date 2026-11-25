import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { Scorecard } from '../../components/golf/Scorecard';
import { GolfLoading } from '../../components/golf/GolfSheet';
import { api } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { useBento } from '../../context/ThemeContext';
import { bentoType } from '../../theme/bento';
import type { RoundDto } from '../../golf/dto';
import { formatIndex, formatWhole, roundTotals } from '../../golf/scoring';
import { Appear, BentoButton, BentoScreen, BentoTile, CountUp, H1 } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'RoundDetail'>;

// A finished round from My Golf: its scorecard, with options to correct a
// score on the map or delete the round. Boards: AppRoundDetail, G-D-RoundDetail*.
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
        .catch((e) => setError(friendlyError(e, 'Could not load the round.')));
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
            showAlert('Could not delete the round', friendlyError(e));
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
      {!round && !error ? <GolfLoading /> : null}
      {error ? <Text style={{ fontSize: 15, lineHeight: 22, color: t.ink, textAlign: 'center', marginTop: 42 }}>{error}</Text> : null}
      {round && setup && totals ? (
        <>
          <H1 style={{ fontSize: 26, lineHeight: Math.round(26 * 1.04), marginTop: 16 }}>{round.courseName}</H1>
          <Appear>
            <BentoTile tone="hero" padding={18}>
              <Text style={{ fontSize: 14, lineHeight: 20, color: t.onHeroMuted }}>
                {when ? new Date(when).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : ''} · {round.teeName} tees ({round.ratingGender}) · CR{' '}
                {round.courseRating.toFixed(1)} / {round.slope}
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 18, color: '#CDDE5C', marginTop: 4 }}>
                {round.handicapIndex == null
                  ? 'No Handicap Index (scratch)'
                  : `Index ${formatIndex(round.handicapIndex)} · course handicap ${formatWhole(round.courseHandicap ?? 0)} · playing ${formatWhole(round.playingHandicap ?? 0)} (${Math.round(round.allowance * 100)}%)`}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <CountUp value={totals.points} style={[bentoType.number, { fontSize: 54, lineHeight: 56, letterSpacing: -0.025 * 54, color: '#FFFFFF' }]} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: '#FFFFFF' }}>pts</Text>
                </View>
                {totals.gross != null ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <CountUp value={totals.gross} style={[bentoType.number, { fontSize: 26, lineHeight: 28, letterSpacing: -0.025 * 26, color: '#FFFFFF' }]} />
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>gross</Text>
                  </View>
                ) : null}
              </View>
            </BentoTile>
          </Appear>
          <Appear>
            <BentoTile padding={14}>
              <Scorecard setup={setup} entries={round.entries} format={round.format} trackStats={round.trackStats} />
            </BentoTile>
          </Appear>
          <BentoButton label={round.status === 'completed' ? 'Correct a score' : 'Resume round'} nub onPress={() => navigation.navigate('CourseGuide', { roundId: round.id })} />
          <Pressable onPress={remove} accessibilityRole="button" style={{ alignSelf: 'stretch', alignItems: 'center', padding: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: t.danger }}>Delete round</Text>
          </Pressable>
        </>
      ) : null}
    </BentoScreen>
  );
}
