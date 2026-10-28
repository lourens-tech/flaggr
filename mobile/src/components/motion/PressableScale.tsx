import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { prefersReducedMotion, spring, useNativeDriver } from '../../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  // Scale while the finger is down. Apple's buttons and cards give ~3%.
  pressedScale?: number;
  // Scale while a mouse hovers (web only; ignored on touch).
  hoverScale?: number;
  children?: React.ReactNode;
};

// Drop-in for TouchableOpacity on cards and buttons: instead of dimming, the
// element gives slightly under the finger and springs back on release.
// The scale transform is applied last, so callers shouldn't pass their own
// `transform` in `style`.
export function PressableScale({
  style,
  pressedScale = 0.97,
  hoverScale = 1,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  disabled,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const hovered = useRef(false);

  const to = useCallback(
    (value: number, config: { stiffness: number; damping: number; mass: number }) => {
      if (prefersReducedMotion()) {
        scale.setValue(1);
        return;
      }
      Animated.spring(scale, { toValue: value, ...config, useNativeDriver }).start();
    },
    [scale],
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        to(pressedScale, spring.press);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        to(hovered.current ? hoverScale : 1, spring.snappy);
        onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        hovered.current = true;
        if (!disabled && hoverScale !== 1) to(hoverScale, spring.snappy);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        hovered.current = false;
        if (hoverScale !== 1) to(1, spring.snappy);
        onHoverOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
