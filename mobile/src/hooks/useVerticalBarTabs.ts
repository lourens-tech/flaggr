import { useSyncExternalStore } from 'react';
import { Dimensions, I18nManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addVerticalBarEdgeListener, getVerticalBarEdgeAsync, type VerticalBarEdge } from '../../modules/flagrr-vertical-bar';

// iPhone Duo: iOS keeps a vertical strip down one edge of the screen (camera, clock,
// status icons). Where it reports one (UITraitCollection.verticalBarEdge, read by
// modules/flagrr-vertical-bar), the member tab bar is drawn vertically in that strip
// (owner request 25 Nov 2026: "the nav bar should be vertical on the right side
// panel"; owner decision the same day: our own Bento bar, not the iOS system tab bar,
// which flickered between horizontal and vertical on a real Duo).
//
// Once an edge has been reported it is kept for the session (the last one seen), so a
// fold or unfold never flips the bar back to the bottom. The bar still needs the strip's
// safe-area inset to be there (see useVerticalTabBar in MemberTabBar).

let edge: Exclude<VerticalBarEdge, 'unspecified'> | null = null;
let started = false;
const listeners = new Set<() => void>();

function update(next: VerticalBarEdge) {
  if (next === 'unspecified' || next === edge) return;
  edge = next;
  listeners.forEach((l) => l());
}

function refresh() {
  void getVerticalBarEdgeAsync().then(update);
}

/** Starts reading the edge; called on first use so the answer is ready before the tabs first render. */
export function startVerticalBarWatch() {
  if (started) return;
  started = true;
  refresh();
  addVerticalBarEdgeListener(update);
  // A posture change resizes the window; read the edge again then too.
  Dimensions.addEventListener('change', refresh);
}

function subscribe(listener: () => void) {
  startVerticalBarWatch();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The edge of the vertical strip ('leading' / 'trailing'), or null where iOS has never reported one. */
export function useVerticalBarEdge(): 'leading' | 'trailing' | null {
  return useSyncExternalStore(subscribe, () => edge, () => null);
}

/**
 * Where to draw the member tab bar vertically: the physical side of the strip and its
 * width (the strip's safe-area inset), or null to keep the bar along the bottom.
 * verticalBarEdge follows layout direction; safe-area insets are physical, so the
 * edge is mapped through the layout direction (app-resizability skill, safe-area task).
 */
export function useVerticalTabBar(): { side: 'left' | 'right'; width: number } | null {
  const edge = useVerticalBarEdge();
  const insets = useSafeAreaInsets();
  if (!edge) return null;
  const side: 'left' | 'right' = (edge === 'trailing') !== I18nManager.isRTL ? 'right' : 'left';
  const width = side === 'right' ? insets.right : insets.left;
  return width > 0 ? { side, width } : null;
}
