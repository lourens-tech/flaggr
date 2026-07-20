import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { RewardsShopScreen } from '../screens/rewards/RewardsShopScreen';
import { RewardsActivityScreen } from '../screens/rewards/RewardsActivityScreen';
import { MemberProfileScreen } from '../screens/profile/MemberProfileScreen';
import { FloatingTabBar } from '../components/common/FloatingTabBar';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Rewards" component={RewardsShopScreen} />
      <Tab.Screen name="Activity" component={RewardsActivityScreen} />
      <Tab.Screen name="Profile" component={MemberProfileScreen} />
    </Tab.Navigator>
  );
}
