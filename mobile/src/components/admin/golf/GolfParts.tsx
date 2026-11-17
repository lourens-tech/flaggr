import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useAdmin } from '../../../context/AdminContext';
import { useAdminTheme } from '../../../context/ThemeContext';
import { useIsDesktopNav } from '../../../hooks/useIsDesktopNav';
import { adminApi } from '../../../api/adminClient';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../../theme/admin';
import { AdminDesktopFrame } from '../desktop/AdminDesktopFrame';
import { SuperAdminDesktopFrame } from '../desktop/SuperAdminDesktopFrame';
import { AdminMobileHeader } from '../AdminMobileHeader';
import { holeResult, roundTotals, type RoundSetup } from '../../../golf/scoring';
import type { RoundDto } from '../../../golf/dto';
import type { GolfStats } from '../../../golf/stats';
import type { GolfPeriod } from '../../../golf/clubStats';

// Shared pieces of the admin Golf pages (course admin and super admin): the
// role-specific routes and API calls, the page frame, and the charts and
// scorecard grid. See docs/Admin-Console-Features.md, "Golf".

export const GOLF_PERIODS: GolfPeriod[] = ['month', 'year', 'all'];
export const GOLF_PERIOD_OPTIONS = GOLF_PERIODS.map((p) => ({ key: p, label: { month: 'Month', year: 'Year', all: 'All' }[p] }));
export const GOLF_PERIOD_WORDS: Record<GolfPeriod, string> = { month: 'this month', year: 'this year', all: 'all time' };

export const fmt1 = (n: number | null | undefined) => (n == null ? '–' : n.toFixed(1));
export const fmtPct = (n: number | null | undefined) => (n == null ? '–' : `${Math.round(n)}%`);
export const fmtIndex = (v: number | null) => (v == null ? 'Not entered' : v < 0 ? `+${(-v).toFixed(1)}` : v.toFixed(1));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Built by hand so every platform shows "9 Nov" (locales differ: "09 Nov", "9 Sept").
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`}`;
};
export const longDate = (iso: string) => {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
};
export const initials = (first: string, last: string) => `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
export const holesLabel = (count: number, first: number) => (count === 18 ? '18 holes' : first === 1 ? 'Front 9' : first === 10 ? 'Back 9' : `${count} holes`);

/** Routes, sidebar key and API calls for whoever is signed in. */
export function useGolfAccess() {
  const { admin } = useAdmin();
  const isSuper = admin.role === 'super_admin';
  return useMemo(
    () => ({
      isSuper,
      activeKey: isSuper ? 'SuperAdminGolf' : 'AdminGolf',
      routes: isSuper
        ? { member: 'SuperAdminGolfMember', scorecard: 'SuperAdminGolfScorecard' }
        : { member: 'AdminGolfMember', scorecard: 'AdminGolfScorecard' },
      overview: (period: GolfPeriod, courseId?: string) =>
        isSuper ? adminApi.superAdminGolfClub(courseId ?? '', period) : adminApi.golfOverview(period),
      member: (userId: string, period: GolfPeriod) => (isSuper ? adminApi.superAdminGolfMember(userId, period) : adminApi.golfMember(userId, period)),
      scorecard: (id: string) => (isSuper ? adminApi.superAdminGolfScorecard(id) : adminApi.golfScorecard(id)),
    }),
    [isSuper],
  );
}

/** navigate() to a Golf route by name (the names differ per console). */
export function useGolfNavigate() {
  const navigation = useNavigation();
  return (route: string, params: Record<string, string>) => (navigation as unknown as { navigate: (r: string, p: object) => void }).navigate(route, params);
}

/** The page frame: the console's desktop shell, or the phone header and a scroll view. */
export function GolfFrame({
  breadcrumb,
  title,
  subtitle,
  headerRight,
  children,
}: {
  breadcrumb: string;
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isDesktop = useIsDesktopNav();
  const { isSuper, activeKey } = useGolfAccess();
  if (isDesktop) {
    const Frame = isSuper ? SuperAdminDesktopFrame : AdminDesktopFrame;
    return (
      <Frame activeKey={activeKey} breadcrumb={breadcrumb} headerRight={headerRight} showRail={false}>
        {children}
      </Frame>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <AdminMobileHeader title={title} subtitle={subtitle} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120, gap: 14 }} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

/** A small line of the last few rounds' points. */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  const { c } = useAdminTheme();
  if (values.length < 2) return <View style={{ width, height }} />;
  const lo = Math.min(...values) - 2;
  const hi = Math.max(...values) + 2;
  const pts = values
    .map((v, i) => `${(3 + (i * (width - 6)) / (values.length - 1)).toFixed(1)},${(height - 3 - ((v - lo) / (hi - lo)) * (height - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Points in the last ${values.length} rounds: ${values.join(', ')}`}>
      <Svg width={width} height={height}>
        <Polyline points={pts} fill="none" stroke={c.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function mixColors(c: AdminColors) {
  return { birdie: c.accent, par: '#8FB39E', bogey: c.amber, double: c.neg };
}

/** Birdies, pars, bogeys and doubles per 18 holes, as a bar and a legend. */
export function MixBar({ mix }: { mix: NonNullable<GolfStats['mixPer18']> }) {
  const { c } = useAdminTheme();
  const k = mixColors(c);
  const parts = [
    { name: 'Birdie or better', v: mix.birdieOrBetter, color: k.birdie },
    { name: 'Par', v: mix.par, color: k.par },
    { name: 'Bogey', v: mix.bogey, color: k.bogey },
    { name: 'Double or worse', v: mix.doubleOrWorse, color: k.double },
  ];
  return (
    <View style={{ gap: 12 }}>
      <View
        style={[s.mixBar, { backgroundColor: c.fill }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Per 18 holes: ${parts.map((p) => `${fmt1(p.v)} ${p.name.toLowerCase()}`).join(', ')}`}
      >
        {parts.filter((p) => p.v > 0).map((p) => (
          <View key={p.name} style={{ flex: p.v, backgroundColor: p.color }} />
        ))}
      </View>
      <View style={s.legend}>
        {parts.map((p) => (
          <View key={p.name} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: p.color }]} />
            <Text style={[s.legendName, { color: c.ink2 }]} numberOfLines={1}>{p.name}</Text>
            <Text style={[s.legendVal, { color: c.ink }]}>{fmt1(p.v)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The holes scored furthest over par, on average. */
export function ToughestHoles({ data }: { data: NonNullable<GolfStats['toughestHoles']> }) {
  const { c } = useAdminTheme();
  const max = Math.max(...data.holes.map((h) => h.overPar), 1);
  return (
    <View>
      {data.holes.map((h, i) => (
        <View key={h.n} style={[s.toughRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }]}>
          <View style={[s.holeNo, { backgroundColor: c.fill }]}>
            <Text style={[s.holeNoText, { color: c.ink }]}>{h.n}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.rowTitle, { color: c.ink }]}>Hole {h.n}</Text>
            <Text style={[s.rowSub, { color: c.ink3 }]} numberOfLines={1}>Par {h.par} · SI {h.si} · {fmt1(h.points)} pts</Text>
          </View>
          <View style={[s.toughTrack, { backgroundColor: c.fill }]}>
            <View style={{ width: `${Math.max(4, (Math.max(0, h.overPar) / max) * 100)}%`, height: '100%', backgroundColor: c.amber, borderRadius: 99 }} />
          </View>
          <Text style={[s.toughVal, { color: c.ink }]}>{h.overPar >= 0 ? '+' : '−'}{Math.abs(h.overPar).toFixed(2)}</Text>
        </View>
      ))}
      <Text style={[s.rowSub, { color: c.ink3, marginTop: 8 }]}>From {data.rounds} round{data.rounds === 1 ? '' : 's'} at {data.courseName}</Text>
    </View>
  );
}

/** Stableford points in recent rounds, with a dashed line at playing to handicap. */
export function PointsTrend({ points, refLine }: { points: number[]; refLine: number }) {
  const { c } = useAdminTheme();
  const [w, setW] = useState(0);
  const H = 190;
  if (!points.length) return null;
  const lo = Math.min(refLine - 6, ...points) - 2;
  const hi = Math.max(refLine + 4, ...points) + 2;
  const y = (v: number) => 10 + (1 - (v - lo) / (hi - lo)) * (H - 20);
  const x = (i: number) => (points.length === 1 ? w / 2 : 26 + (i * (w - 36)) / (points.length - 1));
  const grid = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.8].map(Math.round);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Stableford points in the last ${points.length} rounds: ${points.join(', ')}`}
    >
      {w > 0 ? (
        <Svg width={w} height={H}>
          {grid.map((g) => (
            <React.Fragment key={g}>
              <Line x1={24} x2={w} y1={y(g)} y2={y(g)} stroke={c.edge} strokeWidth={1} />
              <SvgText x={0} y={y(g) + 4} fontSize={11} fill={c.ink3}>{g}</SvgText>
            </React.Fragment>
          ))}
          <Line x1={24} x2={w} y1={y(refLine)} y2={y(refLine)} stroke={c.ink3} strokeDasharray="5 6" strokeWidth={1} />
          {points.length > 1 ? (
            <Polyline points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {points.map((v, i) => (
            <Circle key={i} cx={x(i)} cy={y(v)} r={i === points.length - 1 ? 5.5 : 3.5} fill={v >= refLine ? c.accent : c.surface} stroke={c.accent} strokeWidth={2} />
          ))}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
    </View>
  );
}

/** Average strokes on par 3s, 4s and 5s, with how far over par. */
export function ParAverages({ pars }: { pars: GolfStats['parAverages'] }) {
  const { c } = useAdminTheme();
  return (
    <View>
      {pars.map((p, i) => (
        <View key={p.par} style={[s.parRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }]}>
          <Text style={[s.rowTitle, { color: c.ink, width: 56 }]}>Par {p.par}</Text>
          <View style={[s.toughTrack, { flex: 1, backgroundColor: c.fill }]}>
            <View style={{ width: `${Math.min(100, Math.max(3, (p.average - p.par) * 100))}%`, height: '100%', backgroundColor: c.amber, borderRadius: 99 }} />
          </View>
          <Text style={[s.toughVal, { color: c.ink }]}>{p.average.toFixed(2)}</Text>
          <Text style={[s.rowSub, { color: c.ink3, width: 48, textAlign: 'right' }]}>
            {p.average - p.par >= 0 ? '+' : '−'}{Math.abs(p.average - p.par).toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A small label + value tile inside a panel. */
export function MiniStat({ label, value }: { label: string; value: string }) {
  const { c } = useAdminTheme();
  return (
    <View style={[s.mini, { backgroundColor: c.fill }]}>
      <Text style={[s.miniVal, { color: c.ink }]}>{value}</Text>
      <Text style={[s.rowSub, { color: c.ink2 }]}>{label}</Text>
    </View>
  );
}

/** A tee colour dot. */
export function TeeDot({ color }: { color: string }) {
  const { c } = useAdminTheme();
  return <View style={[s.tee, { backgroundColor: color, borderColor: c.edge }]} />;
}

const CELL = 42;
const LABEL = 118;
const SUM = 56;

/** The classic card: Out and In tables with par, stroke index, shots received,
 * score (circled under par, boxed over), points, and putts and fairways when
 * the member entered them. */
export function ScorecardGrid({ round }: { round: RoundDto }) {
  const { c } = useAdminTheme();
  const setup: RoundSetup = {
    holes: round.holes,
    handicaps: round.courseHandicap == null || round.playingHandicap == null ? null : { course: round.courseHandicap, playing: round.playingHandicap },
  };
  const results = round.holes.map((_, i) => holeResult(setup, i, round.entries[i]));
  const nines: Array<[number, number, string]> =
    round.holes.length === 18 ? [[0, 9, 'Out'], [9, 18, 'In']] : [[0, round.holes.length, round.holes[0]?.n === 10 ? 'In' : 'Out']];
  const stable = round.format === 'stableford';

  const shape = (i: number) => {
    const e = round.entries[i];
    if (!e || typeof e.s !== 'number') return null;
    const d = e.s - round.holes[i].par;
    if (d <= -2) return { borderRadius: 99, borderWidth: 3, borderColor: c.accent };
    if (d === -1) return { borderRadius: 99, borderWidth: 1.5, borderColor: c.accent };
    if (d === 1) return { borderRadius: 6, borderWidth: 1.5, borderColor: c.ink3 };
    if (d >= 2) return { borderRadius: 6, borderWidth: 3, borderColor: c.neg };
    return null;
  };
  const scoreColor = (i: number) => {
    const e = round.entries[i];
    if (!e || typeof e.s !== 'number') return c.ink3;
    const d = e.s - round.holes[i].par;
    return d < 0 ? c.accentText : d >= 2 ? c.neg : c.ink;
  };

  const table = ([from, to, label]: [number, number, string]) => {
    const idx = Array.from({ length: to - from }, (_, k) => from + k);
    const t = roundTotals(setup, round.entries, from, to);
    const putts = idx.reduce((sum, i) => sum + (typeof round.entries[i]?.putts === 'number' ? (round.entries[i].putts as number) : 0), 0);
    const fwHoles = idx.filter((i) => round.holes[i].par >= 4 && round.entries[i]?.fw != null);
    const fwHit = fwHoles.filter((i) => round.entries[i]?.fw === 'hit').length;
    const row = (name: string, cells: (i: number) => React.ReactNode, sum: React.ReactNode, strong = false, tall = false) => (
      <View style={[s.gRow, { borderTopColor: c.edge }, tall && { height: 50 }]} key={name}>
        <Text style={[s.gLabel, { color: strong ? c.ink : c.ink2 }]}>{name}</Text>
        {idx.map((i) => (
          <View key={i} style={s.gCell}>{cells(i)}</View>
        ))}
        <View style={[s.gSum, { backgroundColor: c.fill2 }]}>{typeof sum === 'string' || typeof sum === 'number' ? <Text style={[s.gNum, { color: c.ink, fontWeight: '700' }]}>{sum}</Text> : sum}</View>
      </View>
    );
    const num = (v: React.ReactNode, color = c.ink, bold = false) => <Text style={[s.gNum, { color }, bold && { fontWeight: '700' }]}>{v}</Text>;
    return (
      <View key={label} style={{ minWidth: LABEL + CELL * idx.length + SUM }} accessibilityLabel={`${label === 'Out' ? 'Front nine' : 'Back nine'} scorecard`}>
        <View style={[s.gHead, { backgroundColor: c.fill }]}>
          <Text style={[s.gLabel, { color: c.ink3, fontWeight: '700' }]}>Hole</Text>
          {idx.map((i) => (
            <View key={i} style={s.gCell}>{num(round.holes[i].n, c.ink3, true)}</View>
          ))}
          <View style={s.gSum}>{num(label, c.ink3, true)}</View>
        </View>
        {row('Par', (i) => num(round.holes[i].par), String(idx.reduce((sum, i) => sum + round.holes[i].par, 0)))}
        {row('Stroke index', (i) => num(round.holes[i].si, c.ink3), '')}
        {row(
          'Shots received',
          (i) => (
            results[i].strokesReceived < 0 ? (
              num(`+${-results[i].strokesReceived}`, c.ink2)
            ) : (
              <View style={s.dots} accessibilityLabel={`${results[i].strokesReceived} shots received`}>
                {Array.from({ length: Math.min(3, results[i].strokesReceived) }, (_, k) => (
                  <View key={k} style={[s.dot, { backgroundColor: c.ink2 }]} />
                ))}
              </View>
            )
          ),
          String(t.strokesReceived),
        )}
        {row(
          'Score',
          (i) => {
            const e = round.entries[i];
            const txt = e?.s == null ? '' : e.s === 'P' ? '–' : String(e.s);
            return (
              <View style={[s.shape, shape(i)]} accessibilityLabel={e?.s === 'P' ? 'Picked up' : txt ? `Score ${txt}` : 'Not played'}>
                <Text style={[s.gNum, { color: scoreColor(i), fontWeight: '700', fontSize: 15 }]}>{txt}</Text>
              </View>
            );
          },
          t.gross == null ? '–' : String(t.gross),
          true,
          true,
        )}
        {stable
          ? row('Points', (i) => num(results[i].played ? results[i].points : '', results[i].points === 0 ? c.neg : results[i].points >= 3 ? c.accentText : c.ink, true), String(t.points), true)
          : row('Net', (i) => num(results[i].net ?? (results[i].pickup ? '–' : '')), t.net == null ? '–' : String(t.net), true)}
        {round.trackStats ? row('Putts', (i) => num(round.entries[i]?.putts ?? ''), String(putts)) : null}
        {round.trackStats
          ? row(
              'Fairway',
              (i) => {
                const fw = round.entries[i]?.fw;
                if (!fw) return null;
                const mark = fw === 'hit' ? '✓' : fw === 'left' ? '←' : '→';
                return (
                  <Text style={[s.gNum, { color: fw === 'hit' ? c.accentText : c.amber, fontWeight: '700' }]} accessibilityLabel={fw === 'hit' ? 'Fairway hit' : `Missed ${fw}`}>
                    {mark}
                  </Text>
                );
              },
              fwHoles.length ? `${fwHit}/${fwHoles.length}` : '',
            )
          : null}
      </View>
    );
  };

  return (
    <View style={{ gap: 16 }}>
      {nines.map((n) => (
        <ScrollView key={n[2]} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1 }}>{table(n)}</View>
        </ScrollView>
      ))}
      <View style={s.key}>
        {[
          { label: 'Birdie or better', st: { borderRadius: 99, borderWidth: 1.5, borderColor: c.accent } },
          { label: 'Bogey', st: { borderRadius: 6, borderWidth: 1.5, borderColor: c.ink3 } },
          { label: 'Double bogey or worse', st: { borderRadius: 6, borderWidth: 3, borderColor: c.neg } },
        ].map((k) => (
          <View key={k.label} style={s.keyItem}>
            <View style={[s.keyShape, k.st]} />
            <Text style={[s.rowSub, { color: c.ink2 }]}>{k.label}</Text>
          </View>
        ))}
        <Text style={[s.rowSub, { color: c.ink2 }]}>– Picked up (counts as net double bogey)</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  mixBar: { flexDirection: 'row', height: 14, borderRadius: adminRadius.pill, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 150, flexGrow: 1, flexBasis: '40%' },
  swatch: { width: 10, height: 10, borderRadius: 99 },
  legendName: { ...adminFont.body, fontSize: 13, flex: 1 },
  legendVal: { ...adminFont.bodyBold, ...tabularNums, fontSize: 13 },
  toughRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  holeNo: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  holeNoText: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14 },
  rowTitle: { ...adminFont.bodyBold, fontSize: 14 },
  rowSub: { ...adminFont.body, fontSize: 12.5 },
  toughTrack: { width: 64, height: 6, borderRadius: 99, overflow: 'hidden' },
  toughVal: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14, width: 48, textAlign: 'right' },
  parRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  mini: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexGrow: 1, flexBasis: '45%', gap: 2 },
  miniVal: { ...adminFont.bodyBold, ...tabularNums, fontSize: 24, letterSpacing: -0.4 },
  tee: { width: 9, height: 9, borderRadius: 99, borderWidth: StyleSheet.hairlineWidth },
  gHead: { flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: adminRadius.sm },
  gRow: { flexDirection: 'row', alignItems: 'center', height: 38, borderTopWidth: StyleSheet.hairlineWidth },
  gLabel: { ...adminFont.bodySemiBold, fontSize: 12.5, width: LABEL, paddingLeft: 12 },
  gCell: { width: CELL, flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  gSum: { width: SUM, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  gNum: { ...adminFont.body, ...tabularNums, fontSize: 14, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  shape: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  key: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  keyShape: { width: 18, height: 18 },
});
