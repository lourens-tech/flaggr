import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdminStackParamList } from './types';
import { AdminTabNavigator } from './AdminTabNavigator';
import { AdminRewardEditScreen } from '../screens/admin/AdminRewardEditScreen';
import { AdminNotificationsScreen } from '../screens/admin/AdminNotificationsScreen';
import { AdminEnquiryChatScreen } from '../screens/admin/AdminEnquiryChatScreen';
import { AdminMemberStatsScreen } from '../screens/admin/AdminMemberStatsScreen';
import { AdminBroadcastComposeScreen } from '../screens/admin/AdminBroadcastComposeScreen';
import { AdminStaffListScreen } from '../screens/admin/AdminStaffListScreen';
import { AdminClubAdminsScreen } from '../screens/admin/AdminClubAdminsScreen';
import { AdminStaffEditScreen } from '../screens/admin/AdminStaffEditScreen';
import { AdminSupportTicketsScreen } from '../screens/admin/AdminSupportTicketsScreen';
import { AdminSupportTicketCreateScreen } from '../screens/admin/AdminSupportTicketCreateScreen';
import { AdminSupportTicketChatScreen } from '../screens/admin/AdminSupportTicketChatScreen';
import { AdminMemberListScreen } from '../screens/admin/AdminMemberListScreen';
import { AdminFraudOversightScreen } from '../screens/admin/AdminFraudOversightScreen';
import { AdminCatalogScreen } from '../screens/admin/AdminCatalogScreen';
import { AdminCatalogItemEditScreen } from '../screens/admin/AdminCatalogItemEditScreen';
import { AdminReportDetailScreen } from '../screens/admin/AdminReportDetailScreen';
import { AdminStaffActivityScreen } from '../screens/admin/AdminStaffActivityScreen';
import { AdminTermsPrivacyScreen } from '../screens/admin/AdminTermsPrivacyScreen';
import { AdminOnboardingWizard } from '../components/admin/AdminOnboardingWizard';
import { AdminStaffOnboardingWizard } from '../components/admin/AdminStaffOnboardingWizard';
import { useAdmin } from '../context/AdminContext';
import { useIsDesktopNav } from '../hooks/useIsDesktopNav';
import { stackScreenOptions } from './motionOptions';
import { AdminThemeScope } from '../context/ThemeContext';
import { adminScreenLayout, transparentScene } from '../components/admin/AdminScope';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminNavigator() {
  const { showOnboardingWizard, showStaffOnboardingWizard } = useAdmin();
  const isDesktop = useIsDesktopNav();
  // Every screen renders its own instance of the desktop sidebar/topbar (see
  // AdminDesktopFrame) so it reads as persistent chrome — the default slide
  // transition would otherwise visibly re-animate it on every navigation.
  return (
    <AdminThemeScope>
      <Stack.Navigator
        screenOptions={isDesktop ? { headerShown: false, animation: 'none', contentStyle: transparentScene } : { ...stackScreenOptions, contentStyle: transparentScene }}
        screenLayout={adminScreenLayout(isDesktop)}
      >
        <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
        <Stack.Screen name="AdminRewardEdit" component={AdminRewardEditScreen} />
        <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} />
        <Stack.Screen name="AdminEnquiryChat" component={AdminEnquiryChatScreen} />
        <Stack.Screen name="AdminMemberStats" component={AdminMemberStatsScreen} />
        <Stack.Screen name="AdminBroadcastCompose" component={AdminBroadcastComposeScreen} />
        <Stack.Screen name="AdminStaffList" component={AdminStaffListScreen} />
        <Stack.Screen name="AdminClubAdmins" component={AdminClubAdminsScreen} />
        <Stack.Screen name="AdminStaffEdit" component={AdminStaffEditScreen} />
        <Stack.Screen name="AdminStaffActivity" component={AdminStaffActivityScreen} />
        <Stack.Screen name="AdminSupportTickets" component={AdminSupportTicketsScreen} />
        <Stack.Screen name="AdminSupportTicketCreate" component={AdminSupportTicketCreateScreen} />
        <Stack.Screen name="AdminSupportTicketChat" component={AdminSupportTicketChatScreen} />
        <Stack.Screen name="AdminMemberList" component={AdminMemberListScreen} />
        <Stack.Screen name="AdminFraudOversight" component={AdminFraudOversightScreen} />
        <Stack.Screen name="AdminCatalog" component={AdminCatalogScreen} />
        <Stack.Screen name="AdminCatalogItemEdit" component={AdminCatalogItemEditScreen} />
        <Stack.Screen name="AdminReportDetail" component={AdminReportDetailScreen} />
        <Stack.Screen name="TermsPrivacy" component={AdminTermsPrivacyScreen} />
      </Stack.Navigator>
      {showOnboardingWizard ? <AdminOnboardingWizard /> : null}
      {showStaffOnboardingWizard ? <AdminStaffOnboardingWizard /> : null}
    </AdminThemeScope>
  );
}
