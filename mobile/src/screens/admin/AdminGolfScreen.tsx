import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminTheme } from '../../context/ThemeContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminApiError } from '../../api/adminClient';
import { BarChart } from '../../components/common/BarChart';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { DesktopDataTable, TableAvatarCell, TableText, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { EmptyState, ErrorState, Muted, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';
import {
  GOLF_PERIOD_OPTIONS,
  GOLF_PERIOD_WORDS,
  GolfFrame,
  MixBar,
  Sparkline,
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
import type { GolfClubOverviewDto } from '../../golf/adminDto';
import type { GolfLatestRound, GolfMemberRow, GolfPeriod } from '../../golf/clubStats';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

// Golf: the rounds a club's members play on its course and what they say
// about their game. Course admins see their own club (Members › Golf); a super
// admin opens any club from Insights › Golf (route params courseId/courseName).
export function AdminGolfScreen() {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const route = useRoute();
  const params = (route.params ?? {}) as { courseId?: string; courseName?: string };
  const golf = useGolfAccess();
  const go = useGolfNavigate();
  const [period, setPeriod] = useState<GolfPeriod>('year');
  const [data, setData] = useState<GolfClubOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (p: GolfPeriod) => {
      setLoading(true);
      try {
        setData(await golf.overview(p, params.courseId));
        setError(null);
      } catch (err) {
        setError(err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [golf, params.courseId],
  );

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period]),
  );

  const openMember = (userId: string) => go(golf.routes.member, { userId });
  const openRound = (roundId: string) => go(golf.routes.scorecard, { roundId });

  const clubName = data?.clubName ?? params.courseName ?? '';
  const sum = data?.summary;
  const basisWord = sum?.basis === 9 ? '9-hole rounds' : '18-hole rounds';
  const parTarget = sum?.basis === 9 ? 18 : 36;
  const periodToggle = (full: boolean) => (
    <Segmented accessibilityLabel="Period" fullWidth={full} value={period} onChange={setPeriod} options={GOLF_PERIOD_OPTIONS} />
  );

  const kpis = sum
    ? [
        { label: 'Rounds played', value: sum.rounds.toLocaleString(), icon: 'golf-outline' as const, delta: true },
        { label: 'Members playing', value: sum.membersPlaying.toLocaleString(), icon: 'people-outline' as const, delta: false },
        { label: 'Stableford average', value: fmt1(sum.pointsAverage), icon: 'star-outline' as const, delta: false },
        { label: 'Played to handicap', value: fmtPct(sum.playedToHandicapPct), icon: 'flag-outline' as const, delta: false },
        { label: 'Putts per 18', value: fmt1(sum.puttsPer18), icon: 'ellipse-outline' as const, delta: false },
      ]
    : [];

  const intro = golf.isSuper
    ? `Rounds ${clubName || 'this club'}’s members keep on the Flagrr scorecard at their own course.`
    : 'Rounds your members keep on the Flagrr scorecard at your course, and what they say about their game. Members can turn sharing off in My Golf.';

  const empty = () => {
    if (!data) return null;
    if (!data.golfCourseId || data.mapStatus !== 'live') {
      if (data.golfCourseId && data.summary.rounds > 0) return null; // map unpublished since: keep showing past rounds
      return (
        <Tile>
          <EmptyState
            icon="map-outline"
            title={golf.isSuper ? 'No live course map yet' : 'Your course map isn’t live yet'}
            body={
              golf.isSuper
                ? 'Members can keep score here once this club’s course map is published under Course Maps.'
                : 'Once Flagrr has built and published your course map (see the Course map panel on Home), members can keep their scorecards here and their rounds show on this page.'
            }
          />
        </Tile>
      );
    }
    if (data.summary.rounds === 0) {
      return (
        <Tile>
          <EmptyState
            icon="golf-outline"
            title={`No rounds ${GOLF_PERIOD_WORDS[period]}`}
            body="Rounds appear here when members finish a scorecard on your course in the Flagrr app."
          />
        </Tile>
      );
    }
    return null;
  };

  const memberColumns: DesktopTableColumn<GolfMemberRow>[] = [
    {
      key: 'member',
      label: 'Member',
      width: 230,
      sortValue: (m) => `${m.firstName} ${m.lastName}`,
      render: (m) => (
        <Pressable onPress={() => openMember(m.userId)} accessibilityRole="link" accessibilityLabel={`Open ${m.firstName} ${m.lastName}’s golf`}>
          <TableAvatarCell name={`${m.firstName} ${m.lastName}`} />
        </Pressable>
      ),
    },
    { key: 'hi', label: 'Handicap', width: 100, align: 'right', sortValue: (m) => m.handicapIndex ?? 99, render: (m) => <TableText muted={m.handicapIndex == null}>{fmtIndex(m.handicapIndex)}</TableText> },
    { key: 'rounds', label: 'Rounds', width: 80, align: 'right', sortValue: (m) => m.rounds, render: (m) => <TableText>{m.rounds}</TableText> },
    {
      key: 'avg',
      label: 'Avg points',
      width: 115,
      align: 'right',
      sortValue: (m) => m.pointsAverage ?? -1,
      render: (m) => (
        <Text style={styles.strong}>
          {fmt1(m.pointsAverage)}
          {m.basis === 9 ? <Text style={styles.muted}> (9)</Text> : null}
        </Text>
      ),
    },
    { key: 'best', label: 'Best', width: 70, align: 'right', sortValue: (m) => m.bestPoints ?? -1, render: (m) => <TableText>{m.bestPoints ?? '–'}</TableText> },
    { key: 'sc', label: 'Avg score', width: 105, align: 'right', sortValue: (m) => m.scoringAverage ?? 999, render: (m) => <TableText>{fmt1(m.scoringAverage)}</TableText> },
    { key: 'last', label: 'Last round', width: 100, sortValue: (m) => m.lastPlayedAt, render: (m) => <TableText>{shortDate(m.lastPlayedAt)}</TableText> },
    { key: 'trend', label: 'Recent', width: 110, render: (m) => <Sparkline values={m.trend} /> },
  ];

  const latestRow = (r: GolfLatestRound, i: number) => (
    <Pressable
      key={r.id}
      onPress={() => openRound(r.id)}
      accessibilityRole="link"
      accessibilityLabel={`${r.memberName}, ${r.points} points, ${shortDate(r.completedAt)}. Open scorecard`}
      style={({ pressed }) => [styles.latest, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.pts, { backgroundColor: c.fill }]}>
        <Text style={[styles.ptsVal, { color: c.ink }]}>{r.points}</Text>
        <Text style={[styles.ptsUnit, { color: c.ink3 }]}>pts</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{r.memberName}</Text>
        <View style={styles.teeLine}>
          <TeeDot color={r.teeColor} />
          <Text style={[styles.rowSub, { color: c.ink2 }]} numberOfLines={1}>
            {r.teeName} · {holesLabel(r.holeCount, r.firstHole)}
            {r.gross != null ? ` · ${r.gross} gross` : ` · ${r.adjusted} handicap score`}
          </Text>
        </View>
      </View>
      <Text style={[styles.rowSub, { color: c.ink3 }]}>{shortDate(r.completedAt)}</Text>
    </Pressable>
  );

  const memberRowMobile = (m: GolfMemberRow, i: number) => (
    <Pressable
      key={m.userId}
      onPress={() => openMember(m.userId)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.mRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.av}>
        <Text style={styles.avText}>{initials(m.firstName, m.lastName)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{m.firstName} {m.lastName}</Text>
        <Text style={[styles.rowSub, { color: c.ink2 }]}>Handicap {fmtIndex(m.handicapIndex)} · {m.rounds} round{m.rounds === 1 ? '' : 's'}</Text>
      </View>
      <Sparkline values={m.trend} width={54} height={22} />
      <View style={{ alignItems: 'flex-end', minWidth: 44 }}>
        <Text style={[styles.ptsVal, { color: c.ink }]}>{fmt1(m.pointsAverage)}</Text>
        <Text style={[styles.ptsUnit, { color: c.ink3 }]}>avg pts</Text>
      </View>
    </Pressable>
  );

  const body = () => {
    if (loading && !data) return <Tile><SkeletonRows rows={4} /></Tile>;
    if (error && !data) return <Tile><ErrorState body={error} onRetry={() => load(period)} /></Tile>;
    if (!data || !sum) return null;
    const blank = empty();
    const charts = (
      <>
        {sum.mixPer18 ? (
          isDesktop ? (
            <DesktopPanel title="Scoring mix" headerRight={<Muted>per 18 holes</Muted>} style={styles.half}><MixBar mix={sum.mixPer18} /></DesktopPanel>
          ) : (
            <Tile style={{ gap: 12 }}><Text style={styles.h2}>Scoring mix <Text style={styles.muted}>per 18 holes</Text></Text><MixBar mix={sum.mixPer18} /></Tile>
          )
        ) : null}
        {sum.toughestHoles ? (
          isDesktop ? (
            <DesktopPanel title="Toughest holes" headerRight={<Muted>over par, on average</Muted>} style={styles.half}><ToughestHoles data={sum.toughestHoles} /></DesktopPanel>
          ) : (
            <Tile style={{ gap: 6 }}><Text style={styles.h2}>Toughest holes</Text><ToughestHoles data={sum.toughestHoles} /></Tile>
          )
        ) : null}
      </>
    );

    if (isDesktop) {
      return (
        <>
          <View style={styles.kpis}>
            {kpis.map((k) => (
              <View key={k.label} style={styles.kpi}>
                <DesktopStatCard label={k.label} value={k.value} icon={k.icon} deltaPct={data.roundsDeltaPct} showDelta={k.delta && period !== 'all' && (sum.rounds > 0 || data.roundsDeltaPct !== 0)} />
              </View>
            ))}
          </View>
          {blank ?? (
            <>
              <View style={styles.row}>
                <View style={styles.colWide}>
                  <DesktopPanel title="Rounds played" headerRight={<Muted>{period === 'month' ? 'by day' : period === 'year' ? 'by month' : 'by year'}</Muted>}>
                    <BarChart data={data.series} height={170} />
                  </DesktopPanel>
                  <View style={styles.row}>{charts}</View>
                </View>
                <View style={styles.colNarrow}>
                  <DesktopPanel title="Latest rounds">{data.latest.map(latestRow)}</DesktopPanel>
                </View>
              </View>
              <DesktopPanel title="Members" headerRight={<Muted>{`${data.members.length} playing · best Stableford average first`}</Muted>}>
                <DesktopDataTable columns={memberColumns} rows={data.members} keyExtractor={(m) => m.userId} />
                <Muted style={{ marginTop: 10 }}>
                  Averages and best rounds use {basisWord} where a member has them; (9) marks a member with only 9-hole rounds. Played to
                  handicap means {parTarget} points or more. A member with no Handicap Index plays off scratch.
                </Muted>
              </DesktopPanel>
            </>
          )}
        </>
      );
    }

    return (
      <>
        <View style={styles.grid}>
          {kpis.slice(0, 4).map((k) => (
            <View key={k.label} style={styles.gridCell}>
              <AdminStatCard label={k.label} value={k.value} icon={k.icon} deltaPct={data.roundsDeltaPct} showDelta={k.delta && period !== 'all' && (sum.rounds > 0 || data.roundsDeltaPct !== 0)} fill />
            </View>
          ))}
        </View>
        {blank ?? (
          <>
            <Tile style={{ gap: 12 }}>
              <Text style={styles.h2}>Rounds played</Text>
              <BarChart data={data.series} height={120} />
            </Tile>
            <Tile padded={false} style={{ paddingVertical: 6 }}>
              <Text style={[styles.h2, { paddingHorizontal: 16, paddingTop: 10 }]}>Members</Text>
              {data.members.map(memberRowMobile)}
            </Tile>
            {charts}
            <Tile padded={false} style={{ paddingVertical: 6 }}>
              <Text style={[styles.h2, { paddingHorizontal: 16, paddingTop: 10 }]}>Latest rounds</Text>
              <View style={{ paddingHorizontal: 4 }}>{data.latest.map(latestRow)}</View>
            </Tile>
          </>
        )}
      </>
    );
  };

  return (
    <GolfFrame
      breadcrumb={golf.isSuper ? `Golf › ${clubName}` : 'Members › Golf'}
      title={golf.isSuper ? clubName || 'Golf' : 'Golf'}
      subtitle={golf.isSuper ? 'Golf' : undefined}
      headerRight={periodToggle(false)}
    >
      {isDesktop ? (
        <View style={{ gap: 6 }}>
          <PageTitle>{golf.isSuper ? clubName || 'Golf' : 'Golf'}</PageTitle>
          <Muted style={{ maxWidth: 720 }}>{intro}</Muted>
        </View>
      ) : (
        <>
          <Muted>{intro}</Muted>
          {periodToggle(true)}
        </>
      )}
      {body()}
      {error && data ? (
        <View style={styles.inlineErr}>
          <Ionicons name="alert-circle-outline" size={16} color={c.neg} />
          <Text style={[styles.rowSub, { color: c.neg }]}>{error}</Text>
        </View>
      ) : null}
    </GolfFrame>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    kpi: { flexGrow: 1, flexBasis: '15%', minWidth: 170 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
    colWide: { flexGrow: 999, flexShrink: 1, flexBasis: 560, minWidth: 0, gap: 14 },
    colNarrow: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, gap: 14 },
    half: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gridCell: { flexBasis: '47%', flexGrow: 1 },
    h2: { ...adminFont.bodyBold, fontSize: 16, color: c.ink },
    strong: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14, color: c.ink, textAlign: 'right' },
    muted: { ...adminFont.body, fontSize: 12.5, color: c.ink3 },
    latest: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 },
    pts: { minWidth: 50, height: 44, borderRadius: adminRadius.sm, alignItems: 'center', justifyContent: 'center' },
    ptsVal: { ...adminFont.bodyBold, ...tabularNums, fontSize: 17, lineHeight: 19 },
    ptsUnit: { ...adminFont.body, fontSize: 10.5 },
    rowTitle: { ...adminFont.bodyBold, fontSize: 14 },
    rowSub: { ...adminFont.body, fontSize: 12.5 },
    teeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    mRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 62, paddingHorizontal: 16 },
    av: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
    avText: { ...adminFont.bodyBold, fontSize: 12, color: '#CDDE5C' },
    inlineErr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  });
}
