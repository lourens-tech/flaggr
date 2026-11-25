import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { RewardsShopScreen } from '../screens/rewards/RewardsShopScreen';
import { MemberProfileScreen } from '../screens/profile/MemberProfileScreen';
import { bentoTabScreenOptions } from '../components/bento/BentoTabBar';
import { CourseHomeScreen } from '../screens/golf/CourseHomeScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

// The four tabs of the Bento boards. My Golf opens from Course and Reward
// Activity from Profile (both pushed, see RootNavigator). The tab bar itself
// is drawn once above the whole stack (MemberTabBar), so it can slide away
// on pushed screens; this navigator draws none.
export function MainTabNavigator() {
  return (
    <Tab.Navigator screenOptions={bentoTabScreenOptions} tabBar={() => null}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Course" component={CourseHomeScreen} />
      <Tab.Screen name="Rewards" component={RewardsShopScreen} />
      <Tab.Screen name="Profile" component={MemberProfileScreen} />
    </Tab.Navigator>
  );
}
