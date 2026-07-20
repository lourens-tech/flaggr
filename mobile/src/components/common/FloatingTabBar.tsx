import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '../../theme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Rewards: 'gift-outline',
  Activity: 'time-outline',
  Profile: 'person-outline',
};

// Custom floating pill nav with a raised center "Scan" button, matching the
// Figma "Show QR Button Container" / scan bar seen on Home, Rewards Shop, etc.
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  const renderIcon = (route: (typeof state.routes)[number], index: number) => {
    const isFocused = state.index === index;
    const iconName = ICONS[route.name] ?? 'ellipse-outline';
    return (
      <TouchableOpacity
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        style={styles.iconButton}
        hitSlop={8}
      >
        <Ionicons
          name={iconName}
          size={22}
          color={isFocused ? colors.clubGreen : 'rgba(31,66,52,0.4)'}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.bar}>
        {leftRoutes.map((r, i) => renderIcon(r, i))}
        <TouchableOpacity
          onPress={() => navigation.navigate('ScanReceipt')}
          style={styles.scanButton}
          activeOpacity={0.85}
        >
          <Ionicons name="scan-outline" size={24} color={colors.white} />
        </TouchableOpacity>
        {rightRoutes.map((r, i) => renderIcon(r, i + 2))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBgAlt,
    borderRadius: 25,
    paddingHorizontal: 22,
    height: 64,
    gap: 22,
    shadowColor: colors.darkGreen,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  iconButton: { width: 24, alignItems: 'center', justifyContent: 'center' },
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
