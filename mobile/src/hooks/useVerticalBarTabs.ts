import { useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';
import { addVerticalBarEdgeListener, getVerticalBarEdgeAsync, type VerticalBarEdge } from '../../modules/flagrr-vertical-bar';

// iPhone Duo (owner decision 24 Nov 2026, "the nav bar should be vertical on the
// right side panel", 25 Nov): where iOS places a vertical bar, the member tabs use
// the system tab bar, which iOS puts in that strip; everywhere else the Bento glass
// bar stays. The edge comes from the native trait (modules/flagrr-vertical-bar).
//
// Once a bar has been seen this stays on for the session, so folding or unfolding
// never swaps the tab navigator (which would reset the open tab). Where the bar is
// not shown, iOS draws the system tab bar along the bottom instead.

let edge: VerticalBarEdge = 'unspecified';
let useSystemTabs = false;
let started = false;
const listeners = new Set<() => void>();

function update(next: VerticalBarEdge) {
  const latch = useSystemTabs || next !== 'unspecified';
  if (next === edge && latch === useSystemTabs) return;
  edge = next;
  useSystemTabs = latch;
  listeners.forEach((l) => l());
}

function refresh() {
  void getVerticalBarEdgeAsync().then(update);
}

/** Starts reading the edge; called at app start so the answer is ready before the tabs first render. */
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

/** True when the member tabs should be the system tab bar (a device that shows the vertical bar). */
export function useSystemTabBar(): boolean {
  return useSyncExternalStore(subscribe, () => useSystemTabs, () => false);
}
