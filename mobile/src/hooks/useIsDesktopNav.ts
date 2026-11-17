import { Platform, useWindowDimensions } from 'react-native';

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

// On the phone layout, wide windows (phones in landscape, small tablets, a
// foldable opened up) put the tab bar in a vertical rail on the left instead
// of along the bottom, where it would stretch across the whole width.
export function useIsSideRail(): boolean {
  const { width } = useWindowDimensions();
  return width >= SIDE_RAIL_MIN_WIDTH;
}
