import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { AdminTabParamList } from './types';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminEnquiriesListScreen } from '../screens/admin/AdminEnquiriesListScreen';
import { AdminRewardsListScreen } from '../screens/admin/AdminRewardsListScreen';
import { AdminPushScreen } from '../screens/admin/AdminPushScreen';
import { AdminVoucherRedeemScreen } from '../screens/admin/AdminVoucherRedeemScreen';
import { AdminCourseProfileScreen } from '../screens/admin/AdminCourseProfileScreen';
import { AdminStaffProfileScreen } from '../screens/admin/AdminStaffProfileScreen';
import { AdminTabBar } from '../components/common/AdminTabBar';
import { useAdmin } from '../context/AdminContext';

const Tab = createBottomTabNavigator<AdminTabParamList>();

export function AdminTabNavigator() {
  const { admin } = useAdmin();

  // A `staff` account only gets the Vouchers tab (to validate member reward
  // redemptions) and a basic profile — every other tab is course_admin-only,
  // enforced server-side too (see STAFF_ALLOWED_ACTIONS in api/admin/index.ts).
  if (admin.role === 'staff') {
    return (
      <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <AdminTabBar {...props} />}>
        <Tab.Screen name="AdminVouchers" component={AdminVoucherRedeemScreen} />
        <Tab.Screen name="AdminStaffProfile" component={AdminStaffProfileScreen} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <AdminTabBar {...props} />}>
      <Tab.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="AdminEnquiries" component={AdminEnquiriesListScreen} />
      <Tab.Screen name="AdminRewards" component={AdminRewardsListScreen} />
      <Tab.Screen name="AdminPush" component={AdminPushScreen} />
      <Tab.Screen name="AdminVouchers" component={AdminVoucherRedeemScreen} />
      <Tab.Screen name="AdminCourseProfile" component={AdminCourseProfileScreen} />
    </Tab.Navigator>
  );
}
