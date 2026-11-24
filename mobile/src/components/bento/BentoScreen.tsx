import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, StatusBar, StyleSheet, View, useWindowDimensions, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useBento } from '../../context/ThemeContext';
import { bentoLayout as L, TAB_BAR_CLEARANCE } from '../../theme/bento';
import { useNativeDriver } from '../../theme/motion';
import { BentoScrollContext } from './motion';
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

// Glass title bar fades in over this many points of scroll, starting at 40.
const BAR_FROM = 40;
const BAR_TO = 72;

// A Bento screen: ground background, 24 pt side padding, and (when it
// scrolls) the tile rise/reveal context. With `onBack` or `title`, it draws
// the boards' header row: a glass back button that sticks to the top as you
// scroll, the title centred, and a glass title bar that fades in after 40 pt.
export function BentoScreen({
  children,
  title,
  onBack,
  backLabel = 'Back',
  headerRight,
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
  // The screen sits under the floating tab bar: leave room for it.
  tabBar?: boolean;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  const { t, scheme } = useBento();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollTop = useRef(0);
  const content = useRef<View>(null);
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
  const bottom = (tabBar ? TAB_BAR_CLEARANCE : 40) + insets.bottom;

  const barOpacity = scrollY.interpolate({ inputRange: [BAR_FROM, BAR_TO], outputRange: [0, 1], extrapolate: 'clamp' });

  const headerRow = hasHeader ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: L.iconButton }}>
      {/* The live back button floats above (it sticks); this keeps its place. */}
      <View style={{ width: onBack ? L.iconButton : headerRight ? L.iconButton : 0 }} />
      <NavTitle style={{ flex: 1 }} numberOfLines={2}>
        {title}
      </NavTitle>
      <View style={{ minWidth: onBack || headerRight ? L.iconButton : 0, alignItems: 'flex-end' }}>{headerRight}</View>
    </View>
  ) : null;

  const body = (
    <View
      ref={content}
      // Keep this view real on Android so tiles can measure against it.
      collapsable={Platform.OS === 'web' ? undefined : false}
      style={[{ paddingTop: hasHeader ? headerTop : insets.top + 16, paddingHorizontal: L.screenPadding, paddingBottom: bottom, gap }, contentStyle]}
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

        {hasHeader ? (
          <>
            {/* Glass title bar: fades in once the header has scrolled away. */}
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: barOpacity }}>
              <Glass radius={0} blur={24} saturate={1.7} style={{ borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.hair, paddingTop: headerTop, paddingBottom: 8, paddingHorizontal: L.screenPadding + L.iconButton + 12 }}>
                <View style={{ minHeight: L.iconButton, justifyContent: 'center' }}>
                  <NavTitle numberOfLines={1}>{title}</NavTitle>
                </View>
              </Glass>
            </Animated.View>
            {onBack ? (
              <View style={{ position: 'absolute', top: headerTop, left: L.screenPadding }}>
                <GlassIconButton icon="back" onPress={onBack} accessibilityLabel={backLabel} />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </BentoScrollContext.Provider>
  );
}
