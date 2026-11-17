import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The unfolded iPhone Duo is 890 x 626 pt in landscape: wide enough for the
// desktop shell's icon rail. The height floor keeps phones in landscape
// (~390 pt tall) on the phone layout, where a sidebar wouldn't fit.
const DESKTOP_MIN_WIDTH = 840;
const DESKTOP_MIN_HEIGHT = 560;
const SIDE_RAIL_MIN_WIDTH = 600;

// Course-admin/super-admin tools are used almost exclusively at a desk — a
// side panel reads better there than a bottom tab bar. Native apps and
// narrow/mobile browser windows keep the phone layout.
export function useIsDesktopNav(): boolean {
  const { width, height } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH && height >= DESKTOP_MIN_HEIGHT;
}

// On the phone layout, where the tab bar goes when it isn't along the bottom.
// - 'right': an upright screen with its status strip down the right edge
//   instead of along the top (the iPhone Duo folded, on its outer screen), so
//   the menu sits beside the strip as a vertical rail. A notched phone in
//   landscape reports equal left and right insets, so it doesn't count, and
//   the Duo opened up (landscape) keeps the rail on the left.
// - 'left': wide windows (phones in landscape, small tablets) put the menu in
//   a vertical rail on the left instead of stretching a bar across the width.
// - null: the usual bottom tab bar.
export type SideRail = 'left' | 'right' | null;
const SIDE_STRIP_MIN_INSET = 16;

export function useSideRail(): SideRail {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (height > width && insets.right - insets.left >= SIDE_STRIP_MIN_INSET) return 'right';
  return width >= SIDE_RAIL_MIN_WIDTH ? 'left' : null;
}
