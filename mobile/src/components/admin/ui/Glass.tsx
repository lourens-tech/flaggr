import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAdminTheme } from '../../../context/ThemeContext';

interface Props extends ViewProps {
  style?: StyleProp<ViewStyle>;
  // Corner radius; also clips the blur (BlurView ignores borderRadius).
  radius?: number;
  // Draw the hairline edge. Off for chrome that sits flush against a window edge.
  bordered?: boolean;
  children?: React.ReactNode;
}

// react-native-web passes unknown style keys straight through as CSS.
const webGlass = (fill: string, edge: string, hi: string) =>
  ({
    backgroundColor: fill,
    backdropFilter: 'blur(30px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
    boxShadow: `inset 0 1px 0 ${hi}, inset 0 0 0 1px ${edge}`,
  }) as unknown as ViewStyle;

// Frosted navigation surface — sidebar, rail, toolbars, tab bar, sheets,
// menus. Never for content: tiles and tables stay opaque (see Tile).
// With Reduce Transparency on, it becomes a solid fill.
export function Glass({ style, radius = 0, bordered = true, children, ...rest }: Props) {
  const { c, scheme, reduceTransparency } = useAdminTheme();

  if (reduceTransparency) {
    return (
      <View
        {...rest}
        style={[{ backgroundColor: c.glassSolid, borderRadius: radius }, bordered && { borderWidth: StyleSheet.hairlineWidth, borderColor: c.edge }, style]}
      >
        {children}
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View {...rest} style={[webGlass(c.glass, bordered ? c.edge : 'transparent', c.hi), { borderRadius: radius }, style]}>
        {children}
      </View>
    );
  }

  // Android's blur needs a BlurTargetView behind every screen; without it
  // BlurView falls back to a flat tint, so a near-opaque fill reads better.
  if (Platform.OS === 'android') {
    return (
      <View
        {...rest}
        style={[{ backgroundColor: c.glassSolid, borderRadius: radius, opacity: 0.97 }, bordered && { borderWidth: StyleSheet.hairlineWidth, borderColor: c.edge }, style]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      {...rest}
      style={[{ borderRadius: radius, overflow: 'hidden' }, bordered && { borderWidth: StyleSheet.hairlineWidth, borderColor: c.edge }, style]}
    >
      <BlurView
        intensity={60}
        tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glass, opacity: 0.6 }]} pointerEvents="none" />
      {children}
    </View>
  );
}
