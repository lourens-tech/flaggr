import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAdminTheme } from '../../context/ThemeContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { adminApi, AdminApiError } from '../../api/adminClient';
import { BarChart } from '../../components/common/BarChart';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { DesktopDataTable, TableTag, TableText, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { ErrorState, Muted, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';
import { GOLF_PERIOD_OPTIONS, GOLF_PERIOD_WORDS, GolfFrame, TeeDot, fmt1, fmtPct, shortDate } from '../../components/admin/golf/GolfParts';
import type { SuperAdminStackParamList } from '../../navigation/types';
import type { GolfMapStatus, SuperAdminGolfBestRound, SuperAdminGolfClubRow, SuperAdminGolfDto } from '../../golf/adminDto';
import type { GolfPeriod } from '../../golf/clubStats';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

const MAP_LABEL: Record<string, string> = { live: 'Live', draft: 'Being built', none: 'Not started' };
const mapTone = (s: GolfMapStatus) => (s === 'live' ? 'green' : s === 'draft' ? 'amber' : 'gray') as 'green' | 'amber' | 'gray';

// Insights › Golf: rounds members keep on Flagrr, every club side by side.
// Opening a club shows that club's own Golf page (AdminGolfScreen).
export function SuperAdminGolfScreen() {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const navigation = useNavigation<NativeStackNavigationProp<SuperAdminStackParamList>>();
  const [period, setPeriod] = useState<GolfPeriod>('year');
  const [data, setData] = useState<SuperAdminGolfDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: GolfPeriod) => {
    setLoading(true);
    try {
      setData(await adminApi.superAdminGolf(p));
      setError(null);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period]),
  );

  const openClub = (row: { courseId: string; name: string }) => navigation.navigate('SuperAdminGolfClub', { courseId: row.courseId, courseName: row.name });
  const openRound = (roundId: string) => navigation.navigate('SuperAdminGolfScorecard', { roundId });
  const periodToggle = (full: boolean) => <Segmented accessibilityLabel="Period" fullWidth={full} value={period} onChange={setPeriod} options={GOLF_PERIOD_OPTIONS} />;
  const t = data?.totals;

  const kpis = t
    ? [
        { label: 'Rounds played', value: t.rounds.toLocaleString(), icon: 'golf-outline' as const, delta: true },
        { label: 'Members playing', value: t.membersPlaying.toLocaleString(), icon: 'people-outline' as const, delta: false },
        { label: 'Clubs with a live course map', value: `${t.liveMaps} of ${t.clubs}`, icon: 'map-outline' as const, delta: false },
        { label: 'Stableford average', value: fmt1(t.pointsAverage), icon: 'star-outline' as const, delta: false },
      ]
    : [];

  const clubColumns: DesktopTableColumn<SuperAdminGolfClubRow>[] = [
    {
      key: 'club',
      label: 'Club',
      width: 230,
      sortValue: (r) => r.name,
      render: (r) => (
        <Pressable onPress={() => openClub(r)} accessibilityRole="link" accessibilityLabel={`Open ${r.name}’s golf`}>
          <Text style={[styles.clubName, { color: c.ink }]} numberOfLines={1}>{r.name}</Text>
        </Pressable>
      ),
    },
    { key: 'map', label: 'Course map', width: 120, sortValue: (r) => r.mapStatus ?? 'z', render: (r) => <TableTag label={MAP_LABEL[r.mapStatus ?? 'none']} tone={mapTone(r.mapStatus)} /> },
    { key: 'members', label: 'Members', width: 100, align: 'right', sortValue: (r) => r.membersPlaying, render: (r) => <TableText>{r.membersPlaying}</TableText> },
    { key: 'rounds', label: 'Rounds', width: 90, align: 'right', sortValue: (r) => r.rounds, render: (r) => <Text style={styles.strong}>{r.rounds.toLocaleString()}</Text> },
    {
      key: 'avg',
      label: 'Avg points',
      width: 115,
      align: 'right',
      sortValue: (r) => r.pointsAverage ?? -1,
      render: (r) => <TableText muted={r.pointsAverage == null}>{fmt1(r.pointsAverage)}{r.basis === 9 ? ' (9)' : ''}</TableText>,
    },
    { key: 'hcp', label: 'To handicap', width: 115, align: 'right', sortValue: (r) => r.playedToHandicapPct ?? -1, render: (r) => <TableText muted={r.playedToHandicapPct == null}>{fmtPct(r.playedToHandicapPct)}</TableText> },
    { key: 'last', label: 'Last round', width: 110, align: 'right', sortValue: (r) => r.lastPlayedAt ?? '', render: (r) => <TableText muted={!r.lastPlayedAt}>{r.lastPlayedAt ? shortDate(r.lastPlayedAt) : '–'}</TableText> },
  ];

  const bestRow = (b: SuperAdminGolfBestRound, i: number) => (
    <Pressable
      key={b.roundId}
      onPress={() => openRound(b.roundId)}
      accessibilityRole="link"
      accessibilityLabel={`${b.memberName}, ${b.points} points at ${b.clubName}. Open scorecard`}
      style={({ pressed }) => [styles.best, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.rank, { color: c.ink3 }]}>{i + 1}</Text>
      <View style={[styles.pts, { backgroundColor: c.fill }]}>
        <Text style={[styles.ptsVal, { color: c.ink }]}>{b.points}</Text>
        <Text style={[styles.ptsUnit, { color: c.ink3 }]}>pts</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{b.memberName}</Text>
        <View style={styles.teeLine}>
          <TeeDot color={b.teeColor} />
          <Text style={[styles.rowSub, { color: c.ink2 }]} numberOfLines={1}>{b.clubName} · {b.teeName}</Text>
        </View>
      </View>
      <Text style={[styles.rowSub, { color: c.ink3 }]}>{shortDate(b.completedAt)}</Text>
    </Pressable>
  );

  const clubRowMobile = (r: SuperAdminGolfClubRow, i: number) => (
    <Pressable
      key={r.courseId}
      onPress={() => openClub(r)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.mRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{r.name}</Text>
        <Text style={[styles.rowSub, { color: c.ink2 }]}>
          {MAP_LABEL[r.mapStatus ?? 'none']} · {r.membersPlaying} playing · {fmt1(r.pointsAverage)} avg pts
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.ptsVal, { color: c.ink }]}>{r.rounds}</Text>
        <Text style={[styles.ptsUnit, { color: c.ink3 }]}>rounds</Text>
      </View>
    </Pressable>
  );

  const body = () => {
    if (loading && !data) return <Tile><SkeletonRows rows={4} /></Tile>;
    if (error && !data) return <Tile><ErrorState body={error} onRetry={() => load(period)} /></Tile>;
    if (!data || !t) return null;
    const bestPanel = data.best.length ? data.best.map(bestRow) : <Muted>No 18-hole rounds {GOLF_PERIOD_WORDS[period]}.</Muted>;
    if (isDesktop) {
      return (
        <>
          <View style={styles.kpis}>
            {kpis.map((k) => (
              <View key={k.label} style={styles.kpi}>
                <DesktopStatCard label={k.label} value={k.value} icon={k.icon} deltaPct={t.roundsDeltaPct} showDelta={k.delta && period !== 'all' && (t.rounds > 0 || t.roundsDeltaPct !== 0)} />
              </View>
            ))}
          </View>
          <DesktopPanel title="By club" headerRight={<Muted>most rounds first · open a club for its members</Muted>}>
            <DesktopDataTable columns={clubColumns} rows={data.clubs} keyExtractor={(r) => r.courseId} />
            <Muted style={{ marginTop: 10 }}>
              Counts rounds members play on their own club’s course, from members who share their rounds with their club.
            </Muted>
          </DesktopPanel>
          <View style={styles.row}>
            <View style={styles.colNarrow}>
              <DesktopPanel title="Best rounds" headerRight={<Muted>{GOLF_PERIOD_WORDS[period]}, 18 holes</Muted>}>{bestPanel}</DesktopPanel>
            </View>
            <View style={styles.colWide}>
              <DesktopPanel title="Rounds played" headerRight={<Muted>{period === 'month' ? 'by day' : period === 'year' ? 'by month' : 'by year'}</Muted>}>
                <BarChart data={data.series} height={170} />
              </DesktopPanel>
            </View>
          </View>
        </>
      );
    }
    return (
      <>
        <View style={styles.grid}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.gridCell}>
              <AdminStatCard label={k.label} value={k.value} icon={k.icon} deltaPct={t.roundsDeltaPct} showDelta={k.delta && period !== 'all' && (t.rounds > 0 || t.roundsDeltaPct !== 0)} fill />
            </View>
          ))}
        </View>
        <Tile padded={false} style={{ paddingVertical: 6 }}>
          <Text style={[styles.h2, { paddingHorizontal: 16, paddingTop: 10 }]}>By club</Text>
          {data.clubs.map(clubRowMobile)}
        </Tile>
        <Tile style={{ gap: 6 }}>
          <Text style={styles.h2}>Best rounds</Text>
          {bestPanel}
        </Tile>
        <Tile style={{ gap: 12 }}>
          <Text style={styles.h2}>Rounds played</Text>
          <BarChart data={data.series} height={120} />
        </Tile>
      </>
    );
  };

  const intro = 'Rounds members keep on the Flagrr scorecard at their own club’s course, across every club. Open a club to see its members and their scorecards.';
  return (
    <GolfFrame breadcrumb="Insights › Golf" title="Golf" headerRight={periodToggle(false)}>
      {isDesktop ? (
        <View style={{ gap: 6 }}>
          <PageTitle>Golf</PageTitle>
          <Muted style={{ maxWidth: 720 }}>{intro}</Muted>
        </View>
      ) : (
        <>
          <Muted>{intro}</Muted>
          {periodToggle(true)}
        </>
      )}
      {body()}
    </GolfFrame>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    kpi: { flexGrow: 1, flexBasis: '20%', minWidth: 190 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
    colWide: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
    colNarrow: { flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0, gap: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gridCell: { flexBasis: '47%', flexGrow: 1 },
    h2: { ...adminFont.bodyBold, fontSize: 16, color: c.ink },
    clubName: { ...adminFont.bodyBold, fontSize: 14 },
    strong: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14, color: c.ink, textAlign: 'right' },
    best: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rank: { ...adminFont.bodyBold, ...tabularNums, width: 18, fontSize: 13 },
    pts: { minWidth: 50, height: 44, borderRadius: adminRadius.sm, alignItems: 'center', justifyContent: 'center' },
    ptsVal: { ...adminFont.bodyBold, ...tabularNums, fontSize: 17, lineHeight: 19 },
    ptsUnit: { ...adminFont.body, fontSize: 10.5 },
    rowTitle: { ...adminFont.bodyBold, fontSize: 14 },
    rowSub: { ...adminFont.body, fontSize: 12.5 },
    teeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    mRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 62, paddingHorizontal: 16 },
  });
}
