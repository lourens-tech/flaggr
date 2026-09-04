import { useMemo, useState } from 'react';

// react-native-web forwards unknown camelCase style keys straight through as
// CSS, so this gives hover/press state changes a smooth transition instead
// of snapping — spread onto a style array alongside the hover-conditional
// styles, e.g. `style={[styles.card, hoverTransition, hovered && styles.cardHover]}`.
export const hoverTransition = {
  transitionProperty: 'background-color, border-color, box-shadow, transform, opacity',
  transitionDuration: '150ms',
  transitionTimingFunction: 'ease-out',
} as unknown as { opacity: number };

// Mouse hover only exists on web — these handlers are simply never invoked
// on native, so it's safe to spread them onto any RN component's props.
// Used by the desktop-web admin/super-admin chrome to give static
// TouchableOpacity cards, rows and buttons a live, "this responds to me"
// feel that a touch-only UI doesn't need.
export function useHover() {
  const [hovered, setHovered] = useState(false);
  const handlers = useMemo(
    () => ({
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    }),
    [],
  );
  return [hovered, handlers] as const;
}
