import React, { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { duration, easing, nextStaggerDelay, prefersReducedMotion, useNativeDriver } from '../../theme/motion';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // Distance (pt) the content rises while fading in. 0 = fade only.
  distance?: number;
  // Fixed delay in ms. When omitted, the delay comes from the shared stagger
  // wave (see nextStaggerDelay), so siblings that mount together cascade.
  delay?: number;
  duration?: number;
  // Skip the animation (e.g. rows far down a long table).
  disabled?: boolean;
}

// Entrance for cards, panels and rows: rises a few points while fading in,
// once, on mount. Re-renders don't replay it.
export function FadeIn({ children, style, distance = 12, delay, duration: ms = duration.medium, disabled }: Props) {
  const [skip] = useState(() => disabled || prefersReducedMotion());
  const [startDelay] = useState(() => (delay ?? (skip ? 0 : nextStaggerDelay())));
  const progress = useRef(new Animated.Value(skip ? 1 : 0)).current;

  useEffect(() => {
    if (skip) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: ms,
      delay: startDelay,
      easing: easing.out,
      useNativeDriver,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, skip, ms, startDelay]);

  if (skip) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
