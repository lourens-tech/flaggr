import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from './types';
import { SuperAdminTabNavigator } from './SuperAdminTabNavigator';
import { SuperAdminCourseCreateScreen } from '../screens/superadmin/SuperAdminCourseCreateScreen';
import { SuperAdminCourseAdsScreen } from '../screens/superadmin/SuperAdminCourseAdsScreen';
import { SuperAdminAdEditScreen } from '../screens/superadmin/SuperAdminAdEditScreen';
import { SuperAdminCourseRewardsScreen } from '../screens/superadmin/SuperAdminCourseRewardsScreen';
import { SuperAdminRewardEditScreen } from '../screens/superadmin/SuperAdminRewardEditScreen';

const Stack = createNativeStackNavigator<SuperAdminStackParamList>();

export function SuperAdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuperAdminTabs" component={SuperAdminTabNavigator} />
      <Stack.Screen name="SuperAdminCourseCreate" component={SuperAdminCourseCreateScreen} />
      <Stack.Screen name="SuperAdminCourseAds" component={SuperAdminCourseAdsScreen} />
      <Stack.Screen name="SuperAdminAdEdit" component={SuperAdminAdEditScreen} />
      <Stack.Screen name="SuperAdminCourseRewards" component={SuperAdminCourseRewardsScreen} />
      <Stack.Screen name="SuperAdminRewardEdit" component={SuperAdminRewardEditScreen} />
    </Stack.Navigator>
  );
}
