import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type VerticalBarEdge = 'leading' | 'trailing' | 'unspecified';

type EdgeEvent = { edge: VerticalBarEdge };

type FlagrrVerticalBarModule = {
  getEdgeAsync(): Promise<VerticalBarEdge>;
  refreshAsync(): Promise<void>;
  addListener(event: 'onChange', listener: (e: EdgeEvent) => void): { remove(): void };
};

// iOS only; null on Android, web, and builds made before this module existed.
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<FlagrrVerticalBarModule>('FlagrrVerticalBar') : null;

/** Where iOS places the vertical bar (the iPhone Duo strip), or "unspecified" where there is none. */
export async function getVerticalBarEdgeAsync(): Promise<VerticalBarEdge> {
  if (!native) return 'unspecified';
  try {
    return await native.getEdgeAsync();
  } catch {
    return 'unspecified';
  }
}

/** Calls back when the edge may have changed. Returns an unsubscribe function. */
export function addVerticalBarEdgeListener(listener: (edge: VerticalBarEdge) => void): () => void {
  if (!native) return () => {};
  const sub = native.addListener('onChange', (e) => listener(e.edge));
  return () => sub.remove();
}

/** Asks iOS to rebuild the vertical bar's contents (after the system tab bar mounts). */
export async function refreshVerticalBarAsync(): Promise<void> {
  if (!native) return;
  try {
    await native.refreshAsync();
  } catch {
    // Nothing to do: the strip refreshes on the next posture change anyway.
  }
}
