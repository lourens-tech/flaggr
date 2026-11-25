import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { RewardsShopScreen } from '../screens/rewards/RewardsShopScreen';
import { MemberProfileScreen } from '../screens/profile/MemberProfileScreen';
import { CourseHomeScreen } from '../screens/golf/CourseHomeScreen';
import { useBento } from '../context/ThemeContext';
import { haptic } from '../utils/haptics';
import { refreshVerticalBarAsync } from '../../modules/flagrr-vertical-bar';

// The member tabs as the iOS system tab bar, used where iOS shows a vertical
// bar (iPhone Duo): iOS places the system bar in that strip, which a tab bar
// drawn in JavaScript can never reach (useSystemTabBar, owner decision
// 25 Nov 2026). Same four tabs as the Bento bar; Scan is the bar's separate
// slot (the system "search" item, given Scan's icon and label) and opens the
// scan flow instead of becoming a tab. Re-tapping a tab scrolls it to the top
// natively.
type SystemTabParamList = MainTabParamList & { ScanTab: undefined };

// Created on iOS only: the native tabs throw as soon as they are created on web
// ("Native Bottom Tabs are not supported on this platform"), and this file is part
// of the web bundle too. The web build never uses them (useSystemTabBar is false there).
const Tab = Platform.OS === 'ios' ? createNativeBottomTabNavigator<SystemTabParamList>() : null;

function NoScreen() {
  return <View />;
}

export function MemberSystemTabNavigator() {
  const { t } = useBento();
  // The system tab bar mounts after iOS has laid out the strip, so ask iOS to look again once
  // layout has settled (the tab bar controller is attached when its host reaches the window).
  useEffect(() => {
    const id = setTimeout(() => void refreshVerticalBarAsync(), 400);
    return () => clearTimeout(id);
  }, []);
  if (!Tab) return null;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        // The Bento tab bar never hides, so the system bar doesn't minimise on scroll either.
        tabBarMinimizeBehavior: 'none',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home', tabBarIcon: ({ focused }) => ({ type: 'sfSymbol', name: focused ? 'house.fill' : 'house' }) }}
      />
      <Tab.Screen
        name="Course"
        component={CourseHomeScreen}
        options={{ title: 'Course', tabBarIcon: ({ focused }) => ({ type: 'sfSymbol', name: focused ? 'flag.fill' : 'flag' }) }}
      />
      <Tab.Screen
        name="Rewards"
        component={RewardsShopScreen}
        options={{ title: 'Rewards', tabBarIcon: ({ focused }) => ({ type: 'sfSymbol', name: focused ? 'gift.fill' : 'gift' }) }}
      />
      <Tab.Screen
        name="Profile"
        component={MemberProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ focused }) => ({ type: 'sfSymbol', name: focused ? 'person.fill' : 'person' }) }}
      />
      <Tab.Screen
        name="ScanTab"
        component={NoScreen}
        options={{
          title: 'Scan',
          // A system item takes its label from tabBarLabel only.
          tabBarLabel: 'Scan',
          tabBarSystemItem: 'search',
          tabBarIcon: { type: 'sfSymbol', name: 'viewfinder' },
          // Never becomes the open tab: a tap opens the scan flow over everything.
          tabBarSelectionEnabled: false,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            haptic.medium();
            navigation.getParent()?.navigate('ScanFlow');
          },
        })}
      />
    </Tab.Navigator>
  );
}
