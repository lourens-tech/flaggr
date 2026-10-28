import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fontFamily } from '../../theme';
import type { Pt, TeeDef } from '../../golf/courseMap';
import { dist, hazardLabels, lengthSpread, onGreen, spread, type HoleView } from '../../golf/holeGeometry';

// The in-round hole view: the hole drawn tee-at-bottom, green-at-top, with
// the ball, the target, the shot line, distance arcs and hazard numbers on
// top. Drag to move around, pinch / scroll / buttons to zoom, tap to aim,
// drag the ball or the target to move them. Ported from the Course Guide
// mockup; geometry lives in golf/holeGeometry.ts.

export interface MapPalette {
  rough: string;
  semi: string;
  fairway: string;
  green: string;
  fringe: string;
  tee: string;
  sand: string;
  sandEdge: string;
  water: string;
  waterEdge: string;
  tree: string;
  shade: string;
  scrub: string;
  path: string;
}

export const LIGHT_MAP: MapPalette = {
  rough: '#6F9A4F',
  semi: '#7BA757',
  fairway: '#8DC05C',
  green: '#AAD76F',
  fringe: '#98C963',
  tee: '#9ECC67',
  sand: '#F1E6C8',
  sandEdge: '#D6C394',
  water: '#5AA3C8',
  waterEdge: '#3E85AD',
  tree: '#2E5B35',
  shade: 'rgba(10,30,15,0.22)',
  scrub: '#5E8A43',
  path: '#D9D3BF',
};

export const DARK_MAP: MapPalette = {
  rough: '#34512D',
  semi: '#3B5B32',
  fairway: '#4B723A',
  green: '#5E8D49',
  fringe: '#548243',
  tee: '#578540',
  sand: '#BFB18A',
  sandEdge: '#9C8D66',
  water: '#2F6C8D',
  waterEdge: '#245873',
  tree: '#1B3521',
  shade: 'rgba(0,0,0,0.35)',
  scrub: '#2E4A27',
  path: '#6E6A5A',
};

interface View2D {
  cx: number;
  cy: number;
  s: number; // pixels per metre
}

export interface GolfHoleMapHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
}

interface Props {
  hole: HoleView;
  tees: TeeDef[];
  palette: MapPalette;
  ball: Pt;
  target: Pt;
  showRings: boolean;
  showHazards: boolean;
  draggedBall: boolean;
  // Space covered by floating cards, kept clear when fitting the hole.
  insets: { top: number; bottom: number; left: number; right: number };
  onBallMove: (p: Pt) => void;
  onTargetMove: (p: Pt) => void;
  onTouchStart?: () => void;
}

const f = (v: number) => v.toFixed(1);
const openPath = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(-y)}`).join('L');
const ringsPath = (rings: Pt[][]) => rings.map((r) => openPath(r) + 'Z').join('');
const D2R = Math.PI / 180;
const LABEL_FONT = fontFamily.bodySemiBold;

/** The static drawing of a hole in world units (metres, y flipped). */
const HoleArt = memo(function HoleArt({ hole, tees, palette }: { hole: HoleView; tees: TeeDef[]; palette: MapPalette }) {
  const [x0, y0, x1, y1] = hole.bounds;
  const pad = 900;
  const area = (k: string) => hole.draw.filter((ft) => ft.k === k && ft.r);
  const lines = (k: string) => hole.draw.filter((ft) => ft.k === k && ft.l);
  const teeColor = (id: string) => tees.find((t) => t.id === id)?.color;
  return (
    <G>
      <Rect x={x0 - pad} y={-(y1 + pad)} width={x1 - x0 + pad * 2} height={y1 - y0 + pad * 2} fill={palette.rough} />
      {area('range').map((ft, i) => (
        <Path key={`rg${i}`} d={ringsPath(ft.r!)} fill={palette.semi} fillRule="evenodd" />
      ))}
      {area('scrub').map((ft, i) => (
        <Path key={`sc${i}`} d={ringsPath(ft.r!)} fill={palette.scrub} fillRule="evenodd" />
      ))}
      {area('wood').map((ft, i) => (
        <Path key={`wd${i}`} d={ringsPath(ft.r!)} fill={palette.tree} fillRule="evenodd" />
      ))}
      {area('fairway').map((ft, i) => (
        <Path key={`sm${i}`} d={ringsPath(ft.r!)} fill={palette.semi} stroke={palette.semi} strokeWidth={5} strokeLinejoin="round" fillRule="evenodd" />
      ))}
      {area('fairway').map((ft, i) => (
        <Path key={`fw${i}`} d={ringsPath(ft.r!)} fill={palette.fairway} fillRule="evenodd" />
      ))}
      {lines('cartpath').map((ft, i) => (
        <Path key={`cp${i}`} d={openPath(ft.l!)} fill="none" stroke={palette.path} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {hole.tees.map((t, i) => {
        const cx = t.pts.reduce((a, p) => a + p[0], 0) / t.pts.length;
        const cy = t.pts.reduce((a, p) => a + p[1], 0) / t.pts.length;
        return (
          <G key={`te${i}`}>
            <Path d={ringsPath([t.pts])} fill={palette.tee} />
            {t.tees.map((id, k) => {
              const c = teeColor(id);
              return c ? (
                <Circle key={id} cx={cx + (k - (t.tees.length - 1) / 2) * 3} cy={-cy} r={1.3} fill={c} stroke="rgba(0,0,0,0.45)" strokeWidth={0.35} />
              ) : null;
            })}
          </G>
        );
      })}
      {area('water').map((ft, i) => (
        <Path key={`wa${i}`} d={ringsPath(ft.r!)} fill={palette.water} stroke={palette.waterEdge} strokeWidth={1.5} fillRule="evenodd" />
      ))}
      {hole.greens.map((g, i) => (
        <Path key={`gr${i}`} d={ringsPath([g])} fill={palette.green} stroke={palette.fringe} strokeWidth={2.5} strokeLinejoin="round" />
      ))}
      {area('bunker').map((ft, i) => (
        <Path key={`bu${i}`} d={ringsPath(ft.r!)} fill={palette.sand} stroke={palette.sandEdge} strokeWidth={0.6} fillRule="evenodd" />
      ))}
      {lines('treerow').map((ft, i) => (
        <G key={`tr${i}`}>
          <Path d={openPath(ft.l!)} fill="none" stroke={palette.shade} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" transform="translate(1.5 1.5)" />
          <Path d={openPath(ft.l!)} fill="none" stroke={palette.tree} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      ))}
    </G>
  );
});

const pillW = (text: string, big: boolean) => text.length * (big ? 6.6 : 5.9) + (big ? 16 : 12);
const hit = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

function Pill({ x, y, text, big }: { x: number; y: number; text: string; big: boolean }) {
  const w = pillW(text, big);
  const hh = big ? 22 : 18;
  return (
    <G transform={`translate(${f(x)} ${f(y)})`}>
      <Rect x={-w / 2} y={-hh / 2} width={w} height={hh} rx={hh / 2} fill={big ? '#1F4234' : 'rgba(16,34,24,0.72)'} />
      <SvgText x={0} y={big ? 4 : 3.6} textAnchor="middle" fontFamily={LABEL_FONT} fontSize={big ? 11.5 : 10} fill={big ? '#FFFFFF' : '#F4F7F1'}>
        {text}
      </SvgText>
    </G>
  );
}

export const GolfHoleMap = forwardRef<GolfHoleMapHandle, Props>(function GolfHoleMap(props, ref) {
  const { hole, tees, palette, ball, target, showRings, showHazards, draggedBall, insets } = props;
  const [size, setSize] = useState({ W: 0, H: 0 });
  const [view, setView] = useState<View2D>({ cx: 0, cy: 0, s: 1 });
  const containerRef = useRef<View>(null);
  const offset = useRef({ x: 0, y: 0 });

  // Everything the gesture handlers read, kept in refs so the PanResponder
  // (created once) always sees current values.
  const live = useRef({ props, view, size });
  live.current = { props, view, size };

  const toScreen = useCallback(
    (p: Pt, v: View2D = view, W = size.W, H = size.H): Pt => [W / 2 + v.s * (p[0] - v.cx), H / 2 + v.s * (v.cy - p[1])],
    [view, size],
  );
  const toWorld = (px: number, py: number): Pt => {
    const { view: v, size: sz } = live.current;
    return [(px - sz.W / 2) / v.s + v.cx, v.cy - (py - sz.H / 2) / v.s];
  };

  const fitView = useCallback((): View2D | null => {
    const { W, H } = live.current.size;
    if (!W || !H) return null;
    const [x0, y0, x1, y1] = live.current.props.hole.bounds;
    const ins = live.current.props.insets;
    const box = { l: ins.left, r: W - ins.right, t: ins.top, b: H - ins.bottom };
    const s = Math.max(0.2, Math.min((box.r - box.l) / (x1 - x0), (box.b - box.t) / (y1 - y0)));
    const bcx = (x0 + x1) / 2;
    const bcy = (y0 + y1) / 2;
    return { s, cx: bcx - ((box.l + box.r) / 2 - W / 2) / s, cy: bcy + ((box.t + box.b) / 2 - H / 2) / s };
  }, []);

  // True once the member pans or zooms, so a change in the space kept clear
  // (the shot card growing, say) doesn't throw their view away.
  const userMoved = useRef(false);

  const fit = useCallback(() => {
    const v = fitView();
    if (v) {
      userMoved.current = false;
      setView(v);
    }
  }, [fitView]);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    userMoved.current = true;
    setView((v) => {
      const { W, H } = live.current.size;
      const w: Pt = [(px - W / 2) / v.s + v.cx, v.cy - (py - H / 2) / v.s];
      const s = Math.max(0.35, Math.min(14, v.s * factor));
      return { s, cx: w[0] - (px - W / 2) / s, cy: w[1] + (py - H / 2) / s };
    });
  }, []);

  useImperativeHandle(ref, () => ({ fit, zoomBy: (factor) => zoomAt(live.current.size.W / 2, live.current.size.H / 2, factor) }), [fit, zoomAt]);

  // Refit for a new hole or screen size; for a change in the space kept
  // clear only while the member hasn't moved the map themselves.
  useEffect(() => {
    fit();
  }, [hole, size.W, size.H, fit]);
  useEffect(() => {
    if (!userMoved.current) fit();
  }, [insets.top, insets.bottom, insets.left, insets.right, fit]);

  const measure = () => {
    containerRef.current?.measureInWindow?.((x, y) => {
      offset.current = { x, y };
    });
  };
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ W: width, H: height });
    measure();
  };

  // --- gestures ---
  const gesture = useRef<
    | { type: 'pan'; last: Pt; start: Pt; moved: number }
    | { type: 'ball' | 'target'; start: Pt; moved: number }
    | { type: 'pinch'; d0: number; s0: number; mid: Pt }
    | null
  >(null);

  const local = (e: GestureResponderEvent): Pt[] => {
    const touches = e.nativeEvent.touches?.length ? e.nativeEvent.touches : [e.nativeEvent];
    return touches.map((t) => [t.pageX - offset.current.x, t.pageY - offset.current.y] as Pt);
  };

  const begin = (pts: Pt[]) => {
    const { view: v, props: p } = live.current;
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = { type: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s0: v.s, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      return;
    }
    const at = pts[0];
    const B = toScreen(p.ball, v, live.current.size.W, live.current.size.H);
    const T = toScreen(p.target, v, live.current.size.W, live.current.size.H);
    const showsTarget = dist(p.target, p.hole.pin) > 3;
    if (Math.hypot(at[0] - B[0], at[1] - B[1]) < 26) gesture.current = { type: 'ball', start: at, moved: 0 };
    else if (showsTarget && Math.hypot(at[0] - T[0], at[1] - T[1]) < 24) gesture.current = { type: 'target', start: at, moved: 0 };
    else gesture.current = { type: 'pan', start: at, last: at, moved: 0 };
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          live.current.props.onTouchStart?.();
          begin(local(e));
        },
        onPanResponderMove: (e) => {
          const pts = local(e);
          const g = gesture.current;
          if (!g) return;
          if (pts.length >= 2 && g.type !== 'pinch') {
            begin(pts);
            return;
          }
          if (g.type === 'pinch') {
            if (pts.length < 2) return;
            const [a, b] = pts;
            const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
            const target = (g.s0 * d) / g.d0;
            zoomAt(g.mid[0], g.mid[1], target / live.current.view.s);
            return;
          }
          const p = pts[0];
          g.moved = Math.max(g.moved, Math.hypot(p[0] - g.start[0], p[1] - g.start[1]));
          if (g.type === 'pan') {
            const dx = p[0] - g.last[0];
            const dy = p[1] - g.last[1];
            g.last = p;
            if (g.moved >= 6) userMoved.current = true;
            setView((v) => ({ ...v, cx: v.cx - dx / v.s, cy: v.cy + dy / v.s }));
          } else if (g.type === 'ball') {
            live.current.props.onBallMove(toWorld(p[0], p[1]));
          } else {
            live.current.props.onTargetMove(toWorld(p[0], p[1]));
          }
        },
        onPanResponderRelease: (e) => {
          const g = gesture.current;
          gesture.current = null;
          if (g && g.type === 'pan' && g.moved < 6) {
            const p = local(e)[0] ?? g.start;
            live.current.props.onTargetMove(toWorld(p[0], p[1]));
          }
        },
        onPanResponderTerminate: () => {
          gesture.current = null;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Mouse-wheel zoom on web.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = node.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // --- overlay (screen units) ---
  const { W, H } = size;
  const pin = hole.pin;
  const B = toScreen(ball);
  const T = toScreen(target);
  const P = toScreen(pin);
  const dG = dist(ball, pin);
  const dT = dist(ball, target);
  const dTP = dist(target, pin);

  const overlay: React.ReactNode[] = [];
  if (W && H) {
    if (showRings) {
      const toPin = Math.atan2(pin[1] - ball[1], pin[0] - ball[0]);
      for (const r of [50, 100, 150, 200, 250]) {
        if (r > dG + 15) continue;
        const R = r * view.s;
        const a0 = toPin - 35 * D2R;
        const a1 = toPin + 35 * D2R;
        const p0 = [B[0] + R * Math.cos(a0), B[1] - R * Math.sin(a0)];
        const p1 = [B[0] + R * Math.cos(a1), B[1] - R * Math.sin(a1)];
        overlay.push(
          <Path key={`ring${r}`} d={`M${f(p0[0])} ${f(p0[1])}A${f(R)} ${f(R)} 0 0 0 ${f(p1[0])} ${f(p1[1])}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" />,
          <SvgText key={`ringh${r}`} x={p1[0] - 3} y={p1[1] + 3.5} textAnchor="end" fontFamily={LABEL_FONT} fontSize={9.5} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={2.5}>
            {r}
          </SvgText>,
          <SvgText key={`ringt${r}`} x={p1[0] - 3} y={p1[1] + 3.5} textAnchor="end" fontFamily={LABEL_FONT} fontSize={9.5} fill="#FFFFFF" fillOpacity={0.9}>
            {r}
          </SvgText>,
        );
      }
    }
    if (dT > 30 && !onGreen(hole, ball)) {
      const ang = Math.atan2(-(target[1] - ball[1]), target[0] - ball[0]) / D2R;
      overlay.push(
        <Ellipse
          key="miss"
          cx={T[0]}
          cy={T[1]}
          rx={lengthSpread(dT) * view.s}
          ry={spread(dT) * view.s}
          transform={`rotate(${f(ang)} ${f(T[0])} ${f(T[1])})`}
          fill="#CDDE5C"
          fillOpacity={0.16}
          stroke="#CDDE5C"
          strokeOpacity={0.9}
          strokeWidth={1.2}
          strokeDasharray="3 3"
        />,
      );
    }
    overlay.push(
      <Line key="shot-shadow" x1={B[0]} y1={B[1]} x2={T[0]} y2={T[1]} stroke="rgba(0,0,0,0.25)" strokeWidth={4} strokeLinecap="round" />,
      <Line key="shot" x1={B[0]} y1={B[1]} x2={T[0]} y2={T[1]} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />,
    );
    if (dTP > 3) {
      overlay.push(<Line key="to-pin" x1={T[0]} y1={T[1]} x2={P[0]} y2={P[1]} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={1.6} strokeDasharray="4 5" strokeLinecap="round" />);
    }

    // Hazard reach / carry labels, kept clear of the markers and each other.
    const taken = [
      [B[0] - 16, B[1] - 16, B[0] + 16, B[1] + 16],
      [T[0] - 14, T[1] - 14, T[0] + 14, T[1] + 14],
      [P[0] - 6, P[1] - 30, P[0] + 18, P[1] + 4],
    ];
    const legs: Array<[number, number, string]> = [];
    if (dT > 12) legs.push([(B[0] + T[0]) / 2, (B[1] + T[1]) / 2, `${Math.round(dT)} m`]);
    if (dTP > 12) legs.push([(T[0] + P[0]) / 2, (T[1] + P[1]) / 2, `${Math.round(dTP)} m`]);
    for (const [x, y, t] of legs) {
      const w = pillW(t, true) / 2;
      taken.push([x - w, y - 11, x + w, y + 11]);
    }
    if (showHazards) {
      for (const { hz, lo, hi } of hazardLabels(hole, ball)) {
        const c = toScreen([hz.x, hz.y]);
        const text = `${Math.round(lo)} / ${Math.round(hi)}`;
        const w = pillW(text, false);
        for (const [ox, oy] of [[0, 0], [w / 2 + 10, 0], [-w / 2 - 10, 0], [0, -20], [0, 20]]) {
          const r = [c[0] + ox - w / 2, c[1] + oy - 9, c[0] + ox + w / 2, c[1] + oy + 9];
          if (taken.some((t) => hit(t, r))) continue;
          taken.push(r);
          overlay.push(<Pill key={`hz${hz.x}-${hz.y}`} x={c[0] + ox} y={c[1] + oy} text={text} big={false} />);
          break;
        }
      }
    }

    overlay.push(
      <G key="flag">
        <Ellipse cx={P[0]} cy={P[1]} rx={3} ry={1.6} fill="#10241A" />
        <Line x1={P[0]} y1={P[1]} x2={P[0]} y2={P[1] - 26} stroke="#1F4234" strokeWidth={2} />
        <Path d={`M${f(P[0])} ${f(P[1] - 26)}l14 4.5-14 4.5z`} fill="#CDDE5C" stroke="#1F4234" strokeWidth={1} />
      </G>,
    );
    legs.forEach(([x, y, t], i) => overlay.push(<Pill key={`leg${i}`} x={x} y={y} text={t} big />));
    if (dTP > 3) {
      overlay.push(
        <G key="target">
          <Circle cx={T[0]} cy={T[1]} r={10} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={4.5} />
          <Circle cx={T[0]} cy={T[1]} r={10} fill="none" stroke="#CDDE5C" strokeWidth={2.5} />
          <Circle cx={T[0]} cy={T[1]} r={2.5} fill="#CDDE5C" />
        </G>,
      );
    }
    overlay.push(
      <G key="ball">
        <Circle cx={B[0]} cy={B[1]} r={13} fill="#FFFFFF" fillOpacity={0.3} />
        <Circle cx={B[0] + 1.2} cy={B[1] + 1.5} r={7.5} fill="rgba(0,0,0,0.28)" />
        <Circle cx={B[0]} cy={B[1]} r={7.5} fill="#FFFFFF" stroke="rgba(0,0,0,0.25)" />
      </G>,
    );
    if (!draggedBall) overlay.push(<Pill key="drag-me" x={B[0] + 50} y={B[1]} text="Drag me" big />);
  }

  const worldTransform = `translate(${f(W / 2)} ${f(H / 2)}) scale(${view.s.toFixed(4)}) translate(${f(-view.cx)} ${f(view.cy)})`;

  return (
    <View
      ref={containerRef}
      style={[styles.container, { backgroundColor: palette.rough }]}
      onLayout={onLayout}
      {...responder.panHandlers}
      accessibilityLabel="Hole map. Drag to move around, tap to aim."
    >
      {W > 0 && H > 0 ? (
        <Svg width={W} height={H} pointerEvents="none">
          <G transform={worldTransform}>
            <HoleArt hole={hole} tees={tees} palette={palette} />
          </G>
          {overlay}
        </Svg>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});
