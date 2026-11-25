import React from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useBento } from '../../context/ThemeContext';
import type { BentoTokens } from '../../theme/bento';
import { holeResult, roundTotals, toParText, type Format, type HoleEntry, type RoundSetup } from '../../golf/scoring';

// The full scorecard for a round, laid out like a paper card (owner decision
// 24 Nov 2026: the mockup's horizontal scorecard wins). Each nine is a grid of
// nine hole columns plus its Out / In column; rows: hole number, length (m),
// Par, SI, Shots (only with handicaps), Score, Putts (only when the round
// tracks them) and Pts (Stableford) or Net (stroke play). An 18-hole round adds
// a Total row; any other hole count is one grid with a Total column. Then the
// key, the round's totals and the WHS note. Boards: DlgScorecard*,
// G-D-Scorecard*, G-D-RoundDetail*. Used in the hole view's Scorecard sheet
// and on Round Detail.

const LABEL_W = 44;
const SUB_W = 38;

const dots = (n: number) => (n > 0 ? '●'.repeat(Math.min(n, 4)) : '');

export function Scorecard({
  setup,
  entries,
  format,
  trackStats,
  current,
  onPickHole,
}: {
  setup: RoundSetup;
  entries: HoleEntry[];
  format: Format;
  trackStats: boolean;
  current?: number;
  onPickHole?: (i: number) => void;
}) {
  const { t } = useBento();
  const stable = format === 'stableford';
  const holes = setup.holes;
  const shots = setup.handicaps != null;
  const isFullEighteen = holes.length === 18;

  const total = roundTotals(setup, entries);
  const thru = total.holesPlayed === holes.length ? '' : ` thru ${total.holesPlayed}`;
  const summary: Array<[string, string]> = [
    ['Stableford', !total.holesPlayed ? '–' : `${total.points} pts${thru}`],
    ['Net', !total.holesPlayed ? '–' : total.net == null ? 'No return' : `${total.net} (${toParText(total.net - total.par)})`],
    ['Gross', !total.holesPlayed ? '–' : total.gross == null ? 'No return' : `${total.gross} (${toParText(total.gross - total.par)})`],
    ['Handicap score', !total.holesPlayed ? '–' : String(total.adjusted)],
  ];

  const grid = (label: string, from: number, to: number) => (
    <Grid key={label} label={label} from={from} to={to} setup={setup} entries={entries} stable={stable} shots={shots} trackStats={trackStats} current={current} onPickHole={onPickHole} t={t} />
  );

  return (
    <View style={{ gap: 12 }}>
      {isFullEighteen ? (
        <>
          {grid('Out', 0, 9)}
          {grid('In', 9, 18)}
          <TotalRow setup={setup} entries={entries} stable={stable} shots={shots} trackStats={trackStats} t={t} />
        </>
      ) : (
        grid('Total', 0, holes.length)
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: t.accent }} />
          <Text style={{ fontSize: 12, color: t.muted }}>Birdie or better</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: t.muted }} />
          <Text style={{ fontSize: 12, color: t.muted }}>Bogey or worse</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12, color: t.accent }}>●</Text>
          <Text style={{ fontSize: 12, color: t.muted }}>Shot received</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderRadius: 18, backgroundColor: t.seg, overflow: 'hidden' }}>
        {summary.map(([k, v], i) => (
          <View
            key={k}
            style={{
              width: '50%',
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderLeftWidth: i % 2 ? 1 : 0,
              borderTopWidth: i > 1 ? 1 : 0,
              borderColor: t.hair,
            }}
          >
            <Text style={{ fontSize: 12, color: t.muted }}>{k}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink, marginTop: 2 }}>{v}</Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 13, lineHeight: 19, color: t.muted }}>
        Handicap score is your adjusted gross: each hole is capped at net double bogey, the way the World Handicap System counts a round. A pick-up counts as net double bogey.
      </Text>
    </View>
  );
}

// One nine (or a whole short round): hole columns plus a subtotal column.
function Grid({
  label,
  from,
  to,
  setup,
  entries,
  stable,
  shots,
  trackStats,
  current,
  onPickHole,
  t,
}: {
  label: string;
  from: number;
  to: number;
  setup: RoundSetup;
  entries: HoleEntry[];
  stable: boolean;
  shots: boolean;
  trackStats: boolean;
  current?: number;
  onPickHole?: (i: number) => void;
  t: BentoTokens;
}) {
  const idx = Array.from({ length: to - from }, (_, k) => from + k);
  const holes = setup.holes;
  const sub = roundTotals(setup, entries, from, to);
  const par = holes.slice(from, to).reduce((a, h) => a + h.par, 0);
  const putts = entries.slice(from, to).reduce((a, e) => a + (e?.putts ?? 0), 0);
  const results = idx.map((i) => holeResult(setup, i, entries[i]));

  const cur = (i: number) => (i === current ? { backgroundColor: t.accentSoft } : null);
  const subCell: ViewStyle = { width: SUB_W, backgroundColor: t.seg };
  const small: TextStyle = { fontSize: 12, color: t.muted, textAlign: 'center' };
  const body: TextStyle = { fontSize: 13, color: t.ink, textAlign: 'center' };
  const bold: TextStyle = { fontWeight: '700' };

  const rowLabel = (text: string) => (
    <View style={{ width: LABEL_W, justifyContent: 'center' }}>
      <Text style={{ fontSize: 13, color: t.muted }}>{text}</Text>
    </View>
  );
  const row = (key: string, children: React.ReactNode) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderTopColor: t.hair }}>
      {children}
    </View>
  );
  const cell = (key: string | number, content: React.ReactNode, padV: number, style?: StyleProp<ViewStyle>) => (
    <View key={key} style={[{ flex: 1, minWidth: 0, paddingVertical: padV, alignItems: 'center', justifyContent: 'center' }, style]}>
      {content}
    </View>
  );

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <View style={{ width: LABEL_W, justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>Hole</Text>
        </View>
        {idx.map((i) => {
          const n = holes[i].n;
          const on = i === current;
          const text = <Text style={{ fontSize: 12, fontWeight: '700', color: t.ink, textAlign: 'center' }}>{n}</Text>;
          return (
            <View key={n} style={[{ flex: 1, minWidth: 0 }, on ? { backgroundColor: t.accentSoft, borderTopLeftRadius: 9, borderTopRightRadius: 9 } : null]}>
              {onPickHole ? (
                <Pressable
                  onPress={() => onPickHole(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to hole ${n}`}
                  accessibilityState={on ? { selected: true } : undefined}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={{ paddingVertical: 6, alignItems: 'center' }}
                >
                  {text}
                </Pressable>
              ) : (
                <View style={{ paddingVertical: 6, alignItems: 'center' }}>{text}</View>
              )}
            </View>
          );
        })}
        <View style={{ width: SUB_W, justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: t.ink, textAlign: 'center' }}>{label}</Text>
        </View>
      </View>

      {row('m', [
        <React.Fragment key="l">{rowLabel('m')}</React.Fragment>,
        ...idx.map((i) => cell(i, <Text style={small}>{holes[i].length}</Text>, 4, cur(i))),
        cell('sub', null, 4, subCell),
      ])}
      {row('par', [
        <React.Fragment key="l">{rowLabel('Par')}</React.Fragment>,
        ...idx.map((i) => cell(i, <Text style={body}>{holes[i].par}</Text>, 5, cur(i))),
        cell('sub', <Text style={[body, bold]}>{par}</Text>, 5, subCell),
      ])}
      {row('si', [
        <React.Fragment key="l">{rowLabel('SI')}</React.Fragment>,
        ...idx.map((i) => cell(i, <Text style={small}>{holes[i].si}</Text>, 4, cur(i))),
        cell('sub', null, 4, subCell),
      ])}
      {shots
        ? row('shots', [
            <React.Fragment key="l">{rowLabel('Shots')}</React.Fragment>,
            ...idx.map((k, j) => {
              const st = results[j].strokesReceived;
              const content =
                st > 0 ? (
                  <Text style={{ fontSize: st > 2 ? 9 : 13, color: t.accent, letterSpacing: -1 }} numberOfLines={1}>
                    {dots(st)}
                  </Text>
                ) : st < 0 ? (
                  <Text style={{ fontSize: 13, fontWeight: '600', color: t.negative }}>{`+${-st}`}</Text>
                ) : null;
              return cell(k, content, 5, cur(k));
            }),
            cell('sub', <Text style={[body, bold]}>{sub.strokesReceived}</Text>, 5, subCell),
          ])
        : null}
      {row('score', [
        <React.Fragment key="l">{rowLabel('Score')}</React.Fragment>,
        ...idx.map((k, j) => {
          const e = entries[k];
          const r = results[j];
          const s = e?.s;
          return cell(
            k,
            <View style={[{ width: 23, height: 23, alignItems: 'center', justifyContent: 'center' }, markStyle(s, holes[k].par, t)]}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: r.played ? t.ink : t.muted }}>{s == null ? '–' : s}</Text>
            </View>,
            5,
            cur(k),
          );
        }),
        cell('sub', <Text style={[body, bold]}>{!sub.holesPlayed ? '–' : sub.gross == null ? 'NR' : sub.gross}</Text>, 5, subCell),
      ])}
      {trackStats
        ? row('putts', [
            <React.Fragment key="l">{rowLabel('Putts')}</React.Fragment>,
            ...idx.map((k, j) => cell(k, <Text style={body}>{results[j].played ? (entries[k]?.putts ?? '–') : ''}</Text>, 5, cur(k))),
            cell('sub', <Text style={[body, bold]}>{putts || '–'}</Text>, 5, subCell),
          ])
        : null}
      {row('last', [
        <React.Fragment key="l">{rowLabel(stable ? 'Pts' : 'Net')}</React.Fragment>,
        ...idx.map((k, j) => {
          const r = results[j];
          const v = !r.played ? '' : stable ? String(r.points) : r.pickup ? '–' : String(r.net);
          return cell(k, <Text style={[body, bold, { color: t.accent }]}>{v}</Text>, 5, cur(k));
        }),
        cell('sub', <Text style={[body, bold, { color: t.accent }]}>{!sub.holesPlayed ? '' : stable ? sub.points : sub.net == null ? 'NR' : sub.net}</Text>, 5, subCell),
      ])}
    </View>
  );
}

// Under the two nines of an 18-hole card: the round's totals in one row.
function TotalRow({
  setup,
  entries,
  stable,
  shots,
  trackStats,
  t,
}: {
  setup: RoundSetup;
  entries: HoleEntry[];
  stable: boolean;
  shots: boolean;
  trackStats: boolean;
  t: BentoTokens;
}) {
  const tt = roundTotals(setup, entries);
  const par = setup.holes.reduce((a, h) => a + h.par, 0);
  const putts = entries.reduce((a, e) => a + (e?.putts ?? 0), 0);
  const cols: Array<[string, string | number]> = [
    ['Par', par],
    ...(shots ? ([['Shots', tt.strokesReceived]] as Array<[string, number]>) : []),
    ['Score', !tt.holesPlayed ? '–' : tt.gross == null ? 'NR' : tt.gross],
    ...(trackStats ? ([['Putts', putts || '–']] as Array<[string, string | number]>) : []),
    [stable ? 'Pts' : 'Net', !tt.holesPlayed ? '' : stable ? tt.points : tt.net == null ? 'NR' : tt.net],
  ];
  return (
    <View style={{ borderRadius: 14, backgroundColor: t.seg, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 60 }} />
        {cols.map(([k]) => (
          <Text key={k} style={{ flex: 1, paddingVertical: 6, fontSize: 12, fontWeight: '600', color: t.muted, textAlign: 'center' }}>
            {k}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: t.hair }}>
        <View style={{ width: 60, justifyContent: 'center', paddingLeft: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: t.ink }}>Total</Text>
        </View>
        {cols.map(([k, v]) => (
          <Text key={k} style={{ flex: 1, paddingVertical: 7, fontSize: 14, fontWeight: '700', color: t.ink, textAlign: 'center' }}>
            {v}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Score marks (boards): eagle or better a double circle, birdie a circle,
// bogey a square, double bogey or worse a thick square.
function markStyle(s: HoleEntry['s'] | undefined, par: number, t: BentoTokens): ViewStyle | null {
  if (s == null || s === 'P') return null;
  const d = s - par;
  if (d <= -2) return { borderRadius: 12, borderWidth: 1.5, borderColor: t.accent, boxShadow: `0 0 0 2px ${t.tile}, 0 0 0 3.5px ${t.accent}` };
  if (d === -1) return { borderRadius: 12, borderWidth: 1.5, borderColor: t.accent };
  if (d === 1) return { borderRadius: 4, borderWidth: 1.5, borderColor: t.muted };
  if (d >= 2) return { borderRadius: 4, borderWidth: 3, borderColor: t.muted };
  return null;
}
