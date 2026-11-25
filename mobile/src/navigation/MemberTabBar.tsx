import React, { useEffect, useState } from 'react';
import { CommonActions, StackActions, type NavigationState, type ParamListBase, type NavigationHelpers } from '@react-navigation/native';
import { BentoTabBarView, type BentoTab } from '../components/bento/BentoTabBar';
import { haptic } from '../utils/haptics';
import { scrollRouteToTop } from './scrollToTop';
import { navigationRef } from './navigationRef';

// The member tab bar lives above the whole stack, as in the Bento prototype:
// it shows on the four tab screens and on My Golf (which lights Course), and
// slides away on every other screen. Tabs: Home, Course | Scan | Rewards, Profile.
export const MEMBER_TABS = ['Home', 'Course', 'Rewards', 'Profile'] as const;
export type MemberTab = (typeof MEMBER_TABS)[number];

const TABS: BentoTab[] = MEMBER_TABS.map((name) => ({ key: name, name }));
// Screens that keep the bar, and the tab each one lights.
const TABBED: Record<string, MemberTab | undefined> = { MyGolf: 'Course' };

type Route = NavigationState['routes'][number];

function mainTabOf(main: Route | undefined): { name: MemberTab; key?: string } {
  const st = main?.state as NavigationState | undefined;
  if (st && typeof st.index === 'number') {
    const r = st.routes[st.index];
    return { name: r.name as MemberTab, key: r.key };
  }
  const p = main?.params as { screen?: MemberTab } | undefined;
  return { name: p?.screen ?? 'Home' };
}

export function MemberTabBar({ state: stackState, navigation }: { state: NavigationState; navigation: NavigationHelpers<ParamListBase> }) {
  // The stack's own state doesn't carry the tab navigator's state, so read the whole tree
  // (which tab is open, and its route key for scroll-to-top) and follow every change.
  const [rootState, setRootState] = useState(() => (navigationRef.isReady() ? navigationRef.getRootState() : undefined));
  useEffect(() => {
    const update = () => setRootState(navigationRef.getRootState());
    update();
    return navigationRef.addListener('state', update);
  }, []);
  const state = rootState && rootState.key === stackState.key ? rootState : stackState;
  const focused = state.routes[state.index];
  const main = state.routes.find((r) => r.name === 'Main');
  const mainTab = mainTabOf(main);
  const onMain = focused.name === 'Main';
  const lit: MemberTab | undefined = onMain ? mainTab.name : TABBED[focused.name];
  const hidden = lit === undefined;
  const activeIndex = Math.max(0, MEMBER_TABS.indexOf(lit ?? mainTab.name));

  const onTabPress = (tab: BentoTab) => {
    const name = tab.name as MemberTab;
    haptic.selection();
    if (onMain) {
      if (name === mainTab.name) scrollRouteToTop(mainTab.key);
      else navigation.navigate('Main', { screen: name });
      return;
    }
    // On My Golf: back to the tab below if it is the one tapped (a pop), otherwise
    // close My Golf with the tab cross-fade and switch tabs (as the prototype does).
    const below = state.routes[state.index - 1];
    if (below?.name === 'Main' && mainTabOf(below).name === name) {
      navigation.dispatch({ ...StackActions.pop(), target: state.key });
      return;
    }
    navigation.dispatch({ ...CommonActions.setParams({ closeAs: 'tab' }), source: focused.key, target: state.key });
    // Let My Golf render once with its cross-fade options, so its closing animation uses them.
    requestAnimationFrame(() => navigation.dispatch({ ...StackActions.popTo('Main', { screen: name }), target: state.key }));
  };

  return (
    <BentoTabBarView
      tabs={TABS}
      activeIndex={activeIndex}
      hidden={hidden}
      onTabPress={onTabPress}
      onScanPress={() => {
        haptic.medium();
        navigation.navigate('ScanFlow');
      }}
    />
  );
}
