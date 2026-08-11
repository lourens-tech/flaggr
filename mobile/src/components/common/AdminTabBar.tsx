import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { fontFamily, fontSize } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  AdminDashboard: 'bar-chart-outline',
  AdminEnquiries: 'chatbubbles-outline',
  AdminRewards: 'gift-outline',
  AdminPush: 'megaphone-outline',
  AdminVouchers: 'qr-code-outline',
  AdminCourseProfile: 'business-outline',
  AdminStaffProfile: 'person-circle-outline',
  SuperAdminCourses: 'business-outline',
  SuperAdminAds: 'megaphone-outline',
  SuperAdminReports: 'bar-chart-outline',
  SuperAdminPush: 'notifications-outline',
  SuperAdminSupport: 'headset-outline',
  SuperAdminProfile: 'person-circle-outline',
};

const LABELS: Record<string, string> = {
  AdminDashboard: 'Reports',
  AdminEnquiries: 'Enquiries',
  AdminRewards: 'Rewards',
  AdminPush: 'Push',
  AdminVouchers: 'Vouchers',
  AdminCourseProfile: 'Course',
  AdminStaffProfile: 'Profile',
  SuperAdminCourses: 'Courses',
  SuperAdminAds: 'Ads',
  SuperAdminReports: 'Reports',
  SuperAdminPush: 'Push',
  SuperAdminSupport: 'Support',
  SuperAdminProfile: 'Profile',
};

// Renders as a plain bottom tab bar on phones/tablets and narrow browser
// windows, and as a collapsible side panel on wide desktop web (see
// useIsDesktopNav) — the course-admin/super-admin tools are used mostly at
// a desk, where a sidebar is the more standard, scalable pattern than a
// bottom bar. The member app's FloatingTabBar is built around a center
// "Scan" action that doesn't apply here, so this stays a separate component.
export function AdminTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const isDesktop = useIsDesktopNav();
  const [collapsed, setCollapsed] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isDesktop) {
    return (
      <View style={[styles.sidebar, { width: collapsed ? 76 : 232 }]}>
        <TouchableOpacity
          onPress={() => setCollapsed((c) => !c)}
          style={[styles.collapseToggle, collapsed && styles.collapseToggleCentered]}
          accessibilityLabel={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          accessibilityRole="button"
        >
          <Ionicons name={collapsed ? 'chevron-forward-outline' : 'chevron-back-outline'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={[styles.sideItem, collapsed && styles.sideItemCollapsed, isFocused && { backgroundColor: colors.mintBg }]}
              accessibilityLabel={LABELS[route.name] ?? route.name}
              accessibilityRole="button"
            >
              <Ionicons
                name={ICONS[route.name] ?? 'ellipse-outline'}
                size={20}
                color={isFocused ? colors.clubGreen : colors.textMuted}
              />
              {!collapsed && (
                <Text
                  numberOfLines={1}
                  style={[styles.sideLabel, { color: isFocused ? colors.clubGreen : colors.textSecondary }]}
                >
                  {LABELS[route.name] ?? route.name}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

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
  sidebar: {
    height: '100%',
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  collapseToggle: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 12,
  },
  collapseToggleCentered: { alignSelf: 'center' },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  sideItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  sideLabel: { fontFamily: fontFamily.body, fontSize: fontSize.small, flexShrink: 1 },
});
}
