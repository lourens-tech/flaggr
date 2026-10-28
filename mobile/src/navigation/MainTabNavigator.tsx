import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { RewardsShopScreen } from '../screens/rewards/RewardsShopScreen';
import { RewardsActivityScreen } from '../screens/rewards/RewardsActivityScreen';
import { MemberProfileScreen } from '../screens/profile/MemberProfileScreen';
import { FloatingTabBar } from '../components/common/FloatingTabBar';
import { CourseHomeScreen } from '../screens/golf/CourseHomeScreen';
import { MyGolfScreen } from '../screens/golf/MyGolfScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      // Tabs crossfade instead of snapping (see theme/motion.ts).
      screenOptions={{ headerShown: false, animation: 'fade' }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Course" component={CourseHomeScreen} />
      <Tab.Screen name="MyGolf" component={MyGolfScreen} />
      <Tab.Screen name="Rewards" component={RewardsShopScreen} />
      <Tab.Screen name="Activity" component={RewardsActivityScreen} />
      <Tab.Screen name="Profile" component={MemberProfileScreen} />
    </Tab.Navigator>
  );
}
