import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { fontFamily, fontSize } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  AdminDashboard: 'bar-chart-outline',
  AdminEnquiries: 'chatbubbles-outline',
  AdminRewards: 'gift-outline',
  AdminPush: 'megaphone-outline',
  AdminVouchers: 'qr-code-outline',
  AdminCourseProfile: 'business-outline',
  AdminStaffProfile: 'person-circle-outline',
};

const LABELS: Record<string, string> = {
  AdminDashboard: 'Reports',
  AdminEnquiries: 'Enquiries',
  AdminRewards: 'Rewards',
  AdminPush: 'Push',
  AdminVouchers: 'Vouchers',
  AdminCourseProfile: 'Course',
  AdminStaffProfile: 'Profile',
};

// A plain (non-floating) bottom tab bar for the course-admin side — the
// member app's FloatingTabBar is built around a center "Scan" action that
// doesn't apply here, so this is a simpler, standard bar instead.
export function AdminTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.bar}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={styles.tab}
            accessibilityLabel={LABELS[route.name] ?? route.name}
            accessibilityRole="button"
          >
            <Ionicons
              name={ICONS[route.name] ?? 'ellipse-outline'}
              size={22}
              color={isFocused ? colors.clubGreen : 'rgba(31,66,52,0.4)'}
            />
            <Text style={[styles.label, { color: isFocused ? colors.clubGreen : 'rgba(31,66,52,0.4)' }]}>
              {LABELS[route.name] ?? route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 20,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.tiny },
});
}
