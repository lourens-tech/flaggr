import React from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { SuperAdminTabParamList } from './types';
import { SuperAdminCoursesScreen } from '../screens/superadmin/SuperAdminCoursesScreen';
import { SuperAdminAdsScreen } from '../screens/superadmin/SuperAdminAdsScreen';
import { SuperAdminReportsScreen } from '../screens/superadmin/SuperAdminReportsScreen';
import { SuperAdminPushScreen } from '../screens/superadmin/SuperAdminPushScreen';
import { SuperAdminSupportInboxScreen } from '../screens/superadmin/SuperAdminSupportInboxScreen';
import { SuperAdminProfileScreen } from '../screens/superadmin/SuperAdminProfileScreen';
import { AdminTabBar } from '../components/admin/AdminTabBar';
import { AdminMoreScreen } from '../screens/admin/AdminMoreScreen';
import { useAdmin } from '../context/AdminContext';
import { useIsDesktopNav } from '../hooks/useIsDesktopNav';
import { tabSceneStyle } from '../components/admin/AdminScope';

const Tab = createBottomTabNavigator<SuperAdminTabParamList>();

export function SuperAdminTabNavigator() {
  const { admin } = useAdmin();
  const isDesktop = useIsDesktopNav();
  // Tabs crossfade on phones; on desktop the per-screen DesktopShell fades
  // its own content area instead, so the sidebar never flickers.
  const screenOptions = (props: Parameters<typeof tabSceneStyle>[0]) => ({
    headerShown: false,
    tabBarPosition: isDesktop ? ('left' as const) : ('bottom' as const),
    animation: isDesktop ? ('none' as const) : ('fade' as const),
    // See-through so the admin backdrop (AdminScope) shows behind every tab.
    sceneStyle: tabSceneStyle(props),
  });
  // On desktop web, each screen renders its own persistent sidebar/topbar via
  // SuperAdminDesktopFrame (see components/admin/desktop) — this bar would
  // just duplicate it. Native app and narrow browser windows are unaffected.
  const tabBar = isDesktop ? () => null : (props: BottomTabBarProps) => <AdminTabBar {...props} />;

  // A `support_agent` account only gets the Support inbox and a basic
  // profile — every other tab (Courses/Ads/Reports) is super_admin-only,
  // enforced server-side too (see SUPPORT_AGENT_ALLOWED_ACTIONS in
  // api/admin/index.ts).
  if (admin.role === 'support_agent') {
    return (
      <Tab.Navigator screenOptions={screenOptions} tabBar={tabBar}>
        <Tab.Screen name="SuperAdminSupport" component={SuperAdminSupportInboxScreen} />
        <Tab.Screen name="SuperAdminProfile" component={SuperAdminProfileScreen} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={screenOptions} tabBar={tabBar}>
      <Tab.Screen name="SuperAdminCourses" component={SuperAdminCoursesScreen} />
      <Tab.Screen name="SuperAdminAds" component={SuperAdminAdsScreen} />
      <Tab.Screen name="SuperAdminReports" component={SuperAdminReportsScreen} />
      <Tab.Screen name="SuperAdminPush" component={SuperAdminPushScreen} />
      <Tab.Screen name="SuperAdminSupport" component={SuperAdminSupportInboxScreen} />
      <Tab.Screen name="SuperAdminProfile" component={SuperAdminProfileScreen} />
      {/* Phones only: lists every section that isn't on the tab bar. */}
      <Tab.Screen name="SuperAdminMore" component={AdminMoreScreen} />
    </Tab.Navigator>
  );
}
