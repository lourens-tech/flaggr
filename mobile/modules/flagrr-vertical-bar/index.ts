import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type VerticalBarEdge = 'leading' | 'trailing' | 'unspecified';

type EdgeEvent = { edge: VerticalBarEdge };

type FlagrrVerticalBarModule = {
  getEdgeAsync(): Promise<VerticalBarEdge>;
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

