import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { api, ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { haptic } from '../../utils/haptics';
import { friendlyError } from '../../utils/errors';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoType, type BentoTokens } from '../../theme/bento';
import { prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { BentoButton, BentoIcon, BentoTile, BentoToggle, type BentoIconName } from '../../components/bento';
import { GolfHoleMap, DARK_MAP, LIGHT_MAP, type GolfHoleMapHandle } from '../../components/golf/GolfHoleMap';
import { GolfLoading, GolfSheet } from '../../components/golf/GolfSheet';
import { Scorecard } from '../../components/golf/Scorecard';
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

// Nested in a Fraunces line, the unit text names the system font so it doesn't inherit Fraunces.
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });
const SAVE_DELAY_MS = 700;
const RETRY_MS = 15_000;
const localKey = (id: string) => `flagrr_round_entries_${id}`;
const m = Math.round;
const ptsText = (p: number) => `${p} pt${p === 1 ? '' : 's'}`;
const dots = (n: number) => (n > 0 ? '●'.repeat(Math.min(n, 4)) : '');
const shotsText = (st: number) => (st > 0 ? `${st} shot${st > 1 ? 's' : ''}` : st < 0 ? `gives back ${-st}` : 'no shots');

// The in-round screen: full screen (no tab bar), the hole map edge to edge
// with a glass header card and floating cards over it, and the score panel
// at the bottom. Scores save to the server as they're entered, with a local
// copy in case the signal drops. Boards: AppHole, G-D-Hole*, Dlg* sheets.
export function CourseGuideScreen({ navigation, route }: Props) {
  const { t, scheme } = useBento();
  const isDark = scheme === 'dark';
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
  // Measured heights that place the floating cards (header card, green card,
  // score panel) and keep the map's fitted hole clear of them.
  const [headerH, setHeaderH] = useState(150);
  const [greenH, setGreenH] = useState(90);
  const [scoreH, setScoreH] = useState(120);
  const [pillsW, setPillsW] = useState(0);
  const [bagFocus, setBagFocus] = useState<number | null>(null);

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
        setLoadError(friendlyError(e, 'Could not load the round.'));
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
        showAlert('Could not save that score', friendlyError(e));
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
      haptic.success();
      showAlert('Round saved', `${round.courseName}: ${t.points} Stableford points${t.gross != null ? `, ${t.gross} gross` : ''}. Your stats are in My Golf.`, [
        {
          text: 'See My Golf',
          // Replace the round with My Golf over the tabs (Back returns to the tabs, not the finished round).
          onPress: () =>
            navigation.dispatch((state) => {
              const main = state.routes.find((r) => r.name === 'Main');
              return main
                ? CommonActions.reset({ ...state, index: 1, routes: [main, { key: `MyGolf-${Date.now()}`, name: 'MyGolf', params: undefined }] })
                : CommonActions.navigate('MyGolf');
            }),
        },
        { text: 'Close', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      showAlert('Could not finish the round', friendlyError(err));
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
    // G-D-HoleError: a warning chip, the message and Back.
    return (
      <View style={{ flex: 1, backgroundColor: t.ground }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={{ position: 'absolute', left: 32, right: 32, top: insets.top + 252, alignItems: 'center', gap: 16 }}>
          <View style={{ width: 56, height: 56, borderRadius: 13, backgroundColor: t.warnBg, alignItems: 'center', justifyContent: 'center' }}>
            <BentoIcon name="golfWarning" size={27} color={t.warnInk} strokeWidth={1.8} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink, textAlign: 'center' }}>{loadError}</Text>
          <BentoButton label="Back" variant="secondary" compact onPress={() => navigation.goBack()} style={{ width: 140, minHeight: 44 }} />
        </View>
      </View>
    );
  }
  if (!round || !setup || (!course && !mapMissing)) {
    return (
      <View style={{ flex: 1, backgroundColor: t.ground, alignItems: 'center', justifyContent: 'center' }}>
        <GolfLoading />
      </View>
    );
  }

  const tee = course?.map.tees.find((tt) => tt.id === round.teeId);
  const completed = round.status === 'completed';
  const st = res?.strokesReceived ?? 0;
  const hasMap = Boolean(view && course);
  const headerTop = insets.top + 8;
  const headerBottom = headerTop + headerH;
  const greenTop = headerBottom + 2;
  const controlsTop = greenTop + greenH + 8;
  const pillW = pillsW ? (pillsW - 5 * 6) / 6 : 52;
  const saveText = saveState === 'offline' ? 'Not saved yet · will retry' : saveState === 'saving' ? 'Saving…' : completed ? 'Finished round · changes save' : 'Saved';
  const ready = allIn && !completed;
  const resultColor = e?.s == null ? t.muted : sbTone === 'good' ? t.accent : sbTone === 'over' ? t.warnInk : t.ink;

  return (
    <View style={{ flex: 1, backgroundColor: hasMap ? (isDark ? DARK_MAP : LIGHT_MAP).rough : t.ground }}>
      {/* Light icons over the map and its dark header card; on the plain ground (no map) in light theme, dark icons. */}
      <StatusBar barStyle={hasMap || isDark ? 'light-content' : 'dark-content'} />

      {view && course ? (
        <View style={StyleSheet.absoluteFill}>
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
            insets={{ top: headerBottom + 8, bottom: scoreH + (collapsed ? 70 : shotCardH) + 24, left: 10, right: 60 }}
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
        </View>
      ) : (
        // G-D-HoleNoMap: the message in a tile on the plain ground.
        <View style={{ position: 'absolute', left: 24, right: 24, top: headerBottom + 100 }}>
          <BentoTile padding={20}>
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <BentoIcon name="golfFlag" size={30} color={t.accent} strokeWidth={1.8} />
              </View>
              <Text style={{ fontSize: 16, lineHeight: 23, color: t.ink, textAlign: 'center' }}>The map for this course isn’t available any more, but you can still keep score below.</Text>
            </View>
          </BentoTile>
        </View>
      )}

      {/* Header card: back, hole, course, HCP, Bag; hole facts and save status; hole pills. */}
      <MapGlass
        solid={!hasMap}
        radius={28}
        style={{ position: 'absolute', left: 12, right: 12, top: headerTop, padding: 10, zIndex: 3 }}
        onLayout={(ev) => setHeaderH(Math.round(ev.nativeEvent.layout.height))}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={completed ? 'Back' : 'Back. Your round stays in progress'}
            hitSlop={2}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(10,24,17,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
          >
            <BentoIcon name="back" size={20} color="#FFFFFF" strokeWidth={1.8} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...bentoType.number, fontSize: 21, lineHeight: 23, letterSpacing: -0.5, color: '#FFFFFF' }}>{h ? `Hole ${h.n}` : ''}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)' }} numberOfLines={1}>
              {round.courseName}
            </Text>
          </View>
          <Pressable
            onPress={() => setSheet('round')}
            accessibilityRole="button"
            accessibilityLabel="Your round: tees and handicap"
            style={{ height: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', gap: 7 }}
          >
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: round.teeColor, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.55)' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>HCP</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF', marginLeft: 4 }}>{round.handicapIndex == null ? '–' : formatIndex(round.handicapIndex)}</Text>
            </View>
          </Pressable>
          {course ? (
            <Pressable
              onPress={() => setSheet('bag')}
              accessibilityRole="button"
              accessibilityLabel="My bag"
              style={{ height: 44, paddingHorizontal: 15, borderRadius: 999, backgroundColor: bentoBrand.lime, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: bentoBrand.fairway }}>Bag</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', rowGap: 2, columnGap: 10, marginTop: 8, paddingHorizontal: 4 }}>
          {h ? (
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.86)' }}>
              Par {h.par}
              {st > 0 ? (
                <Text style={{ color: bentoBrand.lime, letterSpacing: 1 }} accessibilityLabel={`${st} shot${st > 1 ? 's' : ''} received`}>
                  {` ${dots(st)}`}
                </Text>
              ) : null}
              {' · '}
              <Text>{`${h.length} m · SI ${h.si}${setup.handicaps ? ` · ${shotsText(st)}` : ''}`}</Text>
            </Text>
          ) : null}
          <SaveStatus state={saveState} text={saveText} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(ev) => setPillsW(ev.nativeEvent.layout.width)}
          style={{ marginTop: 10 }}
          contentContainerStyle={{ gap: 6 }}
        >
          {holes.map((hh, i) => {
            const on = i === holeIdx;
            const scored = entries[i]?.s != null;
            return (
              <Pressable
                key={hh.n}
                onPress={() => goToHole(i)}
                accessibilityRole="button"
                accessibilityLabel={`Hole ${hh.n}, par ${hh.par}${scored ? ', scored' : ''}`}
                accessibilityState={{ selected: on }}
                style={{ width: pillW, height: 44, borderRadius: 13, backgroundColor: on ? bentoBrand.lime : 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: on ? bentoBrand.fairway : '#FFFFFF' }}>{hh.n}</Text>
                <Text style={{ fontSize: 12, color: on ? bentoBrand.fairway : 'rgba(255,255,255,0.72)' }}>P{hh.par}</Text>
                {scored ? <View style={{ position: 'absolute', top: 5, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: on ? bentoBrand.fairway : bentoBrand.lime }} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </MapGlass>

      {view && course ? (
        <>
          {/* GPS is not wanted (owner decision 24 Nov 2026): no "GPS integration coming soon" chip. */}
          <MapGlass
            radius={18}
            pointerEvents="none"
            accessibilityRole="image"
            accessibilityLabel={gd ? `Green: front ${gd[0]}, middle ${gd[1]}, back ${gd[2]} metres` : undefined}
            style={{ position: 'absolute', right: 12, top: greenTop, paddingVertical: 10, paddingHorizontal: 14, gap: 2, zIndex: 2 }}
            onLayout={(ev) => setGreenH(Math.round(ev.nativeEvent.layout.height))}
          >
            {(
              [
                ['Back', gd?.[2], 15],
                ['Middle', gd?.[1], 24],
                ['Front', gd?.[0], 15],
              ] as const
            ).map(([label, v, size]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 8 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{label}</Text>
                <Text style={{ ...bentoType.number, fontSize: size, color: '#FFFFFF' }}>{v ?? '–'}</Text>
              </View>
            ))}
          </MapGlass>

          <View style={{ position: 'absolute', right: 12, top: controlsTop, gap: 8, zIndex: 2 }}>
            <MapButton icon="plus" label="Zoom in" onPress={() => mapRef.current?.zoomBy(1.35)} />
            <MapButton icon="golfMinus" label="Zoom out" onPress={() => mapRef.current?.zoomBy(1 / 1.35)} />
            <MapButton icon="golfFit" label="Show the whole hole" onPress={() => mapRef.current?.fit()} />
            <MapButton icon="golfLayers" label="Map layers" on={layersOpen} expanded={layersOpen} onPress={() => setLayersOpen((o) => !o)} />
          </View>
          {layersOpen ? (
            <View
              accessibilityViewIsModal={false}
              style={{ position: 'absolute', right: 64, top: controlsTop + 70, width: 262, paddingVertical: 4, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.tile, boxShadow: '0 18px 40px -16px rgba(0,0,0,0.55)', zIndex: 4 }}
            >
              <LayerRow t={t} title="Distance arcs" sub="Every 50 m from your ball" value={rings} onChange={setRings} />
              <LayerRow t={t} title="Hazard distances" sub="Reach / carry, in metres" value={hazards} onChange={setHazards} sep />
            </View>
          ) : null}

          {shot ? (
            <View
              accessibilityLiveRegion="polite"
              aria-live="polite"
              pointerEvents="box-none"
              style={{ position: 'absolute', left: 12, right: 66, bottom: scoreH + 12, gap: 12, zIndex: 2 }}
            >
              {!collapsed && (custom || !atTee) ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {custom ? <GlassChip label="Show suggested shot" onPress={() => setCustom(false)} /> : null}
                  {!atTee ? (
                    <GlassChip
                      label="Back to the tee"
                      onPress={() => {
                        setBall([view.tee[0], view.tee[1]]);
                        setCustom(false);
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
              <View
                onLayout={(ev: LayoutChangeEvent) => {
                  const hgt = ev.nativeEvent.layout.height;
                  if (!collapsed) setShotCardH((cur) => Math.max(cur, hgt));
                }}
                style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, backgroundColor: t.tile, boxShadow: '0 14px 30px -14px rgba(0,0,0,0.55)' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <View style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: shot.risky ? t.warnBg : t.accentSoft }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: shot.risky ? t.warnInk : t.accent }}>{shot.chip}</Text>
                  </View>
                  <Pressable
                    onPress={() => setCollapsed((c) => !c)}
                    accessibilityRole="button"
                    accessibilityLabel={collapsed ? 'Show shot details' : 'Hide shot details'}
                    accessibilityState={{ expanded: !collapsed }}
                    style={{ minHeight: 44, marginVertical: -12, marginRight: -6, paddingHorizontal: 6, justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent }}>{collapsed ? 'Show shot details' : 'Hide shot details'}</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>{atTee ? 'From the tee' : `From your ball · ${m(dist(ball, view.pin))} m to pin`}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
                  <Text style={{ ...bentoType.number, fontSize: 24, letterSpacing: -0.6, color: t.ink, flexShrink: 1 }}>{shot.club}</Text>
                  <Text style={{ ...bentoType.number, fontSize: 24, letterSpacing: -0.6, color: t.ink }}>
                    {m(shot.d)}
                    <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 13, fontWeight: '400', letterSpacing: 0, color: t.muted }}> m</Text>
                  </Text>
                </View>
                {!collapsed ? (
                  <>
                    <View style={{ flexDirection: 'row', marginTop: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: t.seg }}>
                      {(
                        [
                          ['Leaves', putting ? '–' : finishesOnGreen ? 'Putt' : `${m(left)} m`],
                          ['Next', nextClub],
                          ['Usual miss', putting || shot.d < 30 ? '–' : `±${m(spread(shot.d))} m`],
                        ] as const
                      ).map(([k, v], i) => (
                        <View key={k} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4, borderLeftWidth: i ? 1 : 0, borderLeftColor: t.hair }}>
                          <Text style={{ fontSize: 12, color: t.muted }}>{k}</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }} numberOfLines={1}>
                            {v}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontSize: 13, lineHeight: 18, color: t.muted, marginTop: 8 }}>{shot.why}</Text>
                  </>
                ) : null}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {/* Score panel (G-D-Hole*): putts and fairway when tracked, then the score row. */}
      <View
        accessibilityLabel="Score"
        onLayout={(ev) => setScoreH(Math.round(ev.nativeEvent.layout.height))}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 12,
          paddingHorizontal: 14 + Math.max(insets.left, insets.right),
          paddingBottom: Math.max(26, insets.bottom),
          backgroundColor: t.tile,
          borderTopWidth: 1,
          borderTopColor: t.hair,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          zIndex: 2,
        }}
      >
        {round.trackStats && h ? (
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-end', marginBottom: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, color: t.muted }}>Putts</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 2, borderRadius: 16, backgroundColor: t.seg }}>
                <StepButton
                  t={t}
                  icon="golfMinus"
                  label="One putt fewer"
                  disabled={typeof e?.s !== 'number' || (e?.putts ?? 0) <= 0}
                  onPress={() => updateEntry(holeIdx, { putts: Math.max(0, (e?.putts ?? 2) - 1) })}
                />
                <Pressable
                  disabled={typeof e?.s !== 'number'}
                  onPress={() => updateEntry(holeIdx, { putts: e?.putts == null ? Math.min(2, (e?.s as number) - 1) : null })}
                  accessibilityRole="button"
                  accessibilityLabel={e?.putts == null ? 'Enter two putts' : `${e.putts} putts. Tap to clear`}
                  accessibilityState={{ disabled: typeof e?.s !== 'number' }}
                  aria-disabled={typeof e?.s !== 'number'}
                  style={[
                    { width: 40, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
                    e?.putts == null ? { backgroundColor: t.tile, boxShadow: `0 0 0 1px ${t.hair}` } : { backgroundColor: bentoBrand.fairway },
                  ]}
                >
                  {e?.putts == null ? (
                    <Text style={{ fontSize: 18, fontWeight: '600', color: t.muted }}>–</Text>
                  ) : (
                    <Text style={{ ...bentoType.number, fontSize: 20, color: '#FFFFFF' }}>{e.putts}</Text>
                  )}
                </Pressable>
                <StepButton
                  t={t}
                  icon="plus"
                  label="One putt more"
                  disabled={typeof e?.s !== 'number' || (e?.putts ?? 0) >= Math.min(MAX_PUTTS, (e?.s as number) - 1)}
                  onPress={() => updateEntry(holeIdx, { putts: (e?.putts ?? 1) + 1 })}
                />
              </View>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 12, color: t.muted }}>{h.par >= 4 ? 'Fairway' : ' '}</Text>
              {h.par >= 4 ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['left', 'hit', 'right'] as const).map((fw) => {
                    const on = e?.fw === fw;
                    const off = typeof e?.s !== 'number';
                    return (
                      <Pressable
                        key={fw}
                        disabled={off}
                        onPress={() => updateEntry(holeIdx, { fw: on ? null : fw })}
                        accessibilityRole="button"
                        accessibilityLabel={fw === 'hit' ? 'Fairway hit' : `Missed ${fw}`}
                        accessibilityState={{ selected: on, disabled: off }}
                        aria-disabled={off}
                        style={[
                          { flex: 1, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.4 : 1 },
                          on ? { backgroundColor: t.accent } : { backgroundColor: t.tile, boxShadow: `0 0 0 1px ${t.hair}` },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: on ? t.accentInk : t.ink }}>{fw === 'hit' ? 'Hit' : fw === 'left' ? '← L' : 'R →'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={{ height: 44, borderRadius: 13, backgroundColor: t.seg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, color: t.muted }}>Par 3: no fairway</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {offerPickup ? (
              <Pressable onPress={() => setScore('P')} accessibilityRole="button" style={{ minHeight: 24, justifyContent: 'center', alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent, textDecorationLine: 'underline' }}>Pick up</Text>
              </Pressable>
            ) : (
              <Text style={{ fontSize: 12, lineHeight: 16, color: t.muted }} numberOfLines={2}>
                {ready ? 'Every hole is in · open the card to finish' : sbSmall}
              </Text>
            )}
            <Text style={{ fontSize: 16, fontWeight: '700', color: resultColor, marginTop: 2 }} numberOfLines={1}>
              {sbResult}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 2, borderRadius: 16, backgroundColor: t.seg }}>
            <StepButton t={t} icon="golfMinus" label="One shot fewer" onPress={() => step(-1)} />
            <Pressable
              onPress={tapScore}
              onLongPress={() => setScore(null)}
              accessibilityRole="button"
              accessibilityLabel={e?.s == null ? `Enter par, ${h?.par}` : e.s === 'P' ? 'Picked up. Tap to clear' : `Score ${e.s}`}
              accessibilityHint={e?.s != null ? 'Press and hold to clear this hole' : undefined}
              style={[
                { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
                e?.s == null
                  ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.muted }
                  : e.s === 'P'
                    ? { backgroundColor: t.warnBg }
                    : { backgroundColor: bentoBrand.fairway },
              ]}
            >
              <Text style={{ ...bentoType.number, fontSize: 20, color: e?.s == null ? t.muted : e.s === 'P' ? t.warnInk : '#FFFFFF' }}>{e?.s == null ? h?.par : e.s}</Text>
            </Pressable>
            <StepButton t={t} icon="plus" label="One shot more" onPress={() => step(1)} />
          </View>
          <Pressable
            onPress={() => setSheet('card')}
            accessibilityRole="button"
            accessibilityLabel="Open scorecard"
            style={{ width: 84, height: 52, borderRadius: 16, backgroundColor: ready ? bentoBrand.lime : t.seg, alignItems: 'center', justifyContent: 'center', gap: 1 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <BentoIcon name="golfCard" size={14} color={ready ? bentoBrand.fairway : t.muted} strokeWidth={2} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: ready ? bentoBrand.fairway : t.ink }}>{totalText}</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: ready ? '700' : '400', color: ready ? bentoBrand.fairway : t.muted }}>{ready ? 'Finish' : `thru ${totals?.holesPlayed ?? 0}`}</Text>
          </Pressable>
        </View>
      </View>

      <GolfSheet
        visible={sheet === 'card'}
        title="Scorecard"
        subtitle={`${round.teeName} tees (${round.ratingGender}) · ${
          setup.handicaps ? `Playing handicap ${formatWhole(setup.handicaps.playing)} · ${Math.round(round.allowance * 100)}% of course handicap ${formatWhole(setup.handicaps.course)}` : 'No handicap: scratch'
        }`}
        onClose={() => setSheet(null)}
        footer={
          completed ? (
            <BentoButton label="Done" compact onPress={() => setSheet(null)} style={{ flex: 1, minHeight: 44 }} />
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <BentoButton
                label="Discard round"
                variant="secondary"
                compact
                style={{ flex: 1, minHeight: 44 }}
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
                          showAlert('Could not discard the round', friendlyError(err));
                        }
                      },
                    },
                    { text: 'Keep playing', style: 'cancel' },
                  ])
                }
              />
              <View style={{ flex: 1.2, alignItems: 'stretch', gap: 4 }}>
                <BentoButton label="Finish round" compact onPress={finish} disabled={!allIn || finishing} loading={finishing} style={{ minHeight: 44 }} />
                {!allIn ? <Text style={{ fontSize: 12, color: t.muted, textAlign: 'center' }}>{holes.length - (totals?.holesPlayed ?? 0)} holes to go</Text> : null}
              </View>
            </View>
          )
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

      <GolfSheet
        visible={sheet === 'round'}
        title="Your round"
        onClose={() => setSheet(null)}
        footer={<BentoButton label="Done" compact onPress={() => setSheet(null)} style={{ flex: 1, minHeight: 44 }} />}
      >
        <RoundInfo round={round} t={t} teeName={tee?.name ?? round.teeName} />
      </GolfSheet>

      <GolfSheet
        visible={sheet === 'bag'}
        title="My bag"
        subtitle="How far you carry each club, in metres. The suggested shot uses these."
        onClose={saveBag}
        footer={
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={() => {
                setBag(DEFAULT_BAG);
                setBagDirty(true);
              }}
              accessibilityRole="button"
              style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: t.accent }}>Reset to sample distances</Text>
            </Pressable>
            <BentoButton label="Done" compact onPress={saveBag} style={{ width: 120, minHeight: 44 }} />
          </View>
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 }}>
          {bag.map((c, i) => (
            <View
              key={c.name + i}
              style={{ width: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: t.hair }}
            >
              <Text style={{ fontSize: 15, color: t.ink, flexShrink: 1 }}>{c.name}</Text>
              <View
                style={[
                  { width: 76, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
                  bagFocus === i ? { backgroundColor: t.tile, boxShadow: `0 0 0 2px ${t.accent}` } : { backgroundColor: t.seg },
                ]}
              >
                <TextInput
                  value={c.carry ? String(c.carry) : ''}
                  onChangeText={(text) => {
                    const v = parseInt(text.replace(/[^0-9]/g, ''), 10);
                    setBag((cur) => cur.map((x, k) => (k === i ? { ...x, carry: Number.isFinite(v) ? Math.max(0, Math.min(350, v)) : 0 } : x)));
                    setBagDirty(true);
                  }}
                  onFocus={() => setBagFocus(i)}
                  onBlur={() => setBagFocus((f) => (f === i ? null : f))}
                  keyboardType="number-pad"
                  accessibilityLabel={`${c.name} carry in metres`}
                  maxLength={3}
                  style={[
                    { ...bentoType.number, width: 38, padding: 0, fontSize: 17, color: t.ink, textAlign: 'right' },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null,
                  ]}
                />
                <Text style={{ fontSize: 12, color: t.muted }}>m</Text>
              </View>
            </View>
          ))}
        </View>
      </GolfSheet>
    </View>
  );
}

// The hole view's dark map glass (bento-kit .mglass): a dark green frosted
// panel over the map, or solid fairway green when there's no map behind it.
function MapGlass({
  children,
  radius,
  style,
  solid = false,
  ...rest
}: {
  children?: React.ReactNode;
  radius: number;
  style?: ViewStyle;
  solid?: boolean;
  pointerEvents?: 'none' | 'box-none' | 'auto';
  accessibilityRole?: 'image';
  accessibilityLabel?: string;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const glass: ViewStyle = solid
    ? { backgroundColor: bentoBrand.fairway, borderColor: 'rgba(255,255,255,0.10)' }
    : Platform.OS === 'web'
      ? ({ backgroundColor: 'rgba(16,34,24,0.62)', borderColor: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(22px) saturate(1.6)', WebkitBackdropFilter: 'blur(22px) saturate(1.6)' } as unknown as ViewStyle)
      : // Native: no live blur over the SVG map; a slightly denser tint keeps text legible.
        { backgroundColor: 'rgba(16,34,24,0.78)', borderColor: 'rgba(255,255,255,0.14)' };
  return (
    <View {...rest} style={[{ borderRadius: radius, borderWidth: 1 }, glass, style]}>
      {children}
    </View>
  );
}

function MapButton({ icon, label, onPress, on = false, expanded }: { icon: BentoIconName; label: string; onPress: () => void; on?: boolean; expanded?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={expanded == null ? undefined : { expanded }} aria-expanded={expanded}>
      <MapGlass radius={14} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', ...(on ? { backgroundColor: bentoBrand.lime, borderColor: bentoBrand.lime } : null) }}>
        <BentoIcon name={icon} size={19} color={on ? bentoBrand.fairway : '#FFFFFF'} strokeWidth={1.9} />
      </MapGlass>
    </Pressable>
  );
}

function GlassChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <MapGlass radius={999} style={{ height: 44, paddingHorizontal: 14, justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>{label}</Text>
      </MapGlass>
    </Pressable>
  );
}

function StepButton({ t, icon, label, onPress, disabled = false }: { t: BentoTokens; icon: BentoIconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <BentoIcon name={icon} size={18} color={t.ink} strokeWidth={2} />
    </Pressable>
  );
}

function LayerRow({ t, title, sub, value, onChange, sep = false }: { t: BentoTokens; title: string; sub: string; value: boolean; onChange: (v: boolean) => void; sep?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: sep ? 1 : 0, borderTopColor: t.hair }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{title}</Text>
        <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{sub}</Text>
      </View>
      <BentoToggle value={value} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

// "Saved" (lime tick), "Saving…" (spinning ring), "Not saved yet · will retry"
// (amber, no-signal icon) and "Finished round · changes save" (lime tick).
function SaveStatus({ state, text }: { state: 'saved' | 'saving' | 'offline'; text: string }) {
  const color = state === 'offline' ? '#F1D39B' : state === 'saving' ? 'rgba(255,255,255,0.85)' : bentoBrand.lime;
  return (
    <View accessibilityRole="text" role="status" style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {state === 'saving' ? <SpinRing /> : <BentoIcon name={state === 'offline' ? 'golfOffline' : 'check'} size={14} color={color} strokeWidth={state === 'offline' ? 2 : 2.4} />}
      <Text style={{ fontSize: 12, color }}>{text}</Text>
    </View>
  );
}

function SpinRing() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{
        width: 11,
        height: 11,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.35)',
        borderTopColor: '#FFFFFF',
        transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
}

function RoundInfo({ round, t, teeName }: { round: RoundDto; t: BentoTokens; teeName: string }) {
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
    <View>
      <View style={{ borderRadius: 20, backgroundColor: t.seg, paddingVertical: 2, paddingHorizontal: 16 }}>
        {rows.map(([k, v], i) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}>
            <Text style={{ fontSize: 15, color: t.muted }}>{k}</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 13, lineHeight: 19, color: t.muted, marginTop: 14 }}>
        These were fixed when the round started, so your shots and points can’t change mid-round. Change your Handicap Index or format before your next round.
      </Text>
    </View>
  );
}
