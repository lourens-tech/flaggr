import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { api, ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { useTheme, useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily } from '../../theme';
import { GolfHoleMap, DARK_MAP, LIGHT_MAP, type GolfHoleMapHandle } from '../../components/golf/GolfHoleMap';
import { GolfSheet, sheetText } from '../../components/golf/GolfSheet';
import { Scorecard } from '../../components/golf/Scorecard';
import { PillButton } from '../../components/common/PillButton';
import type { GolfCourseDto, RoundDto } from '../../golf/dto';
import type { Pt } from '../../golf/courseMap';
import {
  buildHoleView,
  clubFor,
  DEFAULT_BAG,
  describeCustom,
  dist,
  greenDistances,
  onGreen,
  sortedBag,
  spread,
  suggest,
  type Club,
  type HoleView,
} from '../../golf/holeGeometry';
import {
  formatIndex,
  formatWhole,
  holeResult,
  MAX_PUTTS,
  MAX_STROKES,
  resultName,
  roundTotals,
  toParText,
  type HoleEntry,
  type RoundSetup,
} from '../../golf/scoring';

type Props = NativeStackScreenProps<RootStackParamList, 'CourseGuide'>;

const SAVE_DELAY_MS = 700;
const RETRY_MS = 15_000;
const localKey = (id: string) => `flagrr_round_entries_${id}`;
const m = Math.round;
const ptsText = (p: number) => `${p} pt${p === 1 ? '' : 's'}`;
const dots = (n: number) => (n > 0 ? '●'.repeat(Math.min(n, 4)) : '');
const shotsText = (st: number) => (st > 0 ? `${st} shot${st > 1 ? 's' : ''}` : st < 0 ? `gives back ${-st}` : 'no shots');

// The in-round screen: full screen (no tab bar), the hole map edge to edge
// with floating cards over it, and the score bar underneath. Scores save to
// the server as they're entered, with a local copy in case the signal drops.
export function CourseGuideScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const isDark = useTheme().scheme === 'dark';
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const roundId = route.params.roundId;

  const [round, setRound] = useState<RoundDto | null>(null);
  const [course, setCourse] = useState<GolfCourseDto | null>(null);
  const [mapMissing, setMapMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [entries, setEntries] = useState<HoleEntry[]>([]);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [holeIdx, setHoleIdx] = useState(0);
  const [ball, setBall] = useState<Pt>([0, 0]);
  const [target, setTarget] = useState<Pt | null>(null);
  const [custom, setCustom] = useState(false);
  const [draggedBall, setDraggedBall] = useState(false);
  const [rings, setRings] = useState(true);
  const [hazards, setHazards] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sheet, setSheet] = useState<'card' | 'bag' | 'round' | null>(null);
  const [bag, setBag] = useState<Club[]>(DEFAULT_BAG);
  const [bagDirty, setBagDirty] = useState(false);
  // The tallest the shot card has been, so the map keeps clear of it without
  // re-framing every time its text changes length.
  const [shotCardH, setShotCardH] = useState(180);
  const [finishing, setFinishing] = useState(false);
  const mapRef = useRef<GolfHoleMapHandle>(null);
  const pickerRef = useRef<ScrollView>(null);

  // --- load ---
  useEffect(() => {
    (async () => {
      try {
        const [r, p] = await Promise.all([api.golfRound(roundId), api.golfProfile()]);
        let start = r.entries;
        try {
          const saved = await AsyncStorage.getItem(localKey(roundId));
          if (saved) {
            const parsed = JSON.parse(saved) as HoleEntry[];
            if (Array.isArray(parsed) && parsed.length === r.holes.length) start = parsed;
          }
        } catch {
          // no local copy
        }
        setRound(r);
        setEntries(start);
        if (p.bag?.length) setBag(p.bag);
        const firstOpen = start.findIndex((e) => e.s == null);
        setHoleIdx(firstOpen === -1 ? 0 : firstOpen);
        if (start !== r.entries) queueSave(start, r);
        if (r.golfCourseId) {
          try {
            setCourse(await api.golfCourse(r.golfCourseId));
          } catch {
            setMapMissing(true);
          }
        } else setMapMissing(true);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not load the round.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  const setup: RoundSetup | null = useMemo(
    () =>
      round
        ? {
            holes: round.holes,
            handicaps: round.courseHandicap == null || round.playingHandicap == null ? null : { course: round.courseHandicap, playing: round.playingHandicap },
          }
        : null,
    [round],
  );

  // Hole geometry from the live map; par / stroke index / length always from
  // the round's own copy of the card.
  const views: HoleView[] = useMemo(() => {
    if (!round || !course) return [];
    return round.holes.map((h) => ({ ...buildHoleView(course.map, h.n - 1, round.teeId, round.ratingGender), par: h.par, si: h.si, length: h.length }));
  }, [round, course]);
  const view = views[holeIdx];

  // --- saving ---
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<HoleEntry[]>([]);
  const roundRef = useRef<RoundDto | null>(null);
  roundRef.current = round;

  const flush = useCallback(async () => {
    const r = roundRef.current;
    if (!r) return;
    const snapshot = latest.current;
    setSaveState('saving');
    try {
      const saved = await api.golfRoundSave(r.id, snapshot);
      if (latest.current === snapshot) {
        await AsyncStorage.removeItem(localKey(r.id)).catch(() => {});
        setSaveState('saved');
      }
      // Only when it changes: a new round object rebuilds every hole view.
      setRound((cur) => (cur && cur.status !== saved.status ? { ...cur, status: saved.status, completedAt: saved.completedAt } : cur));
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setSaveState('saved');
        showAlert('Could not save that score', e.message);
        return;
      }
      setSaveState('offline');
      saveTimer.current = setTimeout(flush, RETRY_MS);
    }
  }, []);

  function queueSave(next: HoleEntry[], r: RoundDto | null = roundRef.current) {
    latest.current = next;
    if (r) AsyncStorage.setItem(localKey(r.id), JSON.stringify(next)).catch(() => {});
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  useEffect(
    () => () => {
      // Leaving the screen: send anything still waiting.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        flush();
      }
    },
    [flush],
  );

  const entriesRef = useRef<HoleEntry[]>([]);
  entriesRef.current = entries;
  const updateEntry = (i: number, patch: Partial<HoleEntry>) => {
    const next = entriesRef.current.slice();
    const e = { ...next[i], ...patch };
    // Putts and fairway only make sense with strokes.
    if (typeof e.s !== 'number') {
      e.putts = null;
      e.fw = null;
    } else if (e.putts != null && e.putts >= e.s) e.putts = e.s - 1;
    next[i] = e;
    entriesRef.current = next;
    setEntries(next);
    queueSave(next);
  };

  // --- hole and shot ---
  const goToHole = (i: number) => {
    setHoleIdx(i);
    setCustom(false);
    setTarget(null);
    setLayersOpen(false);
  };
  useEffect(() => {
    if (view) setBall([view.tee[0], view.tee[1]]);
  }, [view]);

  const suggestion = useMemo(() => (view ? suggest(view, ball, bag) : null), [view, ball, bag]);
  const shownTarget: Pt = custom && target ? target : suggestion?.target ?? ball;

  // --- score bar ---
  const holes = round?.holes ?? [];
  const h = holes[holeIdx];
  const e = entries[holeIdx];
  const res = setup && h ? holeResult(setup, holeIdx, e) : null;
  const stable = round?.format === 'stableford';
  const totals = setup ? roundTotals(setup, entries) : null;
  const allIn = totals != null && totals.holesPlayed === holes.length;

  const setScore = (v: number | 'P' | null) => updateEntry(holeIdx, { s: typeof v === 'number' ? Math.max(1, Math.min(MAX_STROKES, v)) : v });
  const step = (delta: number) => {
    if (!h || !res) return;
    const s = e?.s;
    const base = s === 'P' ? h.par + res.strokesReceived + 2 : s;
    setScore(base == null ? h.par + delta : base + delta);
  };
  const tapScore = () => {
    if (!h) return;
    if (e?.s == null) setScore(h.par);
    else if (e.s === 'P') setScore(null);
  };

  let sbSmall = '';
  let sbResult = '';
  let sbTone: 'good' | 'over' | 'par' = 'par';
  let offerPickup = false;
  if (h && res) {
    if (e?.s == null) {
      sbSmall = setup?.handicaps ? `Hole ${h.n} · ${shotsText(res.strokesReceived)}` : `Hole ${h.n} score`;
      sbResult = `Tap ${h.par} for par`;
    } else if (e.s === 'P') {
      sbSmall = 'Picked up';
      sbResult = stable ? '0 pts' : 'No return';
      sbTone = 'over';
    } else {
      const netName = res.strokesReceived && res.net != null ? ` · net ${res.net === h.par ? 'par' : resultName(res.net, h.par).toLowerCase()}` : '';
      // Once a hole is worth 0 points the player may pick up (Rule 21.1b).
      offerPickup = stable && res.points === 0;
      sbSmall = resultName(e.s, h.par) + netName;
      sbResult = stable ? ptsText(res.points) : `Net ${res.net}`;
      const netToPar = (res.net ?? 0) - h.par;
      sbTone = (stable ? res.points >= 3 : netToPar < 0) ? 'good' : (stable ? res.points === 0 : netToPar > 0) ? 'over' : 'par';
    }
  }
  const totalText = !totals?.holesPlayed ? '–' : stable ? ptsText(totals.points) : totals.net == null ? 'NR' : toParText(totals.net - totals.par);

  // --- shot card ---
  let shot: { chip: string; risky: boolean; club: string; d: number; why: string } | null = null;
  if (view && suggestion) {
    if (custom && target) {
      const c = describeCustom(view, ball, target, bag);
      shot = { chip: c.risky ? 'Your target · risky' : 'Your target', risky: c.risky, club: c.club, d: c.d, why: c.why };
    } else shot = { chip: 'Suggested shot', risky: false, club: suggestion.club, d: suggestion.d, why: suggestion.why };
  }
  const atTee = view ? dist(ball, view.tee) < 1 : true;
  const putting = view ? onGreen(view, ball) : false;
  const left = view ? dist(shownTarget, view.pin) : 0;
  const finishesOnGreen = view ? onGreen(view, shownTarget) || left < 3 : false;
  const b = sortedBag(bag);
  const nextClub = putting ? '–' : finishesOnGreen ? 'Putter' : left <= 45 ? 'Chip' : left > (b[0]?.carry ?? 0) ? (b[1] ?? b[0])?.name ?? '–' : clubFor(bag, left).name;
  const gd = view ? greenDistances(view, ball) : null;

  // --- finish ---
  const finish = async () => {
    if (!round || !allIn) return;
    setFinishing(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const saved = await api.golfRoundFinish(round.id, entries);
      await AsyncStorage.removeItem(localKey(round.id)).catch(() => {});
      latest.current = entries;
      setSheet(null);
      setRound(saved);
      const t = roundTotals(setup!, entries);
      showAlert('Round saved', `${round.courseName}: ${t.points} Stableford points${t.gross != null ? `, ${t.gross} gross` : ''}. Your stats are in My Golf.`, [
        { text: 'See My Golf', onPress: () => navigation.navigate('Main', { screen: 'MyGolf' }) },
        { text: 'Close', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      showAlert('Could not finish the round', err instanceof Error ? err.message : undefined);
    } finally {
      setFinishing(false);
    }
  };

  const saveBag = async () => {
    setSheet(null);
    if (!bagDirty) return;
    setBagDirty(false);
    try {
      await api.saveGolfProfile({ bag });
    } catch {
      // The bag still works for this round; it's saved next time.
    }
  };

  if (loadError) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.loadError}>{loadError}</Text>
        <PillButton label="Back" onPress={() => navigation.goBack()} variant="outline" />
      </SafeAreaView>
    );
  }
  if (!round || !setup || (!course && !mapMissing)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.clubGreen} size="large" />
      </View>
    );
  }

  const tee = course?.map.tees.find((t) => t.id === round.teeId);
  const completed = round.status === 'completed';
  const st = res?.strokesReceived ?? 0;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => navigation.goBack()} accessibilityLabel={completed ? 'Back' : 'Back. Your round stays in progress'}>
            <Ionicons name="chevron-back" size={18} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.courseTitle}>
            <Text style={styles.courseName} numberOfLines={1}>
              {round.courseName}
            </Text>
            <Text style={styles.saveState}>
              {saveState === 'offline' ? 'Not saved yet · will retry' : saveState === 'saving' ? 'Saving…' : completed ? 'Finished round · changes save' : 'Saved'}
            </Text>
          </View>
          <TouchableOpacity style={styles.hcpBtn} onPress={() => setSheet('round')} accessibilityLabel="Your round: tees and handicap">
            <View style={[styles.teeDot, { backgroundColor: round.teeColor }]} />
            <Text style={styles.hcpSmall}>HCP</Text>
            <Text style={styles.hcpValue}>{round.handicapIndex == null ? '–' : formatIndex(round.handicapIndex)}</Text>
          </TouchableOpacity>
          {course ? (
            <TouchableOpacity style={styles.bagBtn} onPress={() => setSheet('bag')} accessibilityLabel="My bag">
              <MaterialCommunityIcons name="golf-tee" size={15} color={colors.darkGreen} />
              <Text style={styles.bagText}>Bag</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView ref={pickerRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker}>
          {holes.map((hh, i) => {
            const on = i === holeIdx;
            const scored = entries[i]?.s != null;
            return (
              <TouchableOpacity
                key={hh.n}
                style={[styles.pill, on && styles.pillOn]}
                onPress={() => goToHole(i)}
                accessibilityLabel={`Hole ${hh.n}, par ${hh.par}${scored ? ', scored' : ''}`}
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.pillNo, on && styles.pillTextOn]}>{hh.n}</Text>
                <Text style={[styles.pillPar, on && styles.pillTextOn]}>P{hh.par}</Text>
                {scored ? <View style={[styles.scoredDot, on && { backgroundColor: colors.darkGreen }]} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.map}>
        {view && course ? (
          <GolfHoleMap
            ref={mapRef}
            hole={view}
            tees={course.map.tees}
            palette={isDark ? DARK_MAP : LIGHT_MAP}
            ball={ball}
            target={shownTarget}
            showRings={rings}
            showHazards={hazards}
            draggedBall={draggedBall}
            insets={{ top: 110, bottom: (collapsed ? 70 : shotCardH) + 30, left: 10, right: 60 }}
            onTouchStart={() => setLayersOpen(false)}
            onBallMove={(p) => {
              setBall(p);
              setDraggedBall(true);
            }}
            onTargetMove={(p) => {
              setTarget(p);
              setCustom(true);
            }}
          />
        ) : (
          <View style={[styles.center, { flex: 1, padding: 24 }]}>
            <Text style={styles.loadError}>The map for this course isn’t available any more, but you can still keep score below.</Text>
          </View>
        )}

        {view && course ? (
          <>
            <View style={[styles.card, styles.holeBadge]} pointerEvents="none">
              <View style={styles.holeNo}>
                <Text style={styles.holeNoText}>{view.n}</Text>
              </View>
              <View>
                <Text style={styles.holePar}>
                  Par {view.par}
                  {st > 0 ? <Text style={styles.dots}> {dots(st)}</Text> : null}
                </Text>
                <Text style={styles.holeMeta}>
                  {view.length} m · SI {view.si}
                  {setup.handicaps ? ` · ${shotsText(st)}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.gps} pointerEvents="none">
              <Ionicons name="navigate-outline" size={11} color={colors.white} />
              <Text style={styles.gpsText}>GPS integration coming soon</Text>
            </View>

            <View style={[styles.card, styles.greens]} pointerEvents="none" accessibilityLabel={gd ? `Green: front ${gd[0]}, middle ${gd[1]}, back ${gd[2]} metres` : undefined}>
              <View style={styles.greenRow}>
                <Text style={styles.greenLabel}>Back</Text>
                <Text style={styles.greenVal}>{gd?.[2] ?? '–'}</Text>
              </View>
              <View style={styles.greenMid}>
                <Text style={styles.greenMidVal}>{gd?.[1] ?? '–'}</Text>
                <Text style={styles.greenLabel}>Middle</Text>
              </View>
              <View style={styles.greenRow}>
                <Text style={styles.greenLabel}>Front</Text>
                <Text style={styles.greenVal}>{gd?.[0] ?? '–'}</Text>
              </View>
            </View>

            <View style={styles.controls}>
              <View style={[styles.card, styles.ctlGroup]}>
                <TouchableOpacity style={styles.ctl} onPress={() => mapRef.current?.zoomBy(1.35)} accessibilityLabel="Zoom in">
                  <Ionicons name="add" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ctl, styles.ctlSep]} onPress={() => mapRef.current?.zoomBy(1 / 1.35)} accessibilityLabel="Zoom out">
                  <Ionicons name="remove" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ctl, styles.ctlSep]} onPress={() => mapRef.current?.fit()} accessibilityLabel="Show the whole hole">
                  <Ionicons name="scan-outline" size={17} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.card, styles.ctlGroup]}>
                <TouchableOpacity
                  style={[styles.ctl, layersOpen && { backgroundColor: colors.darkGreen }]}
                  onPress={() => setLayersOpen((o) => !o)}
                  accessibilityLabel="Map layers"
                  accessibilityState={{ expanded: layersOpen }}
                >
                  <Ionicons name="layers-outline" size={18} color={layersOpen ? colors.lime : colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
            {layersOpen ? (
              <View style={[styles.card, styles.layers]}>
                <View style={styles.layerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.layerTitle}>Distance arcs</Text>
                    <Text style={styles.layerSub}>Every 50 m from your ball</Text>
                  </View>
                  <Switch value={rings} onValueChange={setRings} trackColor={{ true: colors.clubGreen, false: colors.border }} thumbColor={colors.white} />
                </View>
                <View style={[styles.layerRow, styles.layerSep]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.layerTitle}>Hazard distances</Text>
                    <Text style={styles.layerSub}>Reach / carry, in metres</Text>
                  </View>
                  <Switch value={hazards} onValueChange={setHazards} trackColor={{ true: colors.clubGreen, false: colors.border }} thumbColor={colors.white} />
                </View>
              </View>
            ) : null}

            {shot ? (
              <View style={[styles.card, styles.shotCard]} onLayout={(ev: LayoutChangeEvent) => { const hgt = ev.nativeEvent.layout.height; if (!collapsed) setShotCardH((cur) => Math.max(cur, hgt)); }} accessibilityLiveRegion="polite">
                <View style={styles.shotHead}>
                  <View style={[styles.chip, shot.risky && styles.chipWarn]}>
                    <Text style={[styles.chipText, shot.risky && styles.chipTextWarn]}>{shot.chip}</Text>
                  </View>
                  <View style={styles.headRight}>
                    <Text style={styles.from}>{atTee ? 'From the tee' : `From your ball · ${m(dist(ball, view.pin))} m to pin`}</Text>
                    <TouchableOpacity style={styles.collapseBtn} onPress={() => setCollapsed((c) => !c)} accessibilityLabel={collapsed ? 'Show shot details' : 'Hide shot details'}>
                      <Ionicons name={collapsed ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.shotMain}>
                  <Text style={styles.club}>{shot.club}</Text>
                  <Text style={styles.shotDist}>
                    {m(shot.d)}
                    <Text style={styles.shotUnit}> m</Text>
                  </Text>
                </View>
                {!collapsed ? (
                  <>
                    <View style={styles.stats}>
                      <View style={styles.stat}>
                        <Text style={styles.statLabel}>Leaves</Text>
                        <Text style={styles.statVal} numberOfLines={1}>
                          {putting ? '–' : finishesOnGreen ? 'Putt' : `${m(left)} m`}
                        </Text>
                      </View>
                      <View style={[styles.stat, styles.statSep]}>
                        <Text style={styles.statLabel}>Next</Text>
                        <Text style={styles.statVal} numberOfLines={1}>
                          {nextClub}
                        </Text>
                      </View>
                      <View style={[styles.stat, styles.statSep]}>
                        <Text style={styles.statLabel}>Usual miss</Text>
                        <Text style={styles.statVal} numberOfLines={1}>
                          {putting || shot.d < 30 ? '–' : `±${m(spread(shot.d))} m`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.why}>{shot.why}</Text>
                    {custom || !atTee ? (
                      <View style={styles.actions}>
                        {custom ? <PillButton label="Show suggested shot" onPress={() => setCustom(false)} /> : null}
                        {!atTee ? (
                          <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => {
                              setBall([view.tee[0], view.tee[1]]);
                              setCustom(false);
                            }}
                          >
                            <Text style={styles.secondaryBtnText}>Back to the tee</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {round.trackStats && h ? (
        <View style={styles.extraBar}>
          <Text style={styles.extraLabel}>Putts</Text>
          <View style={styles.miniStepper}>
            <TouchableOpacity
              style={styles.miniStep}
              disabled={typeof e?.s !== 'number' || (e?.putts ?? 0) <= 0}
              onPress={() => updateEntry(holeIdx, { putts: Math.max(0, (e?.putts ?? 2) - 1) })}
              accessibilityLabel="One putt fewer"
            >
              <Text style={styles.miniStepText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.miniVal}
              disabled={typeof e?.s !== 'number'}
              onPress={() => updateEntry(holeIdx, { putts: e?.putts == null ? Math.min(2, (e?.s as number) - 1) : null })}
              accessibilityLabel={e?.putts == null ? 'Enter two putts' : `${e.putts} putts. Tap to clear`}
            >
              <Text style={[styles.miniValText, e?.putts == null && styles.muted]}>{e?.putts ?? '–'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.miniStep}
              disabled={typeof e?.s !== 'number' || (e?.putts ?? 0) >= Math.min(MAX_PUTTS, (e?.s as number) - 1)}
              onPress={() => updateEntry(holeIdx, { putts: (e?.putts ?? 1) + 1 })}
              accessibilityLabel="One putt more"
            >
              <Text style={styles.miniStepText}>+</Text>
            </TouchableOpacity>
          </View>
          {h.par >= 4 ? (
            <>
              <Text style={[styles.extraLabel, { marginLeft: 8 }]}>Fairway</Text>
              <View style={styles.fwRow}>
                {(['left', 'hit', 'right'] as const).map((fw) => (
                  <TouchableOpacity
                    key={fw}
                    disabled={typeof e?.s !== 'number'}
                    style={[styles.fwBtn, e?.fw === fw && styles.fwBtnOn]}
                    onPress={() => updateEntry(holeIdx, { fw: e?.fw === fw ? null : fw })}
                    accessibilityLabel={fw === 'hit' ? 'Fairway hit' : `Missed ${fw}`}
                    accessibilityState={{ selected: e?.fw === fw }}
                  >
                    <Text style={[styles.fwText, e?.fw === fw && styles.fwTextOn]}>{fw === 'hit' ? 'Hit' : fw === 'left' ? '← L' : 'R →'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <Text style={[styles.extraHint]}>Par 3: no fairway</Text>
          )}
        </View>
      ) : null}

      <View style={[styles.scorebar, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.scoreLabel}>
          {offerPickup ? (
            <TouchableOpacity onPress={() => setScore('P')} accessibilityRole="button">
              <Text style={styles.pickup}>Pick up</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.sbSmall} numberOfLines={1}>
              {allIn && !completed ? 'Every hole is in · open the card to finish' : sbSmall}
            </Text>
          )}
          <Text style={[styles.sbResult, sbTone === 'good' && styles.good, sbTone === 'over' && styles.over]} numberOfLines={1}>
            {sbResult}
          </Text>
        </View>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.step} onPress={() => step(-1)} accessibilityLabel="One shot fewer">
            <Text style={styles.stepText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scoreVal, e?.s == null && styles.scoreValEmpty]}
            onPress={tapScore}
            onLongPress={() => setScore(null)}
            accessibilityLabel={e?.s == null ? `Enter par, ${h?.par}` : e.s === 'P' ? 'Picked up. Tap to clear' : `Score ${e.s}`}
            accessibilityHint={e?.s != null ? 'Press and hold to clear this hole' : undefined}
          >
            <Text style={[styles.scoreValText, e?.s == null && styles.scoreValTextEmpty]}>{e?.s == null ? h?.par : e.s}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.step} onPress={() => step(1)} accessibilityLabel="One shot more">
            <Text style={styles.stepText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.cardBtn, allIn && !completed && styles.cardBtnReady]} onPress={() => setSheet('card')} accessibilityLabel="Open scorecard">
          <Ionicons name="grid-outline" size={19} color={allIn && !completed ? colors.darkGreen : colors.clubGreen} />
          <View>
            <Text style={styles.cardBtnTotal}>{totalText}</Text>
            <Text style={styles.cardBtnThru}>{allIn && !completed ? 'Finish' : `thru ${totals?.holesPlayed ?? 0}`}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <GolfSheet
        visible={sheet === 'card'}
        title="Scorecard"
        subtitle={`${round.teeName} tees (${round.ratingGender}) · ${
          setup.handicaps ? `Playing handicap ${formatWhole(setup.handicaps.playing)} · ${Math.round(round.allowance * 100)}% of course handicap ${formatWhole(setup.handicaps.course)}` : 'No handicap: scratch'
        }`}
        onClose={() => setSheet(null)}
        footer={
          <>
            {!completed ? (
              <TouchableOpacity
                onPress={() =>
                  showAlert('Discard this round?', 'All the scores in this round will be deleted.', [
                    {
                      text: 'Discard round',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          if (saveTimer.current) clearTimeout(saveTimer.current);
                          await api.golfRoundDelete(round.id);
                          await AsyncStorage.removeItem(localKey(round.id)).catch(() => {});
                          setSheet(null);
                          navigation.goBack();
                        } catch (err) {
                          showAlert('Could not discard the round', err instanceof Error ? err.message : undefined);
                        }
                      },
                    },
                    { text: 'Keep playing', style: 'cancel' },
                  ])
                }
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Discard round</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            {completed ? (
              <PillButton label="Done" onPress={() => setSheet(null)} />
            ) : (
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {/* Digits stay out of the button label: PillButton's display font can't draw them. */}
                <PillButton label="Finish round" onPress={finish} disabled={!allIn || finishing} loading={finishing} />
                {!allIn ? <Text style={styles.toGo}>{holes.length - (totals?.holesPlayed ?? 0)} holes to go</Text> : null}
              </View>
            )}
          </>
        }
      >
        <Scorecard
          setup={setup}
          entries={entries}
          format={round.format}
          trackStats={round.trackStats}
          current={holeIdx}
          onPickHole={(i) => {
            setSheet(null);
            goToHole(i);
          }}
        />
      </GolfSheet>

      <GolfSheet visible={sheet === 'round'} title="Your round" onClose={() => setSheet(null)} footer={<><View /><PillButton label="Done" onPress={() => setSheet(null)} /></>}>
        <RoundInfo round={round} colors={colors} teeName={tee?.name ?? round.teeName} />
      </GolfSheet>

      <GolfSheet
        visible={sheet === 'bag'}
        title="My bag"
        subtitle="How far you carry each club, in metres. The suggested shot uses these."
        onClose={saveBag}
        footer={
          <>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setBag(DEFAULT_BAG);
                setBagDirty(true);
              }}
            >
              <Text style={styles.secondaryBtnText}>Reset to sample distances</Text>
            </TouchableOpacity>
            <PillButton label="Done" onPress={saveBag} />
          </>
        }
      >
        <View style={styles.clubs}>
          {bag.map((c, i) => (
            <View key={c.name + i} style={styles.clubRow}>
              <Text style={styles.clubName}>{c.name}</Text>
              <View style={styles.clubUnit}>
                <TextInput
                  value={c.carry ? String(c.carry) : ''}
                  onChangeText={(t) => {
                    const v = parseInt(t.replace(/[^0-9]/g, ''), 10);
                    setBag((cur) => cur.map((x, k) => (k === i ? { ...x, carry: Number.isFinite(v) ? Math.max(0, Math.min(350, v)) : 0 } : x)));
                    setBagDirty(true);
                  }}
                  keyboardType="number-pad"
                  style={styles.clubInput}
                  accessibilityLabel={`${c.name} carry in metres`}
                  maxLength={3}
                />
                <Text style={styles.muted}>m</Text>
              </View>
            </View>
          ))}
        </View>
      </GolfSheet>
    </View>
  );
}

function RoundInfo({ round, colors, teeName }: { round: RoundDto; colors: ThemeColors; teeName: string }) {
  const t = sheetText(colors);
  const rows: Array<[string, string]> = [
    ['Course', round.courseName],
    ['Tees', `${teeName} · ${round.ratingGender === 'men' ? 'Men' : 'Ladies'} · CR ${round.courseRating.toFixed(1)} · Slope ${round.slope} · Par ${round.par}`],
    ['Holes', `${round.holes.length} (${round.holes[0].n}–${round.holes[round.holes.length - 1].n})`],
    ['Format', `${round.format === 'stableford' ? 'Stableford' : 'Stroke play'} · ${Math.round(round.allowance * 100)}% allowance`],
    ['Handicap Index', round.handicapIndex == null ? 'None (scratch)' : formatIndex(round.handicapIndex)],
  ];
  if (round.courseHandicap != null && round.playingHandicap != null) {
    rows.push(['Course handicap', formatWhole(round.courseHandicap)], ['Playing handicap', formatWhole(round.playingHandicap)]);
  }
  return (
    <View style={{ gap: 4 }}>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={t.body}>{k}</Text>
          <Text style={[t.body, t.strong, { flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
        </View>
      ))}
      <Text style={[t.small, { marginTop: 6 }]}>
        These were fixed when the round started, so your shots and points can’t change mid-round. Change your Handicap Index or format before
        your next round.
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const shadow = { shadowColor: '#0C2016', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 };
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadError: { fontFamily: fontFamily.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
    muted: { color: colors.textMuted, fontFamily: fontFamily.body },
    top: { backgroundColor: colors.darkGreen, paddingHorizontal: 12, paddingBottom: 10, gap: 10, zIndex: 3 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    roundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    courseTitle: { flex: 1, minWidth: 0 },
    courseName: { fontFamily: fontFamily.heading, fontSize: 16, color: colors.white },
    saveState: { fontFamily: fontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.65)' },
    hcpBtn: { height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
    teeDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.65)' },
    hcpSmall: { fontFamily: fontFamily.body, fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.7)' },
    hcpValue: { fontFamily: fontFamily.bodySemiBold, fontSize: 13.5, color: colors.white },
    bagBtn: { backgroundColor: colors.lime, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
    bagText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.darkGreen },
    picker: { gap: 4, paddingRight: 4 },
    pill: { minWidth: 36, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    pillOn: { backgroundColor: colors.lime },
    pillNo: { fontFamily: fontFamily.bodySemiBold, fontSize: 15, color: colors.white, lineHeight: 17 },
    pillPar: { fontFamily: fontFamily.body, fontSize: 9.5, color: 'rgba(255,255,255,0.6)', lineHeight: 11 },
    pillTextOn: { color: colors.darkGreen },
    scoredDot: { position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime },
    map: { flex: 1, position: 'relative' },
    card: { backgroundColor: colors.surface, borderRadius: 16, ...shadow },
    holeBadge: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingLeft: 7, paddingRight: 14 },
    holeNo: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
    holeNoText: { fontFamily: fontFamily.headingBold, fontSize: 21, color: colors.lime },
    holePar: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    holeMeta: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted },
    dots: { color: colors.clubGreen, fontSize: 9, letterSpacing: 1 },
    gps: { position: 'absolute', left: 10, top: 70, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,34,24,0.72)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    gpsText: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.white },
    greens: { position: 'absolute', right: 10, top: 10, width: 86, paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
    greenRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', width: '100%', paddingHorizontal: 12 },
    greenLabel: { fontFamily: fontFamily.body, fontSize: 9.5, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.textMuted },
    greenVal: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.textPrimary },
    greenMid: { alignItems: 'center', paddingVertical: 3, marginVertical: 3, width: '100%', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
    greenMidVal: { fontFamily: fontFamily.bodySemiBold, fontSize: 28, lineHeight: 32, color: colors.clubGreen },
    controls: { position: 'absolute', right: 10, top: 150, gap: 8 },
    ctlGroup: { overflow: 'hidden' },
    ctl: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    ctlSep: { borderTopWidth: 1, borderTopColor: colors.border },
    layers: { position: 'absolute', right: 58, top: 150, width: 220, paddingHorizontal: 14, paddingVertical: 4, zIndex: 4 },
    layerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
    layerSep: { borderTopWidth: 1, borderTopColor: colors.border },
    layerTitle: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textPrimary },
    layerSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textMuted },
    shotCard: { position: 'absolute', left: 10, right: 10, bottom: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 8 },
    shotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    chip: { backgroundColor: colors.mintBg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
    chipWarn: { backgroundColor: colors.warningBg },
    chipText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.clubGreen },
    chipTextWarn: { color: colors.warning },
    headRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    from: { fontFamily: fontFamily.body, fontSize: 12, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
    collapseBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' },
    shotMain: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    club: { fontFamily: fontFamily.headingBold, fontSize: 28, color: colors.textPrimary, flexShrink: 1 },
    shotDist: { fontFamily: fontFamily.bodySemiBold, fontSize: 28, color: colors.textPrimary },
    shotUnit: { fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.textMuted },
    stats: { flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: 12, paddingVertical: 7 },
    stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    statSep: { borderLeftWidth: 1, borderLeftColor: colors.border },
    statLabel: { fontFamily: fontFamily.body, fontSize: 9.5, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.textMuted },
    statVal: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    why: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    toGo: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted },
    secondaryBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg },
    secondaryBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.textPrimary },
    extraBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 8 },
    extraLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.textSecondary },
    extraHint: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, marginLeft: 8 },
    miniStepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    miniStep: { width: 30, height: 32, alignItems: 'center', justifyContent: 'center' },
    miniStepText: { fontFamily: fontFamily.bodyMedium, fontSize: 18, color: colors.textPrimary },
    miniVal: { minWidth: 30, height: 32, alignItems: 'center', justifyContent: 'center' },
    miniValText: { fontFamily: fontFamily.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    fwRow: { flexDirection: 'row', gap: 4 },
    fwBtn: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 9, height: 32, justifyContent: 'center' },
    fwBtnOn: { backgroundColor: colors.darkGreen, borderColor: colors.darkGreen },
    fwText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.textSecondary },
    fwTextOn: { color: colors.lime },
    scorebar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, paddingLeft: 16, paddingRight: 12 },
    scoreLabel: { flex: 1, minWidth: 0 },
    sbSmall: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textMuted },
    sbResult: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    good: { color: colors.clubGreen },
    over: { color: colors.warning },
    pickup: { fontFamily: fontFamily.bodySemiBold, fontSize: 11.5, color: colors.clubGreen, textDecorationLine: 'underline' },
    stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 3 },
    step: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    stepText: { fontFamily: fontFamily.bodyMedium, fontSize: 22, color: colors.textPrimary },
    scoreVal: { width: 44, height: 42, borderRadius: 12, backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
    scoreValEmpty: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textMuted },
    scoreValText: { fontFamily: fontFamily.headingBold, fontSize: 24, color: colors.lime },
    scoreValTextEmpty: { color: colors.textMuted },
    cardBtn: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 9, paddingRight: 10 },
    cardBtnReady: { backgroundColor: colors.lime, borderColor: colors.lime },
    cardBtnTotal: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    cardBtnThru: { fontFamily: fontFamily.body, fontSize: 10.5, color: colors.textMuted },
    clubs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
    clubRow: { width: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
    clubName: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textPrimary },
    clubUnit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    clubInput: { width: 58, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.textPrimary, fontFamily: fontFamily.body, fontSize: 13, textAlign: 'right' },
  });
}
