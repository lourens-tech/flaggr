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

// The click-through test build (npm run e2e:build) sets EXPO_PUBLIC_E2E=1. There, screen
// pushes, tab switches and tile entrances (Appear) happen at once, so a test never clicks
// something that is still sliding into place. Never set for real web or phone builds; the
// motion itself is checked separately against the prototype.
export const E2E_INSTANT_MOTION = process.env.EXPO_PUBLIC_E2E === '1';

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

// ── Bento redesign ──────────────────────────────────────────────────────────
// The two curves from the redesign brief. `move` is for anything travelling
// (push, rise, reveal); `overshoot` settles slightly past its target and back
// (tab highlight, sheets, charts, toasts).
export const bentoEasing = {
  move: Easing.bezier(0.32, 0.72, 0, 1),
  overshoot: Easing.bezier(0.34, 1.36, 0.64, 1),
  // The sheet's softer overshoot from the prototype.
  sheet: Easing.bezier(0.34, 1.2, 0.64, 1),
} as const;

export const bentoDuration = {
  press: 500,
  tab: 420,
  rise: 560,
  reveal: 700,
  count: 1150,
  sheet: 600,
  alert: 450,
  fill: 1400,
  toast: 3000,
} as const;

// First tiles on a screen rise in this far apart.
export const BENTO_RISE_STEP = 50;
