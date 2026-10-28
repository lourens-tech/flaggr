import React, { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { prefersReducedMotion, spring, useNativeDriver } from '../../theme/motion';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  from?: number;
}

// Springs from small to full size with a slight overshoot — for success
// moments (a redeemed voucher's QR code, a scanned receipt's tick).
export function PopIn({ children, style, delay = 0, from = 0.6 }: Props) {
  const [skip] = useState(() => prefersReducedMotion());
  const progress = useRef(new Animated.Value(skip ? 1 : 0)).current;

  useEffect(() => {
    if (skip) return;
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(progress, { toValue: 1, ...spring.snappy, useNativeDriver }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [progress, skip, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
