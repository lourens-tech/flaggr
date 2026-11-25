import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StatusBar, StyleSheet, Text, View, useWindowDimensions, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import type { ScrollViewInstance, ViewInstance } from 'react-native';
import { NavigationRouteContext } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useBento } from '../../context/ThemeContext';
import { bentoLayout as L, bentoType, TAB_BAR_CLEARANCE } from '../../theme/bento';
import { useSystemTabBar } from '../../hooks/useVerticalBarTabs';
import { useNativeDriver } from '../../theme/motion';
import { BentoScrollContext } from './motion';
import { registerScrollToTop } from '../../navigation/scrollToTop';
import { Glass, GlassIconButton, NavTitle } from './primitives';

// The faint contour lines across the top of every board.
const CONTOURS = [
  'M-40 40 C 90 10, 190 90, 300 40 S 430 70, 460 30',
  'M-34 66 C 90 40, 190 112, 300 68 S 430 94, 460 60',
  'M-28 92 C 90 70, 190 134, 300 96 S 430 118, 460 90',
  'M-22 118 C 90 100, 190 156, 300 124 S 430 142, 460 120',
  'M-16 144 C 90 130, 190 178, 300 152 S 430 166, 460 150',
  'M-10 170 C 90 160, 190 200, 300 180 S 430 190, 460 180',
  'M-4 196 C 90 190, 190 222, 300 208 S 430 214, 460 210',
  'M2 222 C 90 220, 190 244, 300 236 S 430 238, 460 240',
  'M8 248 C 90 250, 190 266, 300 264 S 430 262, 460 270',
];

export function ContourBackdrop() {
  const { t } = useBento();
  const { width } = useWindowDimensions();
  const h = (width / 390) * 320;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.ground }]}>
      <Svg width={width} height={h} viewBox="0 0 390 320" preserveAspectRatio="xMidYMin slice" fill="none" stroke={t.contour} strokeWidth={1.2}>
        {CONTOURS.map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    </View>
  );
}

// Scroll-linked chrome from the Bento prototype:
// - a pushed screen's header row (Back, title, right button) sticks to the top
//   and turns into a floating glass pill over the first 70 pt of scroll;
// - a tab screen (and My Golf) shows a full-width glass title bar that fades
//   and slides down into place between 40 and 120 pt.
const NAV_TO = 70;
const BAR_FROM = 40;
const BAR_TO = 120;

// A Bento screen: ground background, 24 pt side padding, and (when it
// scrolls) the tile rise/reveal context. With `onBack`, `title` or
// `headerRight` it draws the boards' header row as a sticky glass pill.
// `scrollTitle` is for tab screens: the title bar that appears once scrolled
// (the header row, if any, then scrolls with the content). Tapping the current
// tab again scrolls a tab screen back to the top.
export function BentoScreen({
  children,
  title,
  onBack,
  backLabel = 'Back',
  headerRight,
  scrollTitle,
  tabBar = false,
  scroll = true,
  refreshControl,
  contentStyle,
  gap = L.tileGap,
}: {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  headerRight?: React.ReactNode;
  scrollTitle?: string;
  // The screen sits under the floating tab bar: leave room for it.
  tabBar?: boolean;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  const { t, scheme } = useBento();
  const insets = useSafeAreaInsets();
  const systemTabs = useSystemTabBar();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollTop = useRef(0);
  const content = useRef<ViewInstance>(null);
  const { height: windowHeight } = useWindowDimensions();
  const viewport = useRef(windowHeight);
  const setViewportHeight = (h: number) => {
    if (h > 0) viewport.current = h;
  };
  const order = useRef(0);
  const nextOrder = useCallback(() => order.current++, []);

  const ctx = useMemo(() => ({ scrollY, scrollTop, viewport, content, nextOrder }), [scrollY, nextOrder]);
  const hasHeader = Boolean(title || onBack || headerRight);
  const headerTop = insets.top + 8;
  // Left and right safe areas too: the iPhone Duo's closed screen keeps a strip on the camera
  // side (status, camera) that content must not sit under; 0 on other phones held upright.
  const padLeft = L.screenPadding + insets.left;
  const padRight = L.screenPadding + insets.right;
  // The system tab bar (iPhone Duo) is part of the safe area, so it needs no extra clearance.
  const bottom = (tabBar && !systemTabs ? TAB_BAR_CLEARANCE : 40) + insets.bottom;

  const barOpacity = scrollY.interpolate({ inputRange: [BAR_FROM, BAR_TO], outputRange: [0, 1], extrapolate: 'clamp' });
  const barShift = scrollY.interpolate({ inputRange: [BAR_FROM, BAR_TO], outputRange: [-10, 0], extrapolate: 'clamp' });
  const pillGlass = scrollY.interpolate({ inputRange: [0, NAV_TO], outputRange: [0, 1], extrapolate: 'clamp' });
  // A pushed screen's header row floats (sticky pill); a tab screen's scrolls with the content.
  const pill = hasHeader && !scrollTitle;
  const [rowHeight, setRowHeight] = useState<number>(L.iconButton);

  // Tab re-tap: scroll back to the top. Outside navigation (dev gallery) there's no route.
  const route = useContext(NavigationRouteContext);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (!route?.key || !scroll) return;
    return registerScrollToTop(route.key, () => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  }, [route?.key, scroll]);

  const rowContent = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: L.iconButton }}>
      {onBack ? (
        <GlassIconButton icon="back" onPress={onBack} accessibilityLabel={backLabel} />
      ) : (
        <View style={{ width: headerRight ? L.iconButton : 0 }} />
      )}
      <NavTitle style={{ flex: 1 }} numberOfLines={2}>
        {title}
      </NavTitle>
      <View style={{ minWidth: onBack || headerRight ? L.iconButton : 0, alignItems: 'flex-end' }}>{headerRight}</View>
    </View>
  );

  // In the content: the row itself (tab screens), or a spacer the sticky pill sits over.
  const headerRow = hasHeader ? (pill ? <View style={{ height: rowHeight }} /> : rowContent) : null;

  const body = (
    <View
      ref={content}
      // Keep this view real on Android so tiles can measure against it.
      collapsable={Platform.OS === 'web' ? undefined : false}
      style={[{ paddingTop: hasHeader ? headerTop : insets.top + 16, paddingLeft: padLeft, paddingRight: padRight, paddingBottom: bottom, gap }, contentStyle]}
    >
      {headerRow}
      {children}
    </View>
  );

  return (
    <BentoScrollContext.Provider value={ctx}>
      <View style={{ flex: 1, backgroundColor: t.ground }}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        <ContourBackdrop />
        {scroll ? (
          <Animated.ScrollView
            ref={scrollRef}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver,
              listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
                scrollTop.current = e.nativeEvent.contentOffset.y;
              },
            })}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {body}
          </Animated.ScrollView>
        ) : (
          <View style={{ flex: 1 }} onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}>
            {body}
          </View>
        )}

        {scrollTitle ? (
          // Tab screens: a full-width glass title bar once scrolled.
          <Animated.View pointerEvents="none" aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: barOpacity, transform: [{ translateY: barShift }] }}>
            <Glass radius={0} blur={22} saturate={1.6} style={{ borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.hair, paddingTop: headerTop, paddingBottom: 14, paddingLeft: padLeft + L.iconButton + 12, paddingRight: padRight + L.iconButton + 12 }}>
              <View style={{ minHeight: L.iconButton, justifyContent: 'flex-end' }}>
                <Text numberOfLines={1} style={[bentoType.navTitle, { color: t.ink }]}>
                  {scrollTitle}
                </Text>
              </View>
            </Glass>
          </Animated.View>
        ) : null}
        {pill ? (
          // Pushed screens: the header row sticks and gains a glass pill behind it.
          <View pointerEvents="box-none" style={{ position: 'absolute', top: headerTop - 6, left: padLeft - 6, right: padRight - 6, padding: 6 }}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: pillGlass }]}>
              <Glass radius={30} blur={22} saturate={1.6} style={{ flex: 1, boxShadow: '0 10px 30px -16px rgba(0,0,0,0.45)' }} />
            </Animated.View>
            <View onLayout={(e) => setRowHeight(Math.max(L.iconButton, Math.round(e.nativeEvent.layout.height)))}>{rowContent}</View>
          </View>
        ) : null}
      </View>
    </BentoScrollContext.Provider>
  );
}
