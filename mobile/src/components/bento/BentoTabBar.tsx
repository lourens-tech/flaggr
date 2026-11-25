import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoLayout as L, bentoType } from '../../theme/bento';
import { E2E_INSTANT_MOTION, bentoDuration, bentoEasing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { PressableScale } from '../motion/PressableScale';
import { BentoIcon, type BentoIconName } from './BentoIcon';
import { Glass } from './primitives';
import { useVerticalTabBar } from '../../hooks/useVerticalBarTabs';

// Floating glass tab bar with the raised Scan button in the middle.
//
// Works with any number of tabs: the redesign's 4 (Home, Course | Scan |
// Rewards, Profile) or the live app's 6 (Home, Course, My Golf | Scan |
// Rewards, Activity, Profile). Scan always sits at the centre; tabs shrink
// from 62 pt to share the width when there are more of them.

const ICONS: Record<string, BentoIconName> = {
  Home: 'home',
  Course: 'course',
  MyGolf: 'myGolf',
  Rewards: 'rewards',
  Activity: 'activity',
  Profile: 'profile',
};

const LABELS: Record<string, string> = { MyGolf: 'My Golf' };

export interface BentoTab {
  key: string;
  name: string;
}

// Presentational bar, driven by navigation/MemberTabBar.tsx (and by the dev gallery).
export function BentoTabBarView({
  tabs,
  activeIndex,
  onTabPress,
  onScanPress,
  hidden = false,
}: {
  tabs: BentoTab[];
  activeIndex: number;
  onTabPress: (tab: BentoTab, index: number) => void;
  onScanPress: () => void;
  // Pushed screens hide the bar: it slides down out of view (0.6 s) and fades (0.4 s).
  hidden?: boolean;
}) {
  const { t } = useBento();
  const { width: windowWidth } = useWindowDimensions();
  // Keep clear of side safe areas (the iPhone Duo's camera strip when closed).
  const insets = useSafeAreaInsets();
  // iPhone Duo: drawn vertically in the strip iOS keeps down one edge (owner decision 25 Nov 2026).
  const vertical = useVerticalTabBar();
  const width = windowWidth - insets.left - insets.right;
  const scanAt = Math.floor(tabs.length / 2);
  const slots = tabs.length + 1;
  const inner = Math.min(width, 560) - L.tabBarSide * 2 - 12;
  const slotW = Math.min(L.tabWidth, Math.floor(inner / slots));

  // Indicator: slides between tabs with a slight overshoot.
  const [xs, setXs] = useState<Record<number, number>>({});
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const targetX = xs[activeIndex];
  useEffect(() => {
    if (targetX === undefined) return;
    if (!placed.current || prefersReducedMotion()) {
      placed.current = true;
      x.setValue(targetX);
      return;
    }
    const a = Animated.timing(x, { toValue: targetX, duration: 600, easing: bentoEasing.overshoot, useNativeDriver });
    a.start();
    return () => a.stop();
  }, [targetX, x]);

  const hide = useRef(new Animated.Value(hidden ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(hidden ? 0 : 1)).current;
  // Once it has slid away it leaves the layout too (no focus, no screen reader, not findable).
  const [gone, setGone] = useState(hidden);
  useEffect(() => {
    if (!hidden) setGone(false);
    if (prefersReducedMotion()) {
      hide.setValue(hidden ? 1 : 0);
      fade.setValue(hidden ? 0 : 1);
      if (hidden) setGone(true);
      return;
    }
    // As the prototype's .tb: transform over 0.6 s on the move curve, opacity over 0.4 s on CSS "ease".
    const a = Animated.parallel([
      Animated.timing(hide, { toValue: hidden ? 1 : 0, duration: 600, easing: bentoEasing.move, useNativeDriver }),
      Animated.timing(fade, { toValue: hidden ? 0 : 1, duration: 400, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver }),
    ]);
    a.start(({ finished }) => {
      if (finished && hidden) setGone(true);
    });
    return () => a.stop();
  }, [hidden, hide, fade]);
  const barTravel = L.tabBarHeight * 1.4; // .tb.hide{transform:translateY(140%)}: 140% of the bar's own height

  // The indicator slides along the bar: x positions when horizontal, y when vertical.
  const onSlotLayout = (i: number) => (e: LayoutChangeEvent) => {
    const lx = vertical ? e.nativeEvent.layout.y : e.nativeEvent.layout.x;
    setXs((m) => (m[i] === lx ? m : { ...m, [i]: lx }));
  };

  const renderTab = (tab: BentoTab, i: number, w: number = slotW) => {
    const on = i === activeIndex;
    const label = LABELS[tab.name] ?? tab.name;
    return (
      <Pressable
        key={tab.key}
        onLayout={onSlotLayout(i)}
        onPress={() => onTabPress(tab, i)}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        aria-selected={on}
        style={{ width: w, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 4 }}
      >
        <BentoIcon name={ICONS[tab.name] ?? 'home'} size={23} color={on ? t.accent : t.tabOff} strokeWidth={on ? 2 : 1.6} />
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[on ? bentoType.tabOn : bentoType.tabOff, { color: on ? t.accent : t.tabOff }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const scanButton = (w: number, lift: boolean) => (
    <PressableScale
      key="__scan"
      onPress={onScanPress}
      pressedScale={0.9}
      accessibilityRole="button"
      accessibilityLabel="Scan receipt"
      style={{ width: w, alignItems: 'center', gap: 4 }}
    >
      <View
        style={{
          width: L.scanSize,
          height: L.scanSize,
          marginTop: lift ? -L.scanLift : 0,
          borderRadius: L.scanRadius,
          backgroundColor: bentoBrand.fairway,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 20px -8px rgba(31,66,52,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        <BentoIcon name="scan" size={24} color={bentoBrand.lime} strokeWidth={2} />
      </View>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[bentoType.tabOn, { color: t.ink }]}>
        Scan
      </Text>
    </PressableScale>
  );

  if (vertical) {
    // In the iPhone Duo's strip (Duo boards): Scan as the round button above a glass column
    // of the four tabs, at the bottom of the strip, below iOS's camera, clock and status icons.
    // Pushed screens slide it out sideways, off the edge it sits on.
    const pillW = Math.min(vertical.width - 8, 68);
    const travel = (vertical.width + 24) * (vertical.side === 'right' ? 1 : -1);
    return (
      <Animated.View
        pointerEvents={hidden ? 'none' : 'box-none'}
        aria-hidden={hidden}
        style={{
          position: 'absolute',
          [vertical.side]: 0,
          width: vertical.width,
          bottom: insets.bottom + 16,
          alignItems: 'center',
          gap: 14,
          display: gone ? 'none' : 'flex',
          opacity: fade,
          transform: [{ translateX: hide.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) }],
        }}
      >
        {scanButton(pillW, false)}
        <Glass
          radius={pillW / 2}
          blur={24}
          saturate={1.7}
          accessibilityRole="tablist"
          style={{ width: pillW, paddingVertical: 6, alignItems: 'center', boxShadow: `0 16px 34px -18px rgba(17,20,18,0.45), ${t.insetHighlight}` }}
        >
          {targetX !== undefined ? (
            <Animated.View
              pointerEvents="none"
              style={{ position: 'absolute', left: 4, top: 0, width: pillW - 8, height: 58, borderRadius: 22, backgroundColor: t.accentSoft, transform: [{ translateY: x }] }}
            />
          ) : null}
          {tabs.map((tab, i) => renderTab(tab, i, pillW))}
        </Glass>
      </Animated.View>
    );
  }

  const items: React.ReactNode[] = tabs.map((tab, i) => renderTab(tab, i));
  items.splice(scanAt, 0, scanButton(slotW, true));

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      aria-hidden={hidden}
      style={{
        position: 'absolute',
        left: insets.left,
        right: insets.right,
        bottom: L.tabBarBottom,
        alignItems: 'center',
        display: gone ? 'none' : 'flex',
        opacity: fade,
        transform: [{ translateY: hide.interpolate({ inputRange: [0, 1], outputRange: [0, barTravel] }) }],
      }}
    >
      <Glass
        radius={L.tabBarRadius}
        blur={24}
        saturate={1.7}
        accessibilityRole="tablist"
        style={{
          width: Math.min(width, 560) - L.tabBarSide * 2,
          height: L.tabBarHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 6,
          boxShadow: `0 16px 34px -18px rgba(17,20,18,0.45), ${t.insetHighlight}`,
        }}
      >
        {targetX !== undefined ? (
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 7, width: slotW, height: 58, borderRadius: 22, backgroundColor: t.accentSoft, transform: [{ translateX: x }] }}
          />
        ) : null}
        {items}
      </Glass>
    </Animated.View>
  );
}

// Tab switch: cross-fade over 0.42 s, the incoming screen settling from
// scale 0.985 and 6 pt down. Reduce Motion keeps only the fade. In the click-through test
// build tabs switch at once (E2E_INSTANT_MOTION, theme/motion.ts).
export const bentoTabScreenOptions: BottomTabNavigationOptions = E2E_INSTANT_MOTION ? { headerShown: false, animation: 'none' } : {
  headerShown: false,
  transitionSpec: {
    animation: 'timing',
    config: { duration: bentoDuration.tab, easing: Easing.bezier(0.32, 0.72, 0, 1) },
  },
  sceneStyleInterpolator: ({ current }) => {
    const opacity = current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] });
    if (prefersReducedMotion()) return { sceneStyle: { opacity } };
    return {
      sceneStyle: {
        opacity,
        transform: [
          { scale: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.985, 1, 0.985] }) },
          { translateY: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [6, 0, 6] }) },
        ],
      },
    };
  },
};
