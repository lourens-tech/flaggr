import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { BentoButton, BentoField, BentoScreen, BentoTile, BentoToggle, H1, SegmentedControl } from '../../components/bento';
import { GolfLoading } from '../../components/golf/GolfSheet';
import { PressableScale } from '../../components/motion';
import { api, ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { useBento } from '../../context/ThemeContext';
import type { BentoTokens } from '../../theme/bento';
import type { GolfCourseDto, GolfProfileDto } from '../../golf/dto';
import { layoutHoleIndexes, playOptions, ratingFor, type Gender, type Layout } from '../../golf/courseMap';
import { computeHandicaps, formatIndex, formatWhole, parseIndexText, type Format } from '../../golf/scoring';

type Props = NativeStackScreenProps<RootStackParamList, 'RoundSetup'>;

const num = (x: number) => x.toFixed(2).replace('-', '−');

// Before a round: tees, men's or ladies' ratings, which holes, the member's
// Handicap Index and format (boards: AppRoundSetup, G-D-Setup*). The handicaps worked out here are fixed for the
// round once it starts (the API recomputes them the same way).
export function RoundSetupScreen({ navigation, route }: Props) {
  const { t: bt } = useBento();
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
        setError(friendlyError(e, 'Could not load this course.'));
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
            showAlert('Could not discard the round', friendlyError(err));
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
      else showAlert('Could not start the round', friendlyError(e));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const tee = (id: string) => course?.map.tees.find((t) => t.id === id);
  const labelStyle: TextStyle = { fontSize: 14, fontWeight: '600', color: bt.ink, marginBottom: 8 };
  const hint: TextStyle = { fontSize: 13, lineHeight: 19, color: bt.muted };

  return (
    <BentoScreen title="Start a Round" onBack={() => navigation.goBack()}>
      {!course && !error ? <GolfLoading /> : null}
      {error ? <Text style={{ fontSize: 15, lineHeight: 22, color: bt.ink, textAlign: 'center', paddingHorizontal: 12, marginTop: 42 }}>{error}</Text> : null}
      {course ? (
        <>
          <View style={{ marginTop: 16, gap: 12 }}>
            <H1 style={{ fontSize: 28, lineHeight: Math.round(28 * 1.04), letterSpacing: -0.7 }}>{course.name}</H1>
            <Text style={{ fontSize: 14, color: bt.muted }}>{[course.location, `${course.holeCount} holes`].filter(Boolean).join(' · ')}</Text>
          </View>

          <BentoTile padding={18}>
            {genders.length > 1 ? (
              <>
                <Text style={labelStyle}>Rating</Text>
                <SegmentedControl
                  fill
                  value={gender}
                  options={genders.map((g) => ({ value: g, label: g === 'men' ? 'Men' : 'Ladies' }))}
                  onChange={(g) => {
                    setGender(g);
                    const forG = options.filter((o) => o.gender === g);
                    if (!forG.some((o) => o.teeId === teeId)) setTeeId(forG[0]?.teeId ?? null);
                  }}
                />
              </>
            ) : null}

            <Text style={[labelStyle, genders.length > 1 ? { marginTop: 16 } : null]}>Tees</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {teesForGender.map((o) => {
                const t = tee(o.teeId)!;
                const r = t.ratings[gender]!.full;
                const total = t.lengths.reduce<number>((s, l) => s + (l ?? 0), 0);
                const on = o.teeId === teeId;
                const len = `${total.toLocaleString('en-ZA')} m`;
                const meta = `CR ${r.cr.toFixed(1)} · ${r.slope}`;
                return (
                  <PressableScale
                    key={o.teeId}
                    onPress={() => setTeeId(o.teeId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name} ${len} · ${meta}`}
                    accessibilityState={{ selected: on }}
                    style={{
                      flexGrow: 1,
                      flexBasis: '30%',
                      minWidth: 0,
                      borderRadius: 16,
                      paddingTop: 10,
                      paddingHorizontal: 10,
                      paddingBottom: 11,
                      backgroundColor: on ? bt.accentSoft : bt.tile,
                      boxShadow: on ? `0 0 0 2px ${bt.accent}` : `0 0 0 1px ${bt.hair}`,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: t.color, boxShadow: `0 0 0 1px ${bt.hair}` }} />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: bt.ink, flexShrink: 1 }} numberOfLines={1}>
                        {t.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: bt.muted, marginTop: 5 }}>{len}</Text>
                    <Text style={{ fontSize: 12, color: bt.muted }}>{meta}</Text>
                  </PressableScale>
                );
              })}
            </View>

            <Text style={[labelStyle, { marginTop: 16 }]}>Holes</Text>
            {layouts.length > 1 ? (
              <SegmentedControl
                fill
                value={effectiveLayout}
                options={layouts.map((l) => ({ value: l, label: l === 'full' ? `${course.holeCount} holes` : l === 'front9' ? 'Front 9' : 'Back 9' }))}
                onChange={setLayout}
              />
            ) : (
              <Text style={{ fontSize: 15, color: bt.ink }}>{course.holeCount} holes</Text>
            )}
            {course.holeCount === 18 && layouts.length === 1 ? (
              <Text style={[hint, { marginTop: 6 }]}>This course’s card has no separate nine-hole ratings yet, so only full rounds can be scored.</Text>
            ) : null}
          </BentoTile>

          <BentoTile padding={18}>
            <BentoField
              label="Handicap Index"
              value={indexText}
              onChangeText={setIndexText}
              placeholder="14.2"
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Handicap Index"
              maxLength={5}
              error={indexInvalid ? 'Enter a number from +10.0 to 54.0, like 14.2.' : undefined}
            />
            <Text style={[hint, { marginTop: 8 }]}>As it shows on GolfRSA. For a plus handicap start with +, like +1.4. Leave it empty to play off scratch.</Text>
          </BentoTile>

          <BentoTile padding={18}>
            <Text style={labelStyle}>Format</Text>
            <SegmentedControl
              fill
              value={format}
              options={[
                { value: 'stableford', label: 'Stableford' },
                { value: 'stroke', label: 'Stroke play' },
              ]}
              onChange={setFormat}
            />
            <Text style={[labelStyle, { marginTop: 16 }]}>Allowance</Text>
            <SegmentedControl
              fill
              value={allowance === 1 ? '1' : '0.95'}
              options={[
                { value: '0.95', label: '95%' },
                { value: '1', label: '100%' },
              ]}
              onChange={(v) => setAllowance(v === '1' ? 1 : 0.95)}
            />
            <Text style={[hint, { marginTop: 8 }]}>95% is the World Handicap System default for individual Stableford and stroke play. A committee may use 100% for fields under 30.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: bt.ink }}>Putts and fairways</Text>
                <Text style={[hint, { marginTop: 2 }]}>Add putts and fairway hits on each hole for putting, fairway and greens in regulation stats in My Golf.</Text>
              </View>
              <BentoToggle value={trackStats} onValueChange={setTrackStats} accessibilityLabel="Enter putts and fairways" />
            </View>
          </BentoTile>

          {calc ? (
            <BentoTile padding={18}>
              <CalcRow t={bt} label="Rating" value={`${tee(option!.teeId)?.name} · ${gender === 'men' ? 'Men' : 'Ladies'} · CR ${calc.rating.cr.toFixed(1)} · Slope ${calc.rating.slope} · Par ${calc.par}`} />
              {calc.h ? (
                <>
                  <CalcRow t={bt} label={`Course handicap (${calc.holes} holes)`} value={formatWhole(calc.h.course)} />
                  <CalcRow t={bt} label={`Playing handicap (${Math.round(allowance * 100)}%)`} value={formatWhole(calc.h.playing)} />
                  <Text style={[hint, { marginTop: 10 }]}>
                    {calc.holes === 18 ? formatIndex(index as number) : `${formatIndex(index as number)} ÷ 2 = ${formatIndex(calc.h.idx)},`} × {calc.rating.slope} ÷ 113 + ({calc.rating.cr.toFixed(1)} − {calc.par}) ={' '}
                    {num(calc.h.raw)} → {formatWhole(calc.h.course)}. Playing: {num(calc.h.raw)} × {Math.round(allowance * 100)}% = {num(calc.h.raw * allowance)} →{' '}
                    {formatWhole(calc.h.playing)}.
                  </Text>
                </>
              ) : (
                <Text style={[hint, { marginTop: 10 }]}>Without a Handicap Index you get no shots, and points are scored against par.</Text>
              )}
            </BentoTile>
          ) : null}

          <Text style={[hint, { textAlign: 'center', paddingVertical: 2, paddingHorizontal: 8 }]}>Flagrr never works out your handicap itself; it uses the index you enter here.</Text>
          <BentoButton label="Start round" nub onPress={start} loading={starting} disabled={!option || indexInvalid || starting} />
        </>
      ) : null}
    </BentoScreen>
  );
}

function CalcRow({ t, label, value }: { t: BentoTokens; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.hair }}>
      <Text style={{ fontSize: 14, color: t.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
