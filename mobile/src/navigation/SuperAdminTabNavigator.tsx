import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { SuperAdminTabParamList } from './types';
import { SuperAdminCoursesScreen } from '../screens/superadmin/SuperAdminCoursesScreen';
import { SuperAdminAdsScreen } from '../screens/superadmin/SuperAdminAdsScreen';
import { SuperAdminReportsScreen } from '../screens/superadmin/SuperAdminReportsScreen';
import { SuperAdminProfileScreen } from '../screens/superadmin/SuperAdminProfileScreen';
import { AdminTabBar } from '../components/common/AdminTabBar';

const Tab = createBottomTabNavigator<SuperAdminTabParamList>();

export function SuperAdminTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <AdminTabBar {...props} />}>
      <Tab.Screen name="SuperAdminCourses" component={SuperAdminCoursesScreen} />
      <Tab.Screen name="SuperAdminAds" component={SuperAdminAdsScreen} />
      <Tab.Screen name="SuperAdminReports" component={SuperAdminReportsScreen} />
      <Tab.Screen name="SuperAdminProfile" component={SuperAdminProfileScreen} />
    </Tab.Navigator>
  );
}
