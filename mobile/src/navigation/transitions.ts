import { Animated, Dimensions, Easing } from 'react-native';
import type { StackCardInterpolationProps, StackCardStyleInterpolator, StackNavigationOptions } from '@react-navigation/stack';

type TransitionSpec = NonNullable<StackNavigationOptions['transitionSpec']>['open'];
import { E2E_INSTANT_MOTION, prefersReducedMotion } from '../theme/motion';

// Screen transitions from the Bento prototype (ProtoLight on the design canvas):
//
//   push     the new screen slides in from the right over 0.56 s; the old one
//            slides 28% to the left and dims to 82% brightness. Pop is the
//            reverse over 0.52 s.
//   modal    the scan flow rises from the bottom over 0.62 s, its corners
//            going from 48 to square; the screen behind shrinks to 92%, dims
//            to 60% and rounds its corners to 40. Closing drops it over 0.5 s
//            while the screen behind returns over 0.55 s.
//   fade     signing in or out: a cross-fade over 0.5 s, the incoming screen
//            settling from 98.5% and 6 pt down (the same move as a tab switch).
//
// All on the curve cubic-bezier(.32,.72,0,1). Reduce Motion swaps every one
// for a 200 ms cross-fade. The covered screen takes the covering screen's
// interpolator (React Navigation's JS stack), so each preset styles both.

const e = Easing.bezier(0.32, 0.72, 0, 1);

// In the click-through test build screens switch at once (E2E_INSTANT_MOTION, theme/motion.ts).
const animation = E2E_INSTANT_MOTION ? ('none' as const) : ('default' as const);
const timing = (duration: number): TransitionSpec => ({ animation: 'timing', config: { duration, easing: e } });

const PUSH_DIM = 1 - 0.82; // brightness .82
const UNDER_DIM = 1 - 0.6; // brightness .6

const clamp = 'clamp' as const;

function reducedFade({ current, next }: StackCardInterpolationProps) {
  const fadeIn = current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: clamp });
  const fadeOut = next ? next.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: clamp }) : 1;
  return { cardStyle: { opacity: next ? Animated.multiply(fadeIn, fadeOut) : fadeIn } };
}

export const forBentoPush: StackCardStyleInterpolator = (props) => {
  if (prefersReducedMotion()) return reducedFade(props);
  const { current, next, layouts, inverted } = props;
  const w = layouts.screen.width;
  // Own entrance: from the right edge (follows the finger during swipe-back).
  const enter = Animated.multiply(
    current.progress.interpolate({ inputRange: [0, 1], outputRange: [w, 0], extrapolate: clamp }),
    inverted,
  );
  // Covered by the next screen: 28% to the left.
  const cover = next
    ? Animated.multiply(next.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -w * 0.28], extrapolate: clamp }), inverted)
    : 0;
  return {
    cardStyle: { transform: [{ translateX: next ? Animated.add(enter, cover) : enter }] },
    // The overlay sits behind this card and over the one below: the dim.
    overlayStyle: { opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, PUSH_DIM], extrapolate: clamp }) },
    // The prototype's push shadow (box-shadow: -20px 0 40px rgba(0,0,0,.18)), drawn on the stack's
    // edge strip in place of its default shadow.
    shadowStyle: { shadowOpacity: 0, elevation: 0, boxShadow: '-20px 0 40px rgba(0,0,0,0.18)' },
  };
};

export const forBentoModal: StackCardStyleInterpolator = (props) => {
  if (prefersReducedMotion()) return reducedFade(props);
  const { current, next, layouts } = props;
  const h = layouts.screen.height;
  if (next) {
    // This card is behind the rising flow (the screen under the modal).
    const p = next.progress;
    return {
      containerStyle: { overflow: 'hidden' },
      cardStyle: {
        overflow: 'hidden',
        borderRadius: p.interpolate({ inputRange: [0, 1], outputRange: [0, 40], extrapolate: clamp }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92], extrapolate: clamp }) }],
      },
    };
  }
  return {
    cardStyle: {
      overflow: 'hidden',
      borderRadius: current.progress.interpolate({ inputRange: [0, 1], outputRange: [48, 0], extrapolate: clamp }),
      transform: [{ translateY: current.progress.interpolate({ inputRange: [0, 1], outputRange: [h, 0], extrapolate: clamp }) }],
    },
    overlayStyle: { opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, UNDER_DIM], extrapolate: clamp }) },
  };
};

export const forBentoFade: StackCardStyleInterpolator = (props) => {
  if (prefersReducedMotion()) return reducedFade(props);
  const { current, next } = props;
  const enter = current.progress;
  const opacityIn = enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: clamp });
  const opacity = next
    ? Animated.multiply(opacityIn, next.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: clamp }))
    : opacityIn;
  return {
    cardStyle: {
      opacity,
      transform: [
        { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1], extrapolate: clamp }) },
        { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [6, 0], extrapolate: clamp }) },
      ],
    },
  };
};

const reduced = (spec: TransitionSpec): TransitionSpec =>
  prefersReducedMotion() ? { animation: 'timing', config: { duration: 200, easing: Easing.out(Easing.quad) } } : spec;

// Options for each kind of screen. `transitionSpec` is read when a transition
// starts, so Reduce Motion is checked each time through these getters.
export function pushOptions(): StackNavigationOptions {
  return {
    animation, // the JS stack skips animations on web unless asked; members use the web app too
    cardStyleInterpolator: forBentoPush,
    transitionSpec: { open: reduced(timing(560)), close: reduced(timing(520)) },
    gestureDirection: 'horizontal',
    // Swipe back from anywhere on the screen, as the app always allowed (iOS).
    gestureResponseDistance: Dimensions.get('window').width,
    cardOverlayEnabled: true,
    cardShadowEnabled: true,
  };
}

export function modalOptions(): StackNavigationOptions {
  return {
    animation, // the JS stack skips animations on web unless asked; members use the web app too
    cardStyleInterpolator: forBentoModal,
    transitionSpec: { open: reduced(timing(620)), close: reduced(timing(500)) },
    gestureDirection: 'vertical',
    cardOverlayEnabled: true,
    cardShadowEnabled: false,
  };
}

export function fadeOptions(): StackNavigationOptions {
  return {
    animation, // the JS stack skips animations on web unless asked; members use the web app too
    cardStyleInterpolator: forBentoFade,
    transitionSpec: { open: reduced(timing(500)), close: reduced(timing(500)) },
    gestureEnabled: false,
    cardOverlayEnabled: false,
    cardShadowEnabled: false,
  };
}
