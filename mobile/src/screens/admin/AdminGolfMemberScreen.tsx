import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useAdminTheme } from '../../context/ThemeContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminApiError } from '../../api/adminClient';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { DesktopDataTable, TableText, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { EmptyState, ErrorState, Muted, PageTitle, Segmented, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import {
  GOLF_PERIOD_OPTIONS,
  GOLF_PERIOD_WORDS,
  GolfFrame,
  MiniStat,
  MixBar,
  ParAverages,
  PointsTrend,
  TeeDot,
  ToughestHoles,
  fmt1,
  fmtIndex,
  fmtPct,
  holesLabel,
  initials,
  shortDate,
  useGolfAccess,
  useGolfNavigate,
} from '../../components/admin/golf/GolfParts';
import type { GolfMemberDetailDto } from '../../golf/adminDto';
import type { GolfPeriod } from '../../golf/clubStats';
import type { RoundSummary } from '../../golf/stats';
import { adminFont, tabularNums, type AdminColors } from '../../theme/admin';

// One member's golf, as their club sees it: the same numbers as their own My
// Golf screen, from the rounds they've played on the club's course.
export function AdminGolfMemberScreen() {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { userId } = useRoute().params as { userId: string };
  const golf = useGolfAccess();
  const go = useGolfNavigate();
  const [period, setPeriod] = useState<GolfPeriod>('year');
  const [data, setData] = useState<GolfMemberDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (p: GolfPeriod) => {
      setLoading(true);
      try {
        setData(await golf.member(userId, p));
        setError(null);
      } catch (err) {
        setError(err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [golf, userId],
  );

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period]),
  );

  const openRound = (roundId: string) => go(golf.routes.scorecard, { roundId });
  const m = data?.member;
  const s = data?.stats;
  const name = m ? `${m.firstName} ${m.lastName}` : 'Member';
  const target = s?.basis === 9 ? 18 : 36;
  const periodToggle = (full: boolean) => <Segmented accessibilityLabel="Period" fullWidth={full} value={period} onChange={setPeriod} options={GOLF_PERIOD_OPTIONS} />;

  const facts = m ? (
    <View style={styles.facts}>
      <StatusPill label={m.tier} tone="pos" />
      <StatusPill label={`Handicap Index ${fmtIndex(m.handicapIndex)}${m.handicapIndex == null ? '' : ' · entered by member'}`} />
      <StatusPill label={`${m.format === 'stableford' ? 'Stableford' : 'Stroke play'}, ${Math.round(m.allowance * 100)}% allowance`} />
      {m.trackStats ? <StatusPill label="Enters putts and fairways" /> : null}
    </View>
  ) : null;

  const kpis = s
    ? [
        { label: 'Stableford average', value: fmt1(s.pointsAverage), icon: 'star-outline' as const },
        { label: 'Best round', value: s.bestPoints ? `${s.bestPoints.points} pts` : '–', icon: 'trophy-outline' as const },
        { label: 'Scoring average', value: fmt1(s.scoringAverage), icon: 'golf-outline' as const },
        { label: `Played to handicap (${target}+)`, value: s.basisRounds ? `${s.playedToHandicap} of ${s.basisRounds}` : '–', icon: 'flag-outline' as const },
      ]
    : [];

  const roundColumns: DesktopTableColumn<RoundSummary>[] = [
    { key: 'date', label: 'Date', width: 90, sortValue: (r) => r.completedAt, render: (r) => <TableText>{shortDate(r.completedAt)}</TableText> },
    {
      key: 'tee',
      label: 'Tee',
      width: 110,
      render: (r) => (
        <View style={styles.teeLine}>
          <TeeDot color={r.teeColor} />
          <TableText>{r.teeName}</TableText>
        </View>
      ),
    },
    { key: 'holes', label: 'Holes', width: 80, render: (r) => <TableText>{holesLabel(r.holeCount, r.firstHole)}</TableText> },
    { key: 'gross', label: 'Gross', width: 70, align: 'right', render: (r) => <TableText muted={r.gross == null}>{r.gross ?? '–'}</TableText> },
    { key: 'adj', label: 'Handicap score', width: 120, align: 'right', sortValue: (r) => r.adjusted, render: (r) => <TableText>{r.adjusted}</TableText> },
    {
      key: 'pts',
      label: 'Points',
      width: 80,
      align: 'right',
      sortValue: (r) => r.points,
      render: (r) => (
        <Text style={styles.strong}>
          {r.points}
          {r.isBest ? <Text style={[styles.best, { color: c.accentText }]}>  Best</Text> : null}
        </Text>
      ),
    },
    {
      key: 'open',
      label: '',
      width: 110,
      align: 'right',
      render: (r) => (
        <Pressable onPress={() => openRound(r.id)} accessibilityRole="link" accessibilityLabel={`Open the scorecard from ${shortDate(r.completedAt)}`}>
          <Text style={[styles.link, { color: c.accentText }]}>Scorecard ›</Text>
        </Pressable>
      ),
    },
  ];

  const roundRowMobile = (r: RoundSummary, i: number) => (
    <Pressable
      key={r.id}
      onPress={() => openRound(r.id)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.rRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }, pressed && { opacity: 0.7 }]}
    >
      <View style={{ width: 52 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]}>{shortDate(r.completedAt)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.teeLine}>
          <TeeDot color={r.teeColor} />
          <Text style={[styles.rowSub, { color: c.ink2 }]} numberOfLines={1}>{r.teeName} · {holesLabel(r.holeCount, r.firstHole)}</Text>
        </View>
        <Text style={[styles.rowSub, { color: c.ink3 }]}>{r.gross != null ? `${r.gross} gross` : `${r.adjusted} handicap score`}</Text>
      </View>
      <Text style={[styles.rowTitle, { color: c.ink }]}>{r.points} pts</Text>
    </Pressable>
  );

  const panel = (title: string, children: React.ReactNode, right?: string) =>
    isDesktop ? (
      <DesktopPanel title={title} headerRight={right ? <Muted>{right}</Muted> : undefined}>{children}</DesktopPanel>
    ) : (
      <Tile style={{ gap: 10 }}>
        <Text style={styles.h2}>{title}{right ? <Text style={styles.muted}>  {right}</Text> : null}</Text>
        {children}
      </Tile>
    );

  const body = () => {
    if (loading && !data) return <Tile><SkeletonRows rows={4} /></Tile>;
    if (error && !data) return <Tile><ErrorState body={error} onRetry={() => load(period)} /></Tile>;
    if (!data || !s || !m) return null;
    if (s.rounds === 0) {
      return (
        <Tile>
          <EmptyState icon="golf-outline" title={`No rounds ${GOLF_PERIOD_WORDS[period]}`} body={`${m.firstName}’s finished rounds on ${data.courseName ?? 'your course'} show here.`} />
        </Tile>
      );
    }
    const trend = panel('Points, recent rounds', <PointsTrend points={s.pointsTrend.map((p) => p.points)} refLine={target} />, `dashed line: ${target}, played to handicap`);
    const pars = s.parAverages.length
      ? panel(
          'Average score by par',
          <>
            <ParAverages pars={s.parAverages} />
            {s.nines && Math.abs(s.nines.front - s.nines.back) >= 0.5 ? (
              <Muted>
                Scores {fmt1(Math.abs(s.nines.front - s.nines.back))} more strokes on the {s.nines.back > s.nines.front ? 'back' : 'front'} nine, on average.
              </Muted>
            ) : null}
          </>,
        )
      : null;
    const putting = s.putting
      ? panel(
          'Putting and fairways',
          <>
            <View style={styles.minis}>
              <MiniStat label="putts per 18" value={fmt1(s.putting.puttsPer18)} />
              <MiniStat label="three-putts per 18" value={fmt1(s.putting.threePuttsPer18)} />
              <MiniStat label="greens in regulation" value={fmtPct(s.putting.girPct)} />
              <MiniStat label="fairways hit" value={fmtPct(s.putting.fairwayPct)} />
            </View>
            {s.putting.fairwayHoles ? (
              <Muted>Missed fairways: {fmtPct(s.putting.missLeftPct)} left, {fmtPct(s.putting.missRightPct)} right, from {s.putting.fairwayHoles} tee shots.</Muted>
            ) : null}
          </>,
          `from ${s.putting.holes} holes`,
        )
      : panel('Putting and fairways', <Muted>{m.firstName} hasn’t entered putts and fairways on these rounds.</Muted>);
    const mix = s.mixPer18 ? panel('Scoring mix', <MixBar mix={s.mixPer18} />, 'per 18 holes') : null;
    const tough = s.toughestHoles ? panel('Toughest holes', <ToughestHoles data={s.toughestHoles} />) : null;

    if (isDesktop) {
      return (
        <>
          <View style={styles.kpis}>
            {kpis.map((k) => (
              <View key={k.label} style={styles.kpi}>
                <DesktopStatCard label={k.label} value={k.value} icon={k.icon} />
              </View>
            ))}
          </View>
          <View style={styles.row}>
            <View style={styles.colWide}>{trend}</View>
            <View style={styles.colNarrow}>{pars}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.colThird}>{putting}</View>
            <View style={styles.colThird}>{mix}</View>
            <View style={styles.colThird}>{tough}</View>
          </View>
          <DesktopPanel title="Rounds" headerRight={<Muted>{`${s.rounds} ${GOLF_PERIOD_WORDS[period]} · newest first`}</Muted>}>
            <DesktopDataTable columns={roundColumns} rows={s.recent} keyExtractor={(r) => r.id} />
            <Muted style={{ marginTop: 10 }}>Gross shows a dash when a hole was picked up. The handicap score counts a pick-up as net double bogey.</Muted>
          </DesktopPanel>
        </>
      );
    }
    return (
      <>
        <View style={styles.grid}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.gridCell}>
              <AdminStatCard label={k.label} value={k.value} icon={k.icon} fill />
            </View>
          ))}
        </View>
        {trend}
        <Tile padded={false} style={{ paddingVertical: 6 }}>
          <Text style={[styles.h2, { paddingHorizontal: 16, paddingTop: 10 }]}>Rounds</Text>
          {s.recent.map(roundRowMobile)}
        </Tile>
        {pars}
        {putting}
        {mix}
        {tough}
      </>
    );
  };

  return (
    <GolfFrame breadcrumb={`Golf › ${name}`} title={name} subtitle={data ? data.clubName : undefined} headerRight={periodToggle(false)}>
      {isDesktop ? (
        <View style={styles.head}>
          {m ? (
            <View style={styles.bigAv}>
              <Text style={styles.bigAvText}>{initials(m.firstName, m.lastName)}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <PageTitle>{name}</PageTitle>
            {facts}
          </View>
        </View>
      ) : (
        <>
          {facts}
          {periodToggle(true)}
        </>
      )}
      {body()}
    </GolfFrame>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    bigAv: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
    bigAvText: { ...adminFont.title, fontSize: 24, color: '#CDDE5C' },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    kpi: { flexGrow: 1, flexBasis: '20%', minWidth: 190 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
    colWide: { flexGrow: 999, flexShrink: 1, flexBasis: 520, minWidth: 0 },
    colNarrow: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 },
    colThird: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gridCell: { flexBasis: '47%', flexGrow: 1 },
    minis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    h2: { ...adminFont.bodyBold, fontSize: 16, color: c.ink },
    muted: { ...adminFont.body, fontSize: 12.5, color: c.ink3 },
    strong: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14, color: c.ink, textAlign: 'right' },
    best: { ...adminFont.bodyBold, fontSize: 11.5 },
    link: { ...adminFont.bodySemiBold, fontSize: 13.5 },
    teeLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 16 },
    rowTitle: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14 },
    rowSub: { ...adminFont.body, fontSize: 12.5 },
  });
}
