import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminTheme } from '../../../context/ThemeContext';
import { adminFont, adminRadius, tabularNums } from '../../../theme/admin';
import { useHover, hoverTransition } from '../../../hooks/useHover';
import type { DesktopNavGroup, DesktopNavItem, DesktopNavTarget } from '../../../navigation/adminNavConfig';
import { ScreenFade } from '../../motion';
import { CircleButton, CountBadge, Glass } from '../ui';
import { CommandPalette, commandKeyHint, type PaletteMember } from './CommandPalette';

// The Activity inspector only fits beside the content on wide windows.
const INSPECTOR_BREAKPOINT = 1280;
// Between the tab-bar cutoff (useIsDesktopNav, 900) and this width — an open
// Galaxy Z Fold or iPhone Duo, a half-width browser window — the sidebar
// collapses to an icon rail so the content keeps its room.
const RAIL_BREAKPOINT = 1100;

// Touch screens (a foldable or tablet in a browser) get taller targets.
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: coarse)');
    setCoarse(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return coarse;
}

export interface DesktopNavigator {
  navigate: (name: string, params?: object) => void;
}

export function goTo(navigation: DesktopNavigator, target: DesktopNavTarget) {
  if (target.nestedIn) navigation.navigate(target.nestedIn, { screen: target.screen });
  else navigation.navigate(target.screen);
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
}

const FLAGRR_MARK = require('../../../../assets/images/flagrr-icon-lime.png');

interface NavItemButtonProps {
  item: DesktopNavItem;
  isActive: boolean;
  count?: number;
  hot?: boolean;
  navigation: DesktopNavigator;
  rail: boolean;
  touch: boolean;
}

function NavItemButton({ item, isActive, count, hot, navigation, rail, touch }: NavItemButtonProps) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={() => goTo(navigation, item.target)}
      accessibilityRole="link"
      accessibilityLabel={count ? `${item.label}, ${count} waiting` : item.label}
      accessibilityState={{ selected: isActive }}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[
        styles.navItem,
        hoverTransition,
        touch && { height: 48 },
        rail && styles.navItemRail,
        isActive ? { backgroundColor: c.sel } : hovered ? { backgroundColor: c.fill2 } : null,
      ]}
    >
      <Ionicons name={item.icon} size={rail ? 21 : 18} color={isActive ? c.ink : c.ink2} />
      {rail ? (
        count && hot ? <CountBadge count={count} style={styles.railBadge} /> : null
      ) : (
        <Text style={[styles.navLabel, { color: isActive ? c.ink : c.ink2 }, isActive && adminFont.bodySemiBold]} numberOfLines={1}>
          {item.label}
        </Text>
      )}
      {rail ? null : count ? (
        hot ? (
          <CountBadge count={count} />
        ) : (
          <Text style={[styles.navCount, { color: c.ink3 }]}>{count}</Text>
        )
      ) : null}
    </Pressable>
  );
}

interface Props {
  navigation: DesktopNavigator;
  brandName: string;
  brandSub: string;
  // Club crest: the club's logo, or its initial on Fairway green. Flagrr's own
  // consoles show the Flagrr mark instead.
  brandLogoUrl?: string | null;
  brandIsFlagrr?: boolean;
  navGroups: DesktopNavGroup[];
  activeKey: string;
  // Waiting items per nav key; `hot` ones get a red badge.
  navCounts?: Record<string, { count: number; hot?: boolean }>;
  userFirstName: string;
  userLastName: string;
  userRoleLabel: string;
  onAvatarPress: () => void;
  breadcrumb: string;
  headerRight?: React.ReactNode;
  unreadNotificationCount?: number;
  onBellPress?: () => void;
  rightRail?: React.ReactNode;
  // Shown under the account button on a club's console.
  poweredByFlagrr?: boolean;
  // ⌘K member lookup; omitted where the role can't search members.
  searchMembers?: (query: string) => Promise<PaletteMember[]>;
  onMember?: (member: PaletteMember) => void;
  // Set false for screens that manage their own internal scrolling (e.g. a
  // chat thread with a pinned composer) — the content area becomes a plain
  // flex column instead of a ScrollView, so children aren't nested inside
  // two scroll containers.
  scrollable?: boolean;
  // Sits above the content on every page (e.g. the past-due banner).
  topBanner?: React.ReactNode;
  children: React.ReactNode;
}

// Persistent chrome for the admin consoles on desktop web (see
// useIsDesktopNav — native apps and narrow windows use the tab bar). A glass
// sidebar and toolbar float over the club's blurred cover photo (painted by
// AdminScope's screen layout); content stays on opaque tiles. Each screen
// renders its own instance so it can use the screen's own `navigation`;
// transitions are off on desktop (see AdminNavigator/SuperAdminNavigator), so
// only the content area fades between sections.
export function DesktopShell({
  navigation,
  brandName,
  brandSub,
  brandLogoUrl,
  brandIsFlagrr,
  navGroups,
  activeKey,
  navCounts,
  userFirstName,
  userLastName,
  userRoleLabel,
  onAvatarPress,
  breadcrumb,
  headerRight,
  unreadNotificationCount = 0,
  onBellPress,
  rightRail,
  poweredByFlagrr,
  searchMembers,
  onMember,
  scrollable = true,
  topBanner,
  children,
}: Props) {
  const { c } = useAdminTheme();
  const { width } = useWindowDimensions();
  const showInspector = !!rightRail && width >= INSPECTOR_BREAKPOINT;
  const rail = width < RAIL_BREAKPOINT;
  const touch = useCoarsePointer();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchHovered, searchHoverHandlers] = useHover();
  const [acctHovered, acctHoverHandlers] = useHover();

  // ⌘K / Ctrl K opens search from anywhere in the console.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const crest = brandIsFlagrr ? (
    <View style={[styles.crest, { backgroundColor: '#1F4234' }]}>
      <Image source={FLAGRR_MARK} style={styles.crestMark} resizeMode="contain" accessibilityLabel="Flagrr" />
    </View>
  ) : brandLogoUrl ? (
    <Image source={{ uri: brandLogoUrl }} style={[styles.crest, { backgroundColor: c.surface }]} accessibilityLabel={`${brandName} logo`} />
  ) : (
    <View style={[styles.crest, { backgroundColor: '#1F4234' }]}>
      <Text style={styles.crestText}>{brandName.charAt(0).toUpperCase() || 'F'}</Text>
    </View>
  );

  return (
    <View style={styles.shell}>
      <Glass radius={adminRadius.lg} style={[styles.sidebar, rail && styles.sidebarRail]}>
        <View style={[styles.club, rail && styles.clubRail]}>
          {crest}
          {rail ? null : (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.clubName, { color: c.ink }]} numberOfLines={1}>{brandName}</Text>
              <Text style={[styles.clubRole, { color: c.ink3 }]} numberOfLines={1}>{brandSub}</Text>
            </View>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} accessibilityRole="menu">
          {navGroups.map((group, gi) => (
            <View key={group.label || `g${gi}`} style={styles.group}>
              {group.label && !rail ? <Text style={[styles.groupLabel, { color: c.ink3 }]}>{group.label}</Text> : null}
              {rail && gi > 0 ? <View style={[styles.railSep, { backgroundColor: c.edge }]} /> : null}
              {group.items.map((item) => (
                <NavItemButton
                  key={item.key}
                  item={item}
                  isActive={item.key === activeKey}
                  count={navCounts?.[item.key]?.count}
                  hot={navCounts?.[item.key]?.hot}
                  navigation={navigation}
                  rail={rail}
                  touch={touch}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel={`Account: ${userFirstName} ${userLastName}, ${userRoleLabel}`}
          onHoverIn={acctHoverHandlers.onMouseEnter}
          onHoverOut={acctHoverHandlers.onMouseLeave}
          style={[styles.acct, hoverTransition, { borderTopColor: c.edge }, rail && styles.acctRail, acctHovered && { backgroundColor: c.fill2 }]}
        >
          <View style={[styles.av, { backgroundColor: c.fill }]}>
            <Text style={[styles.avText, { color: c.ink }]}>{initials(userFirstName, userLastName)}</Text>
          </View>
          {rail ? null : (
            <>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.acctName, { color: c.ink }]} numberOfLines={1}>{userFirstName} {userLastName}</Text>
                <Text style={[styles.acctRole, { color: c.ink3 }]} numberOfLines={1}>{userRoleLabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={c.ink3} />
            </>
          )}
        </Pressable>
        {poweredByFlagrr && !rail ? (
          <View style={styles.powered}>
            <Image source={FLAGRR_MARK} style={styles.poweredMark} resizeMode="contain" accessible={false} />
            <Text style={[styles.poweredText, { color: c.ink3 }]}>Powered by Flagrr</Text>
          </View>
        ) : null}
      </Glass>

      <View style={styles.main}>
        <View style={styles.toolbar}>
          <Text style={[styles.crumb, { color: c.ink3 }]} numberOfLines={1}>
            {breadcrumb}
          </Text>
          <View style={{ flex: 1 }} />
          {headerRight}
          <Pressable
            onPress={() => setPaletteOpen(true)}
            accessibilityRole="search"
            accessibilityLabel={`Search, ${commandKeyHint()}`}
            onHoverIn={searchHoverHandlers.onMouseEnter}
            onHoverOut={searchHoverHandlers.onMouseLeave}
          >
            <Glass radius={adminRadius.pill} style={[styles.search, touch && { height: 46 }, rail && { width: 46, paddingHorizontal: 0, justifyContent: 'center' }, searchHovered && { backgroundColor: c.fill }]}>
              <Ionicons name="search" size={15} color={c.ink3} />
              {rail ? null : (
                <>
                  <Text style={[styles.searchText, { color: c.ink3 }]}>Search</Text>
                  {touch ? null : <Text style={[styles.kbd, { color: c.ink3, backgroundColor: c.fill }]}>{commandKeyHint()}</Text>}
                </>
              )}
            </Glass>
          </Pressable>
          {onBellPress ? (
            <CircleButton icon="notifications-outline" onPress={onBellPress} accessibilityLabel="Activity" badge={unreadNotificationCount || undefined} size={touch ? 46 : 40} />
          ) : null}
        </View>

        {topBanner ? <View style={styles.topBanner}>{topBanner}</View> : null}

        {/* Sidebar and toolbar stay put; only the content area fades in, so
            moving between sections reads as one persistent window. */}
        <ScreenFade>
          {scrollable ? (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.content, styles.nonScrollContent]}>{children}</View>
          )}
        </ScreenFade>
      </View>

      {showInspector ? (
        <Glass radius={adminRadius.lg} style={styles.inspector}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.inspectorContent}>
            {rightRail}
          </ScrollView>
        </Glass>
      ) : null}

      <CommandPalette
        visible={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navGroups={navGroups}
        onSection={(item) => goTo(navigation, item.target)}
        searchMembers={searchMembers}
        onMember={onMember}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', gap: 12, padding: 12 },
  sidebar: { width: 252, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 12 },
  sidebarRail: { width: 76, paddingHorizontal: 10 },
  clubRail: { justifyContent: 'center', paddingHorizontal: 0 },
  navItemRail: { justifyContent: 'center', paddingHorizontal: 0, height: 48 },
  railBadge: { position: 'absolute', top: 2, right: 4, minWidth: 18, height: 18 },
  railSep: { height: StyleSheet.hairlineWidth, marginHorizontal: 10, marginVertical: 8 },
  acctRail: { justifyContent: 'center', paddingHorizontal: 0 },
  club: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, marginBottom: 14 },
  crest: { width: 40, height: 40, borderRadius: adminRadius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  crestMark: { width: 26, height: 26 },
  crestText: { ...adminFont.title, fontSize: 18, color: '#CDDE5C' },
  clubName: { ...adminFont.bodyBold, fontSize: 15 },
  clubRole: { ...adminFont.body, fontSize: 12.5, marginTop: 1 },
  group: { marginBottom: 6 },
  groupLabel: { ...adminFont.bodyBold, fontSize: 11.5, letterSpacing: 1.1, textTransform: 'uppercase', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 40, paddingHorizontal: 12, borderRadius: adminRadius.sm, marginBottom: 2 },
  navLabel: { ...adminFont.bodyMedium, fontSize: 14.5, flex: 1 },
  navCount: { ...adminFont.bodyMedium, ...tabularNums, fontSize: 13 },
  acct: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderRadius: adminRadius.sm },
  av: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avText: { ...adminFont.bodyBold, fontSize: 12.5 },
  acctName: { ...adminFont.bodySemiBold, fontSize: 13.5 },
  acctRole: { ...adminFont.body, fontSize: 12 },
  powered: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingTop: 10 },
  poweredMark: { width: 24, height: 24 },
  poweredText: { ...adminFont.body, fontSize: 12 },
  main: { flex: 1, minWidth: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 12 },
  crumb: { ...adminFont.bodyMedium, fontSize: 13.5, flexShrink: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, width: 240, paddingHorizontal: 14 },
  searchText: { ...adminFont.body, fontSize: 14, flex: 1 },
  kbd: { ...adminFont.bodySemiBold, fontSize: 11.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  topBanner: { paddingHorizontal: 12, paddingBottom: 8 },
  content: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 60, gap: 20, maxWidth: 1180, width: '100%' },
  nonScrollContent: { flex: 1, paddingBottom: 12 },
  inspector: { width: 320 },
  inspectorContent: { paddingHorizontal: 18, paddingVertical: 20 },
});
