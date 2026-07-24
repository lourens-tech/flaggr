import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from './types';
import { SuperAdminTabNavigator } from './SuperAdminTabNavigator';
import { SuperAdminCourseCreateScreen } from '../screens/superadmin/SuperAdminCourseCreateScreen';
import { SuperAdminCourseAdsScreen } from '../screens/superadmin/SuperAdminCourseAdsScreen';
import { SuperAdminAdEditScreen } from '../screens/superadmin/SuperAdminAdEditScreen';
import { SuperAdminCourseRewardsScreen } from '../screens/superadmin/SuperAdminCourseRewardsScreen';
import { SuperAdminRewardEditScreen } from '../screens/superadmin/SuperAdminRewardEditScreen';
import { SuperAdminStatBreakdownScreen } from '../screens/superadmin/SuperAdminStatBreakdownScreen';
import { SuperAdminSupportTicketChatScreen } from '../screens/superadmin/SuperAdminSupportTicketChatScreen';
import { SuperAdminAgentsScreen } from '../screens/superadmin/SuperAdminAgentsScreen';
import { SuperAdminAgentCreateScreen } from '../screens/superadmin/SuperAdminAgentCreateScreen';
import { SuperAdminCourseMemberListScreen } from '../screens/superadmin/SuperAdminCourseMemberListScreen';
import { SuperAdminBroadcastComposeScreen } from '../screens/superadmin/SuperAdminBroadcastComposeScreen';

const Stack = createNativeStackNavigator<SuperAdminStackParamList>();

// Shared by super_admin and support_agent — the latter just sees fewer tabs
// inside SuperAdminTabNavigator (Support + Profile only), enforced there and
// server-side (see SUPPORT_AGENT_ALLOWED_ACTIONS in api/admin/index.ts).
export function SuperAdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuperAdminTabs" component={SuperAdminTabNavigator} />
      <Stack.Screen name="SuperAdminCourseCreate" component={SuperAdminCourseCreateScreen} />
      <Stack.Screen name="SuperAdminCourseAds" component={SuperAdminCourseAdsScreen} />
      <Stack.Screen name="SuperAdminAdEdit" component={SuperAdminAdEditScreen} />
      <Stack.Screen name="SuperAdminCourseRewards" component={SuperAdminCourseRewardsScreen} />
      <Stack.Screen name="SuperAdminRewardEdit" component={SuperAdminRewardEditScreen} />
      <Stack.Screen name="SuperAdminStatBreakdown" component={SuperAdminStatBreakdownScreen} />
      <Stack.Screen name="SuperAdminSupportTicketChat" component={SuperAdminSupportTicketChatScreen} />
      <Stack.Screen name="SuperAdminAgents" component={SuperAdminAgentsScreen} />
      <Stack.Screen name="SuperAdminAgentCreate" component={SuperAdminAgentCreateScreen} />
      <Stack.Screen name="SuperAdminCourseMemberList" component={SuperAdminCourseMemberListScreen} />
      <Stack.Screen name="SuperAdminBroadcastCompose" component={SuperAdminBroadcastComposeScreen} />
    </Stack.Navigator>
  );
}
