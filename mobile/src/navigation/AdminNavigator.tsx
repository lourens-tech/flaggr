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
import { AdminSupportTicketsScreen } from '../screens/admin/AdminSupportTicketsScreen';
import { AdminSupportTicketCreateScreen } from '../screens/admin/AdminSupportTicketCreateScreen';
import { AdminSupportTicketChatScreen } from '../screens/admin/AdminSupportTicketChatScreen';
import { AdminMemberListScreen } from '../screens/admin/AdminMemberListScreen';
import { AdminOnboardingWizard } from '../components/admin/AdminOnboardingWizard';
import { AdminStaffOnboardingWizard } from '../components/admin/AdminStaffOnboardingWizard';
import { useAdmin } from '../context/AdminContext';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminNavigator() {
  const { showOnboardingWizard, showStaffOnboardingWizard } = useAdmin();
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
        <Stack.Screen name="AdminSupportTickets" component={AdminSupportTicketsScreen} />
        <Stack.Screen name="AdminSupportTicketCreate" component={AdminSupportTicketCreateScreen} />
        <Stack.Screen name="AdminSupportTicketChat" component={AdminSupportTicketChatScreen} />
        <Stack.Screen name="AdminMemberList" component={AdminMemberListScreen} />
      </Stack.Navigator>
      {showOnboardingWizard ? <AdminOnboardingWizard /> : null}
      {showStaffOnboardingWizard ? <AdminStaffOnboardingWizard /> : null}
    </>
  );
}
