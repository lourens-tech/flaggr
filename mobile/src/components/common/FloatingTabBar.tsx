import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { prefersReducedMotion, spring, useNativeDriver } from '../../theme/motion';
import { PressableScale } from '../motion';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Course: 'flag-outline',
  MyGolf: 'stats-chart-outline',
  Rewards: 'gift-outline',
  Activity: 'time-outline',
  Profile: 'person-outline',
};

const LABELS: Record<string, string> = { MyGolf: 'My Golf' };

// Filled variants for the selected tab, the way iOS tab bars swap outline
// for filled glyphs.
const ICONS_ACTIVE: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Course: 'flag',
  MyGolf: 'stats-chart',
  Rewards: 'gift',
  Activity: 'time',
  Profile: 'person',
};

function TabIcon({
  name,
  focused,
  onPress,
  colors,
  styles,
}: {
  name: string;
  focused: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  // 0 = idle, 1 = selected. Springs so the icon pops slightly and the dot
  // under it grows in when the tab is chosen.
  const focus = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      focus.setValue(focused ? 1 : 0);
      return;
    }
    const anim = Animated.spring(focus, { toValue: focused ? 1 : 0, ...spring.snappy, useNativeDriver });
    anim.start();
    return () => anim.stop();
  }, [focused, focus]);

  const iconName = (focused ? ICONS_ACTIVE[name] : ICONS[name]) ?? 'ellipse-outline';

  return (
    <PressableScale
      onPress={onPress}
      style={styles.iconButton}
      pressedScale={0.88}
      hitSlop={10}
      accessibilityLabel={LABELS[name] ?? name}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
    >
      <Animated.View
        style={{
          transform: [
            { scale: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
            { translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
          ],
        }}
      >
        <Ionicons name={iconName} size={22} color={focused ? colors.clubGreen : 'rgba(31,66,52,0.4)'} />
      </Animated.View>
      <Animated.View style={[styles.dot, { opacity: focus, transform: [{ scale: focus }] }]} />
    </PressableScale>
  );
}

// Custom floating pill nav with a raised center "Scan" button, matching the
// Figma "Show QR Button Container" / scan bar seen on Home, Rewards Shop, etc.
// Three tabs either side keeps Scan centred: your golf (Home, Course, My
// Golf) on the left, your Flagrr Cash (Rewards, Activity, Profile) on the
// right. Gap and padding are sized so all seven fit a 360-wide phone.
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const leftRoutes = state.routes.slice(0, 3);
  const rightRoutes = state.routes.slice(3);

  const renderIcon = (route: (typeof state.routes)[number], index: number) => (
    <TabIcon
      key={route.key}
      name={route.name}
      focused={state.index === index}
      onPress={() => navigation.navigate(route.name)}
      colors={colors}
      styles={styles}
    />
  );

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.bar}>
        {leftRoutes.map((r, i) => renderIcon(r, i))}
        <PressableScale
          onPress={() => navigation.navigate('ScanReceipt')}
          style={styles.scanButton}
          pressedScale={0.9}
          accessibilityLabel="Scan receipt"
          accessibilityRole="button"
        >
          <Ionicons name="scan-outline" size={24} color={colors.white} />
        </PressableScale>
        {rightRoutes.map((r, i) => renderIcon(r, i + 3))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBgAlt,
    borderRadius: 25,
    paddingHorizontal: 18,
    height: 64,
    gap: 16,
    shadowColor: colors.darkGreen,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  iconButton: { width: 24, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    bottom: -9,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.clubGreen,
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 22,
    backgroundColor: colors.clubGreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.mintBgAlt,
    marginTop: -18,
  },
});
}
