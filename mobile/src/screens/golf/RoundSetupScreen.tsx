import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { api, ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, radius, spacing } from '../../theme';
import type { GolfCourseDto, GolfProfileDto } from '../../golf/dto';
import { layoutHoleIndexes, playOptions, ratingFor, type Gender, type Layout } from '../../golf/courseMap';
import { computeHandicaps, formatIndex, formatWhole, parseIndexText, type Format } from '../../golf/scoring';

type Props = NativeStackScreenProps<RootStackParamList, 'RoundSetup'>;

const num = (x: number) => x.toFixed(2).replace('-', '−');

// Before a round: tees, men's or ladies' ratings, which holes, the member's
// Handicap Index and format. The handicaps worked out here are fixed for the
// round once it starts (the API recomputes them the same way).
export function RoundSetupScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [course, setCourse] = useState<GolfCourseDto | null>(null);
  const [profile, setProfile] = useState<GolfProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>('men');
  const [teeId, setTeeId] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>('full');
  const [indexText, setIndexText] = useState('');
  const [format, setFormat] = useState<Format>('stableford');
  const [allowance, setAllowance] = useState<0.95 | 1>(0.95);
  const [trackStats, setTrackStats] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, p] = await Promise.all([api.golfCourse(route.params.golfCourseId), api.golfProfile()]);
        setCourse(c);
        setProfile(p);
        const opts = playOptions(c.map);
        const g = opts.some((o) => o.gender === p.ratingGender) ? p.ratingGender : opts[0]?.gender ?? 'men';
        setGender(g);
        const forG = opts.filter((o) => o.gender === g);
        // Default to the middle tee, the one most members play.
        setTeeId(forG[Math.floor((forG.length - 1) / 2)]?.teeId ?? null);
        setIndexText(p.handicapIndex == null ? '' : formatIndex(p.handicapIndex));
        setFormat(p.format);
        setAllowance(p.allowance);
        setTrackStats(p.trackStats);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load this course.');
      }
    })();
  }, [route.params.golfCourseId]);

  const options = useMemo(() => (course ? playOptions(course.map) : []), [course]);
  const genders = [...new Set(options.map((o) => o.gender))];
  const teesForGender = options.filter((o) => o.gender === gender);
  const option = teesForGender.find((o) => o.teeId === teeId) ?? null;
  const layouts = option?.layouts ?? ['full'];
  const effectiveLayout: Layout = layouts.includes(layout) ? layout : 'full';

  const index = parseIndexText(indexText);
  const indexInvalid = index === undefined;

  const calc = useMemo(() => {
    if (!course || !option) return null;
    const rating = ratingFor(course.map, option.teeId, gender, effectiveLayout);
    const card = course.map.card[gender];
    if (!rating || !card) return null;
    const idx = layoutHoleIndexes(course.map.holeCount, effectiveLayout);
    const par = idx.reduce((s, i) => s + card.par[i], 0);
    const h = typeof index === 'number' ? computeHandicaps(index, rating, par, idx.length, allowance) : null;
    return { rating, par, holes: idx.length, h };
  }, [course, option, gender, effectiveLayout, index, allowance]);

  // A ref as well as the button's loading state: a quick double tap can fire
  // twice before the button re-renders as disabled.
  const startingRef = useRef(false);

  // The member already has a round going (one at a time): let them pick it
  // up or throw it away rather than leaving them stuck on this screen.
  const offerInProgress = async () => {
    let inProgress: Awaited<ReturnType<typeof api.golfHome>>['inProgress'] = null;
    try {
      inProgress = (await api.golfHome()).inProgress;
    } catch {
      // fall through to the plain message
    }
    if (!inProgress) {
      showAlert('Could not start the round', 'You already have a round in progress. Open the Course tab to finish or discard it.');
      return;
    }
    const round = inProgress;
    showAlert('You have a round in progress', `${round.courseName}, ${round.teeName} tees. Pick it up where you left off, or discard it to start this one.`, [
      { text: 'Resume round', onPress: () => navigation.replace('CourseGuide', { roundId: round.id }) },
      {
        text: 'Discard it',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.golfRoundDelete(round.id);
            start();
          } catch (err) {
            showAlert('Could not discard the round', err instanceof Error ? err.message : undefined);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const start = async () => {
    if (!course || !option || indexInvalid || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      await api.saveGolfProfile({ handicapIndex: index ?? null, trackStats });
      const round = await api.golfRoundStart({ golfCourseId: course.id, teeId: option.teeId, gender, layout: effectiveLayout, format, allowance });
      navigation.replace('CourseGuide', { roundId: round.id });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await offerInProgress();
      else showAlert('Could not start the round', e instanceof Error ? e.message : undefined);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const tee = (id: string) => course?.map.tees.find((t) => t.id === id);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Start a Round" onBack={() => navigation.goBack()} />
      </SafeAreaView>
      {!course && !error ? <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} /> : null}
      {error ? <Text style={[styles.body, { margin: spacing.md }]}>{error}</Text> : null}
      {course ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.courseName}>{course.name}</Text>
            <Text style={styles.muted}>{[course.location, `${course.holeCount} holes`].filter(Boolean).join(' · ')}</Text>
          </View>

          {genders.length > 1 ? (
            <View style={styles.segRow}>
              <Text style={styles.label}>Rating</Text>
              <Seg
                styles={styles}
                value={gender}
                options={genders.map((g) => ({ value: g, label: g === 'men' ? 'Men' : 'Ladies' }))}
                onChange={(g) => {
                  setGender(g);
                  const forG = options.filter((o) => o.gender === g);
                  if (!forG.some((o) => o.teeId === teeId)) setTeeId(forG[0]?.teeId ?? null);
                }}
              />
            </View>
          ) : null}

          <Text style={styles.label}>Tees</Text>
          <View style={styles.teeGrid}>
            {teesForGender.map((o) => {
              const t = tee(o.teeId)!;
              const r = t.ratings[gender]!.full;
              const total = t.lengths.reduce<number>((s, l) => s + (l ?? 0), 0);
              const on = o.teeId === teeId;
              return (
                <TouchableOpacity
                  key={o.teeId}
                  style={[styles.teeOpt, on && styles.teeOptOn]}
                  onPress={() => setTeeId(o.teeId)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[styles.teeDot, { backgroundColor: t.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teeName}>{t.name}</Text>
                    <Text style={styles.teeMeta}>
                      {total.toLocaleString('en-ZA')} m · CR {r.cr.toFixed(1)} · {r.slope}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.segRow}>
            <Text style={styles.label}>Holes</Text>
            {layouts.length > 1 ? (
              <Seg
                styles={styles}
                value={effectiveLayout}
                options={layouts.map((l) => ({ value: l, label: l === 'full' ? `${course.holeCount} holes` : l === 'front9' ? 'Front 9' : 'Back 9' }))}
                onChange={setLayout}
              />
            ) : (
              <Text style={styles.value}>{course.holeCount} holes</Text>
            )}
          </View>
          {course.holeCount === 18 && layouts.length === 1 ? (
            <Text style={styles.hint}>This course’s card has no separate nine-hole ratings yet, so only full rounds can be scored.</Text>
          ) : null}

          <View style={styles.field}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Handicap Index</Text>
              <Text style={styles.hint}>As it shows on GolfRSA. For a plus handicap start with +, like +1.4. Leave it empty to play off scratch.</Text>
            </View>
            <TextInput
              value={indexText}
              onChangeText={setIndexText}
              placeholder="14.2"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, indexInvalid && styles.inputError]}
              accessibilityLabel="Handicap Index"
              maxLength={5}
            />
          </View>
          {indexInvalid ? <Text style={styles.error}>Enter a number from +10.0 to 54.0, like 14.2.</Text> : null}

          <View style={styles.segRow}>
            <Text style={styles.label}>Format</Text>
            <Seg styles={styles} value={format} options={[{ value: 'stableford', label: 'Stableford' }, { value: 'stroke', label: 'Stroke play' }]} onChange={setFormat} />
          </View>
          <View style={styles.segRow}>
            <Text style={styles.label}>Allowance</Text>
            <Seg styles={styles} value={allowance} options={[{ value: 0.95, label: '95%' }, { value: 1, label: '100%' }]} onChange={setAllowance} />
          </View>
          <Text style={styles.hint}>95% is the World Handicap System default for individual Stableford and stroke play. A committee may use 100% for fields under 30.</Text>

          <View style={styles.segRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Putts and fairways</Text>
              <Text style={styles.hint}>Add putts and fairway hits on each hole for putting, fairway and greens in regulation stats in My Golf.</Text>
            </View>
            <Switch value={trackStats} onValueChange={setTrackStats} trackColor={{ true: colors.clubGreen, false: colors.border }} thumbColor={colors.white} accessibilityLabel="Enter putts and fairways" />
          </View>

          {calc ? (
            <View style={styles.calc}>
              <CalcRow styles={styles} label="Rating" value={`${tee(option!.teeId)?.name} · ${gender === 'men' ? 'Men' : 'Ladies'} · CR ${calc.rating.cr.toFixed(1)} · Slope ${calc.rating.slope} · Par ${calc.par}`} />
              {calc.h ? (
                <>
                  <CalcRow styles={styles} label={`Course handicap (${calc.holes} holes)`} value={formatWhole(calc.h.course)} />
                  <CalcRow styles={styles} label={`Playing handicap (${Math.round(allowance * 100)}%)`} value={formatWhole(calc.h.playing)} />
                  <Text style={styles.calcNote}>
                    {calc.holes === 18 ? formatIndex(index as number) : `${formatIndex(index as number)} ÷ 2 = ${formatIndex(calc.h.idx)},`} × {calc.rating.slope} ÷ 113 + ({calc.rating.cr.toFixed(1)} − {calc.par}) ={' '}
                    {num(calc.h.raw)} → {formatWhole(calc.h.course)}. Playing: {num(calc.h.raw)} × {Math.round(allowance * 100)}% = {num(calc.h.raw * allowance)} →{' '}
                    {formatWhole(calc.h.playing)}.
                  </Text>
                </>
              ) : (
                <Text style={styles.calcNote}>Without a Handicap Index you get no shots, and points are scored against par.</Text>
              )}
            </View>
          ) : null}

          <PillButton label="Start round" icon="flag-outline" onPress={start} loading={starting} disabled={!option || indexInvalid || starting} fullWidth />
          <Text style={styles.hint}>Flagrr never works out your handicap itself; it uses the index you enter here.</Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

function Seg<T extends string | number>({
  styles,
  value,
  options,
  onChange,
}: {
  styles: ReturnType<typeof createStyles>;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg} accessibilityRole="radiogroup">
      {options.map((o) => (
        <TouchableOpacity
          key={String(o.value)}
          onPress={() => onChange(o.value)}
          style={[styles.segBtn, o.value === value && styles.segBtnOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: o.value === value }}
        >
          <Text style={[styles.segText, o.value === value && styles.segTextOn]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CalcRow({ styles, label, value }: { styles: ReturnType<typeof createStyles>; label: string; value: string }) {
  return (
    <View style={styles.calcRow}>
      <Text style={styles.calcLabel}>{label}</Text>
      <Text style={styles.calcValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerSafeArea: { backgroundColor: colors.clubGreen },
    content: { padding: spacing.md + 2, gap: spacing.md - 2, paddingBottom: spacing.xxl, maxWidth: 600, width: '100%', alignSelf: 'center' },
    courseName: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.textPrimary },
    body: { fontFamily: fontFamily.body, fontSize: 13.5, color: colors.textSecondary },
    muted: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textMuted },
    label: { fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.textPrimary },
    value: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    hint: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },
    error: { fontFamily: fontFamily.body, fontSize: 12, color: colors.warning, marginTop: -6 },
    segRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    seg: { flexDirection: 'row', backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 3 },
    segBtn: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6 },
    segBtnOn: { backgroundColor: colors.darkGreen },
    segText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.textSecondary },
    segTextOn: { color: colors.lime },
    teeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -4 },
    teeOpt: { flexGrow: 1, flexBasis: 150, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg },
    teeOptOn: { borderColor: colors.clubGreen, backgroundColor: colors.mintBg },
    teeDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
    teeName: { fontFamily: fontFamily.bodySemiBold, fontSize: 13.5, color: colors.textPrimary },
    teeMeta: { fontFamily: fontFamily.body, fontSize: 10.5, color: colors.textSecondary },
    field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    input: { width: 96, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.textPrimary, fontFamily: fontFamily.bodySemiBold, fontSize: 18, textAlign: 'right' },
    inputError: { borderColor: colors.warning },
    calc: { backgroundColor: colors.inputBg, borderRadius: radius.md, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10 },
    calcRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
    calcLabel: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary },
    calcValue: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
    calcNote: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, marginTop: 8, lineHeight: 16 },
  });
}
