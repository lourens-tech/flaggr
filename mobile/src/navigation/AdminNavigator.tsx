import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdminStackParamList } from './types';
import { AdminTabNavigator } from './AdminTabNavigator';
import { AdminRewardEditScreen } from '../screens/admin/AdminRewardEditScreen';
import { AdminAdEditScreen } from '../screens/admin/AdminAdEditScreen';
import { AdminNotificationsScreen } from '../screens/admin/AdminNotificationsScreen';
import { AdminEnquiryChatScreen } from '../screens/admin/AdminEnquiryChatScreen';
import { AdminMemberStatsScreen } from '../screens/admin/AdminMemberStatsScreen';
import { AdminBroadcastComposeScreen } from '../screens/admin/AdminBroadcastComposeScreen';
import { AdminStaffListScreen } from '../screens/admin/AdminStaffListScreen';
import { AdminStaffEditScreen } from '../screens/admin/AdminStaffEditScreen';
import { AdminOnboardingWizard } from '../components/admin/AdminOnboardingWizard';
import { useAdmin } from '../context/AdminContext';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminNavigator() {
  const { showOnboardingWizard } = useAdmin();
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
        <Stack.Screen name="AdminRewardEdit" component={AdminRewardEditScreen} />
        <Stack.Screen name="AdminAdEdit" component={AdminAdEditScreen} />
        <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} />
        <Stack.Screen name="AdminEnquiryChat" component={AdminEnquiryChatScreen} />
        <Stack.Screen name="AdminMemberStats" component={AdminMemberStatsScreen} />
        <Stack.Screen name="AdminBroadcastCompose" component={AdminBroadcastComposeScreen} />
        <Stack.Screen name="AdminStaffList" component={AdminStaffListScreen} />
        <Stack.Screen name="AdminStaffEdit" component={AdminStaffEditScreen} />
      </Stack.Navigator>
      {showOnboardingWizard ? <AdminOnboardingWizard /> : null}
    </>
  );
}
