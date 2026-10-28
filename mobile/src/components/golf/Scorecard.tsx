import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily } from '../../theme';
import { holeResult, roundTotals, toParText, type Format, type HoleEntry, type RoundSetup } from '../../golf/scoring';

// The full scorecard for a round: every hole with par, stroke index, shots
// received, score and points (or net), with Out / In / Total rows and the
// round's totals underneath. Used in the round sheet and on Round Detail.

const dots = (n: number) => (n > 0 ? '●'.repeat(Math.min(n, 4)) : n < 0 ? `+${-n}` : '');

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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const stable = format === 'stableford';
  const holes = setup.holes;

  const markStyle = (e: HoleEntry | undefined, par: number) => {
    if (!e || e.s == null || e.s === 'P') return null;
    const d = e.s - par;
    if (d <= -2) return styles.eagle;
    if (d === -1) return styles.birdie;
    if (d === 1) return styles.bogey;
    if (d >= 2) return styles.double;
    return null;
  };

  const row = (i: number) => {
    const h = holes[i];
    const e = entries[i];
    const r = holeResult(setup, i, e);
    const last = !r.played ? '' : stable ? String(r.points) : r.pickup ? '–' : String(r.net);
    const Cell = onPickHole ? TouchableOpacity : View;
    return (
      <View key={h.n} style={[styles.tr, i === current && styles.trCurrent]}>
        <Cell style={[styles.td, styles.tdHole]} {...(onPickHole ? { onPress: () => onPickHole(i), accessibilityLabel: `Go to hole ${h.n}` } : {})}>
          <Text style={styles.holeNo}>{h.n}</Text>
          <Text style={styles.holeLen}>{h.length} m</Text>
        </Cell>
        <Text style={styles.td}>{h.par}</Text>
        <Text style={styles.td}>{h.si}</Text>
        <Text style={[styles.td, styles.dots]}>{dots(r.strokesReceived)}</Text>
        <View style={styles.td}>
          <View style={[styles.mark, markStyle(e, h.par)]}>
            <Text style={[styles.markText, !r.played && styles.muted]}>{e?.s == null ? '–' : e.s}</Text>
          </View>
        </View>
        {trackStats ? <Text style={[styles.td, styles.muted]}>{e?.putts ?? '–'}</Text> : null}
        <Text style={styles.td}>{last}</Text>
      </View>
    );
  };

  const sub = (label: string, from: number, to: number) => {
    const t = roundTotals(setup, entries, from, to);
    const par = holes.slice(from, to).reduce((a, h) => a + h.par, 0);
    const putts = entries.slice(from, to).reduce((a, e) => a + (e?.putts ?? 0), 0);
    const last = !t.holesPlayed ? '' : stable ? String(t.points) : t.net == null ? 'NR' : String(t.net);
    return (
      <View key={label} style={[styles.tr, styles.trSub]}>
        <Text style={[styles.td, styles.tdHole, styles.bold]}>{label}</Text>
        <Text style={[styles.td, styles.bold]}>{par}</Text>
        <Text style={styles.td} />
        <Text style={[styles.td, styles.bold]}>{setup.handicaps ? t.strokesReceived : ''}</Text>
        <Text style={[styles.td, styles.bold]}>{!t.holesPlayed ? '–' : t.gross == null ? 'NR' : t.gross}</Text>
        {trackStats ? <Text style={[styles.td, styles.bold]}>{putts || '–'}</Text> : null}
        <Text style={[styles.td, styles.bold]}>{last}</Text>
      </View>
    );
  };

  const t = roundTotals(setup, entries);
  const thru = t.holesPlayed === holes.length ? '' : ` thru ${t.holesPlayed}`;
  const summary: Array<[string, string]> = [
    ['Stableford', !t.holesPlayed ? '–' : `${t.points} pts${thru}`],
    ['Net', !t.holesPlayed ? '–' : t.net == null ? 'No return' : `${t.net} (${toParText(t.net - t.par)})`],
    ['Gross', !t.holesPlayed ? '–' : t.gross == null ? 'No return' : `${t.gross} (${toParText(t.gross - t.par)})`],
    ['Handicap score', !t.holesPlayed ? '–' : String(t.adjusted)],
  ];

  const isFullEighteen = holes.length === 18;
  return (
    <View style={{ gap: 10 }}>
      <View>
        <View style={[styles.tr, styles.thead]}>
          {['Hole', 'Par', 'SI', 'Shots', 'Score', ...(trackStats ? ['Putts'] : []), stable ? 'Pts' : 'Net'].map((h, i) => (
            <Text key={h} style={[styles.th, i === 0 && styles.tdHole]}>
              {h}
            </Text>
          ))}
        </View>
        {isFullEighteen ? (
          <>
            {holes.slice(0, 9).map((_, i) => row(i))}
            {sub('Out', 0, 9)}
            {holes.slice(9).map((_, i) => row(i + 9))}
            {sub('In', 9, 18)}
            {sub('Total', 0, 18)}
          </>
        ) : (
          <>
            {holes.map((_, i) => row(i))}
            {sub('Total', 0, holes.length)}
          </>
        )}
      </View>
      <View style={styles.key}>
        <View style={styles.keyItem}>
          <View style={[styles.keySwatch, styles.birdie]} />
          <Text style={styles.keyText}>Birdie or better</Text>
        </View>
        <View style={styles.keyItem}>
          <View style={[styles.keySwatch, styles.bogey]} />
          <Text style={styles.keyText}>Bogey or worse</Text>
        </View>
        <Text style={[styles.keyText, styles.dots]}>●</Text>
        <Text style={styles.keyText}>Shot received</Text>
      </View>
      <View style={styles.sum}>
        {summary.map(([k, v]) => (
          <View key={k} style={styles.sumCell}>
            <Text style={styles.sumLabel}>{k}</Text>
            <Text style={styles.sumValue}>{v}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        Handicap score is your adjusted gross: each hole is capped at net double bogey, the way the World Handicap System counts a round. A
        pick-up counts as net double bogey.
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    tr: { flexDirection: 'row', alignItems: 'center', minHeight: 38, borderTopWidth: 1, borderTopColor: colors.border },
    thead: { borderTopWidth: 0, minHeight: 26 },
    trCurrent: { backgroundColor: colors.inputBg },
    trSub: { backgroundColor: colors.inputBg },
    th: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bodySemiBold, fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.textMuted },
    td: { flex: 1, textAlign: 'center', alignItems: 'center', justifyContent: 'center', fontFamily: fontFamily.body, fontSize: 13.5, color: colors.textPrimary },
    tdHole: { flex: 1.5, textAlign: 'left', alignItems: 'flex-start', flexDirection: 'row', gap: 6, paddingLeft: 4 },
    holeNo: { fontFamily: fontFamily.bodySemiBold, fontSize: 13.5, color: colors.textPrimary },
    holeLen: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textMuted, alignSelf: 'center' },
    bold: { fontFamily: fontFamily.bodySemiBold },
    muted: { color: colors.textMuted },
    dots: { color: colors.clubGreen, fontSize: 8, letterSpacing: 1 },
    mark: { minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    markText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13.5, color: colors.textPrimary },
    birdie: { borderWidth: 1.5, borderColor: colors.clubGreen, borderRadius: 14 },
    eagle: { borderWidth: 3, borderColor: colors.clubGreen, borderRadius: 14 },
    bogey: { borderWidth: 1.5, borderColor: colors.textSecondary, borderRadius: 3 },
    double: { borderWidth: 3, borderColor: colors.textSecondary, borderRadius: 3 },
    key: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    keyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    keySwatch: { width: 12, height: 12 },
    keyText: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted },
    sum: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 12, overflow: 'hidden', gap: 1, backgroundColor: colors.border },
    sumCell: { width: '49.8%', flexGrow: 1, backgroundColor: colors.inputBg, paddingVertical: 8, paddingHorizontal: 12 },
    sumLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.textMuted },
    sumValue: { fontFamily: fontFamily.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    note: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },
  });
}
