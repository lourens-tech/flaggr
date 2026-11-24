import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { ViewInstance } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { CountUpText } from '../motion/CountUpText';
import { BENTO_RISE_STEP, E2E_INSTANT_MOTION, bentoDuration, bentoEasing, prefersReducedMotion, STAGGER_MAX_ITEMS, useNativeDriver } from '../../theme/motion';

// Bento motion helpers. Everything runs on React Native's Animated API with
// the native driver for transforms and opacity, so it moves off the JS thread
// on iOS and Android and still ships as an over-the-air update (no
// reanimated). Reduce Motion turns every one of these into a plain render.

// ── Scroll context ──────────────────────────────────────────────────────────
// BentoScreen provides its scroll position, viewport height and content
// container so tiles further down can reveal as they scroll into view.

interface ScrollCtx {
  scrollY: Animated.Value;
  // The same position as a plain number, kept current by BentoScreen.
  scrollTop: { current: number };
  // Kept current by BentoScreen; starts at the window height so tiles that
  // lay out before the scroll view has measured itself still know the fold.
  viewport: { current: number };
  content: React.RefObject<ViewInstance | null>;
  // Hands each Appear that is on screen at first paint its place in the
  // opening cascade.
  nextOrder: () => number;
}

export const BentoScrollContext = createContext<ScrollCtx | null>(null);

export function useBentoScroll() {
  return useContext(BentoScrollContext);
}

// ── Appear: rise on open, reveal on scroll ──────────────────────────────────
// Wrap a tile in <Appear>. Tiles visible when the screen opens rise in 50 ms
// apart (from 22 pt down, scale 0.98); tiles below the fold wait and reveal
// as they enter (from 46 pt down, scale 0.96). Never wrap an ad: ads don't
// animate.

type Phase = 'measuring' | 'waiting' | 'done';

export function Appear({
  children,
  style,
  order,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // Fixed cascade slot; by default slots are handed out in mount order.
  order?: number;
}) {
  const scroll = useBentoScroll();
  // Reduce Motion, and the click-through test build (E2E_INSTANT_MOTION), show tiles in place.
  const [reduced] = useState(() => prefersReducedMotion() || E2E_INSTANT_MOTION);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const ref = useRef<ViewInstance>(null);
  const [phase, setPhase] = useState<Phase>(reduced ? 'done' : 'measuring');
  const [kind, setKind] = useState<'rise' | 'reveal'>('rise');

  const play = (k: 'rise' | 'reveal', slot: number) => {
    setKind(k);
    Animated.timing(progress, {
      toValue: 1,
      duration: k === 'rise' ? bentoDuration.rise : bentoDuration.reveal,
      delay: k === 'rise' ? Math.min(slot, STAGGER_MAX_ITEMS) * BENTO_RISE_STEP : 0,
      easing: bentoEasing.move,
      useNativeDriver,
    }).start();
    setPhase('done');
  };

  // Outside a BentoScreen there is no scroll to watch: just rise.
  useEffect(() => {
    if (reduced || scroll) return;
    play('rise', order ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = (_e: LayoutChangeEvent) => {
    if (phase !== 'measuring' || !scroll) return;
    const node = ref.current;
    const content = scroll.content.current;
    if (!node || !content) {
      play('rise', order ?? scroll.nextOrder());
      return;
    }
    node.measureLayout(
      content,
      (_x, y) => {
        const top = scroll.scrollTop.current;
        if (y < top + scroll.viewport.current) {
          play('rise', order ?? scroll.nextOrder());
          return;
        }
        setPhase('waiting');
        const id = scroll.scrollY.addListener(({ value }) => {
          if (y < value + scroll.viewport.current - 24) {
            scroll.scrollY.removeListener(id);
            play('reveal', 0);
          }
        });
      },
      () => play('rise', order ?? scroll.nextOrder()),
    );
  };

  if (reduced) {
    return <View style={style}>{children}</View>;
  }

  const from = kind === 'rise' ? { y: 22, s: 0.98 } : { y: 46, s: 0.96 };
  return (
    <Animated.View
      ref={ref}
      onLayout={onLayout}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [from.s, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ── Parallax ────────────────────────────────────────────────────────────────
// For photos inside tiles: the image drifts a few points against the scroll.
// The parent must clip (overflow: hidden) and the image should be a little
// taller than its frame (see `travel`).
export function Parallax({ children, style, travel = 14 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; travel?: number }) {
  const scroll = useBentoScroll();
  const [y, setY] = useState<number | null>(null);
  const ref = useRef<ViewInstance>(null);
  const reduced = prefersReducedMotion();

  if (!scroll || reduced) return <View style={style}>{children}</View>;

  const translateY =
    y === null
      ? 0
      : scroll.scrollY.interpolate({
          inputRange: [y - scroll.viewport.current, y + scroll.viewport.current],
          outputRange: [-travel, travel],
          extrapolate: 'clamp',
        });

  return (
    <Animated.View
      ref={ref}
      onLayout={() => {
        const content = scroll.content.current;
        if (content && ref.current) ref.current.measureLayout(content, (_x, top) => setY(top), () => {});
      }}
      style={[style, { transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

// ── Count-up ────────────────────────────────────────────────────────────────
// Big numbers count up over ~1.15 s every time the screen comes into focus
// (not only the first time). With Reduce Motion they show their final value.
export function CountUp({ value, style, accessibilityLabel }: { value: number | string; style?: StyleProp<TextStyle>; accessibilityLabel?: string }) {
  const navigation = useContext(NavigationContext);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!navigation) return;
    let first = true;
    return navigation.addListener('focus', () => {
      // The first focus is the mount itself, which already counts up.
      if (first) {
        first = false;
        return;
      }
      setRound((r) => r + 1);
    });
  }, [navigation]);
  return <CountUpText key={round} value={value} style={style} duration={bentoDuration.count} accessibilityLabel={accessibilityLabel} allowDecimals />;
}

// ── Fill bar ────────────────────────────────────────────────────────────────
// Progress bar that fills from the left when it mounts.
export function FillBar({
  progress,
  color,
  track,
  height = 8,
  style,
  accessibilityLabel,
}: {
  progress: number;
  color: string;
  track: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const reduced = prefersReducedMotion();
  const anim = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const a = Animated.timing(anim, { toValue: 1, duration: bentoDuration.fill, delay: 300, easing: bentoEasing.move, useNativeDriver });
    a.start();
    return () => a.stop();
  }, [anim, reduced]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }, style]}
    >
      <Animated.View
        style={{
          width: `${p * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
          transformOrigin: 'left',
          transform: [{ scaleX: anim }],
        }}
      />
    </View>
  );
}

// ── Ring ────────────────────────────────────────────────────────────────────
// Progress ring that draws itself (tier progress on Home). The stroke offset
// is an SVG prop, so this one runs on the JS thread; it's a single short
// animation per screen.
export function Ring({
  progress,
  size = 92,
  stroke = 8,
  color,
  track,
  children,
  accessibilityLabel,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const reduced = prefersReducedMotion();
  const [drawn, setDrawn] = useState(reduced ? p : 0);
  const anim = useRef(new Animated.Value(reduced ? p : 0)).current;
  useEffect(() => {
    if (reduced) {
      setDrawn(p);
      return;
    }
    // An SVG stroke offset can't use the native driver; a listener feeds it.
    const id = anim.addListener(({ value }) => setDrawn(value));
    const a = Animated.timing(anim, { toValue: p, duration: 1600, delay: 300, easing: bentoEasing.move, useNativeDriver: false });
    a.start();
    return () => {
      a.stop();
      anim.removeListener(id);
    };
  }, [anim, p, reduced]);
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {drawn > 0.001 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - drawn)}
          />
        ) : null}
      </Svg>
      {children ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View> : null}
    </View>
  );
}
