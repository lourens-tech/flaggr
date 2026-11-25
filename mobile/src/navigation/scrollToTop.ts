// Tapping the tab you are already on scrolls that tab back to the top (as in
// the Bento prototype). Each BentoScreen registers its scroll view here under
// its navigation route key; the tab bar calls the one for the current tab.
const registry = new Map<string, () => void>();

export function registerScrollToTop(routeKey: string, fn: () => void) {
  registry.set(routeKey, fn);
  return () => {
    if (registry.get(routeKey) === fn) registry.delete(routeKey);
  };
}

export function scrollRouteToTop(routeKey: string | undefined) {
  if (routeKey) registry.get(routeKey)?.();
}
