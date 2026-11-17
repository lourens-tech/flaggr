import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useAdminTheme } from '../../context/ThemeContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminApiError } from '../../api/adminClient';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminButton, ErrorState, Muted, PageTitle, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { GolfFrame, ScorecardGrid, TeeDot, fmtIndex, holesLabel, longDate, useGolfAccess } from '../../components/admin/golf/GolfParts';
import { roundTotals, formatWhole } from '../../golf/scoring';
import type { GolfScorecardDto } from '../../golf/adminDto';
import { adminFont, tabularNums, type AdminColors } from '../../theme/admin';

// One finished round's scorecard, read-only: the member changes their own
// rounds in the app. Previous / next step through their rounds on the course.
export function AdminGolfScorecardScreen() {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const navigation = useNavigation();
  const { roundId } = useRoute().params as { roundId: string };
  const golf = useGolfAccess();
  const [data, setData] = useState<GolfScorecardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await golf.scorecard(roundId));
      setError(null);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }, [golf, roundId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Swap the round in place so Back still returns to where the admin came from.
  const step = (id: string | null) => {
    if (!id) return;
    (navigation as unknown as { setParams: (p: object) => void }).setParams({ roundId: id });
  };

  const r = data?.round;
  const name = data ? `${data.member.firstName} ${data.member.lastName}` : 'Scorecard';
  const totals = r
    ? roundTotals(
        { holes: r.holes, handicaps: r.courseHandicap == null || r.playingHandicap == null ? null : { course: r.courseHandicap, playing: r.playingHandicap } },
        r.entries,
      )
    : null;
  const putts = r ? r.entries.reduce((sum, e) => sum + (typeof e?.putts === 'number' ? e.putts : 0), 0) : 0;
  const puttHoles = r ? r.entries.filter((e) => typeof e?.putts === 'number').length : 0;
  const fwHoles = r ? r.holes.filter((h, i) => h.par >= 4 && r.entries[i]?.fw != null).length : 0;
  const fwHit = r ? r.entries.filter((e) => e?.fw === 'hit').length : 0;
  const pickupHoles = r ? r.holes.filter((_, i) => r.entries[i]?.s === 'P').map((h) => h.n) : [];

  const steps = (
    <View style={styles.steps}>
      <AdminButton label="Previous round" icon="chevron-back" variant="glass" size="md" onPress={() => step(data?.previousRoundId ?? null)} disabled={!data?.previousRoundId} />
      <AdminButton label="Next round" icon="chevron-forward" variant="glass" size="md" onPress={() => step(data?.nextRoundId ?? null)} disabled={!data?.nextRoundId} />
    </View>
  );

  const content = () => {
    if (error && !data) return <Tile><ErrorState body={error} onRetry={load} /></Tile>;
    if (!data || !r || !totals) return <Tile><SkeletonRows rows={5} /></Tile>;
    const stable = r.format === 'stableford';
    const tiles = [
      stable ? { v: String(totals.points), l: 'Stableford points', hero: true } : { v: totals.net == null ? '–' : String(totals.net), l: 'Net score', hero: true },
      { v: String(totals.adjusted), l: 'Handicap score' },
      { v: totals.gross == null ? '–' : String(totals.gross), l: totals.gross == null ? `Gross, picked up on ${pickupHoles.join(', ')}` : 'Gross' },
      ...(r.trackStats ? [{ v: String(putts), l: `Putts, ${puttHoles} holes` }, { v: fwHoles ? `${fwHit} of ${fwHoles}` : '–', l: 'Fairways hit' }] : []),
    ];
    const card = (
      <>
        <View style={styles.facts}>
          <StatusPill label={`Handicap Index ${fmtIndex(r.handicapIndex)}`} />
          {r.courseHandicap != null ? <StatusPill label={`Course handicap ${formatWhole(r.courseHandicap)}`} /> : null}
          {r.playingHandicap != null ? <StatusPill label={`Playing handicap ${formatWhole(r.playingHandicap)} at ${Math.round(r.allowance * 100)}%`} /> : null}
          <StatusPill label={`Course rating ${r.courseRating.toFixed(1)}`} />
          <StatusPill label={`Slope ${r.slope}`} />
          <StatusPill label={`Par ${r.par}`} />
        </View>
        <View style={styles.tiles}>
          {tiles.map((t) => (
            <View key={t.l} style={[styles.tile, { backgroundColor: t.hero ? '#1F4234' : c.fill }]}>
              <Text style={[styles.tileVal, { color: t.hero ? '#CDDE5C' : c.ink }]}>{t.v}</Text>
              <Text style={[styles.tileLabel, { color: t.hero ? 'rgba(244,245,240,0.82)' : c.ink2 }]}>{t.l}</Text>
            </View>
          ))}
        </View>
        <ScorecardGrid round={r} />
        <Muted>Read-only. Members change their own rounds in the app.</Muted>
      </>
    );
    return isDesktop ? (
      <DesktopPanel title="Scorecard">
        <View style={{ gap: 16 }}>{card}</View>
      </DesktopPanel>
    ) : (
      <Tile style={{ gap: 14 }}>{card}</Tile>
    );
  };

  const subtitle = r ? (
    <View style={styles.subLine}>
      <Text style={[styles.sub, { color: c.ink2 }]}>
        {isDesktop ? `${name} · ` : ''}
        {longDate(r.completedAt ?? r.startedAt)} ·
      </Text>
      <TeeDot color={r.teeColor} />
      <Text style={[styles.sub, { color: c.ink2 }]}>
        {r.teeName} tees · {holesLabel(r.holes.length, r.holes[0]?.n ?? 1)} · {r.format === 'stableford' ? 'Stableford' : 'Stroke play'}
      </Text>
    </View>
  ) : null;

  return (
    <GolfFrame breadcrumb={`Golf › ${name} › Scorecard`} title={r?.courseName ?? 'Scorecard'} subtitle={name} headerRight={isDesktop ? steps : undefined}>
      {isDesktop ? (
        <View style={{ gap: 6 }}>
          <PageTitle>{r?.courseName ?? 'Scorecard'}</PageTitle>
          {subtitle}
        </View>
      ) : (
        <>
          {subtitle}
          {steps}
        </>
      )}
      {content()}
    </GolfFrame>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    steps: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    subLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    sub: { ...adminFont.body, fontSize: 14 },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexGrow: 1, flexBasis: 140, gap: 2 },
    tileVal: { ...adminFont.bodyBold, ...tabularNums, fontSize: 26, letterSpacing: -0.4 },
    tileLabel: { ...adminFont.body, fontSize: 12.5 },
  });
}
