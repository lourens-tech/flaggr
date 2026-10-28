import { AccessibilityInfo, Easing, Platform } from 'react-native';

// One place for every duration, curve and spring in the app, so the member
// app and both admin dashboards move the same way. Everything here runs on
// React Native's built-in Animated API and native modules the store binary
// already ships — no reanimated/haptics — so motion changes go out as an
// over-the-air update (see docs/Environment-and-Setup.md).

export const duration = {
  micro: 160, // press-in, hover, toggles
  short: 260, // route/content crossfades, icon pops
  medium: 420, // entrances, tab/sidebar indicators
  long: 560, // sheets, large reveals
  count: 900, // number roll-ups
} as const;

export const easing = {
  // Fast start, long gentle settle — the default for anything entering.
  out: Easing.bezier(0.22, 1, 0.36, 1),
  // The iOS sheet/push curve.
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

export const spring = {
  // Slight overshoot — indicators, press release, pops.
  snappy: { stiffness: 260, damping: 22, mass: 1 },
  // No visible overshoot — cards, sheets.
  gentle: { stiffness: 170, damping: 26, mass: 1 },
  // Press-in: quick and firm.
  press: { stiffness: 420, damping: 32, mass: 1 },
} as const;

// Stagger between siblings that appear together, capped so a long list
// never makes the last item wait noticeably.
export const STAGGER_STEP = 40;
export const STAGGER_MAX_ITEMS = 8;

// The native driver isn't available on web (react-native-web animates on the
// JS thread either way and warns if asked for it).
export const useNativeDriver = Platform.OS !== 'web';

// "Reduce Motion" (iOS/Android accessibility setting, or the browser's
// prefers-reduced-motion). Read synchronously at animation time via
// prefersReducedMotion(); kept current by a listener started once on import.
let reducedMotion = false;

if (Platform.OS === 'web') {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mq.matches;
    mq.addEventListener?.('change', (e) => {
      reducedMotion = e.matches;
    });
  }
} else {
  AccessibilityInfo.isReduceMotionEnabled()
    .then((v) => {
      reducedMotion = v;
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
    reducedMotion = v;
  });
}

export function prefersReducedMotion() {
  return reducedMotion;
}

// Hands out entrance delays so things that mount together cascade in order
// (top to bottom, since React renders parents before children and siblings
// in order), while anything mounting later — e.g. a list that arrives after
// a fetch — starts a fresh wave instead of waiting behind the first one.
let waveStartedAt = 0;
let waveCount = 0;
const WAVE_GAP_MS = 120;

export function nextStaggerDelay() {
  const now = Date.now();
  if (now - waveStartedAt > WAVE_GAP_MS) {
    waveStartedAt = now;
    waveCount = 0;
  }
  const delay = Math.min(waveCount, STAGGER_MAX_ITEMS) * STAGGER_STEP;
  waveCount += 1;
  return delay;
}
