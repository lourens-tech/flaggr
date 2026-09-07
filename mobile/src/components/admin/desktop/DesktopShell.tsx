import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius, spacing } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';
import { useHover, hoverTransition } from '../../../hooks/useHover';
import type { DesktopNavGroup, DesktopNavTarget } from '../../../navigation/adminNavConfig';

const RAIL_BREAKPOINT = 1280;

// react-native-web passes unknown style keys straight through to the DOM —
// this suppresses the browser's default focus ring on the search input,
// which isn't part of RN's typed style props.
const webNoOutline = { outlineStyle: 'none' } as unknown as { outlineWidth: number };

export interface DesktopNavigator {
  navigate: (name: string, params?: object) => void;
}

function goTo(navigation: DesktopNavigator, target: DesktopNavTarget) {
  if (target.nestedIn) navigation.navigate(target.nestedIn, { screen: target.screen });
  else navigation.navigate(target.screen);
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
}

interface NavItemButtonProps {
  item: DesktopNavGroup['items'][number];
  isActive: boolean;
  navigation: DesktopNavigator;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function NavItemButton({ item, isActive, navigation, colors, styles }: NavItemButtonProps) {
  const [hovered, hoverHandlers] = useHover();
  const lit = isActive || hovered;
  return (
    <TouchableOpacity
      style={[styles.navItem, hoverTransition, isActive && styles.navItemActive, !isActive && hovered && styles.navItemHover]}
      onPress={() => goTo(navigation, item.target)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      {...hoverHandlers}
    >
      {isActive ? <View style={styles.navItemActiveBar} /> : null}
      <Ionicons name={item.icon} size={17} color={lit ? colors.white : 'rgba(255,255,255,0.78)'} />
      <Text style={[styles.navItemLabel, lit && styles.navItemLabelActive]} numberOfLines={1}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

interface Props {
  navigation: DesktopNavigator;
  brandName: string;
  brandSub: string;
  navGroups: DesktopNavGroup[];
  activeKey: string;
  userFirstName: string;
  userLastName: string;
  userRoleLabel: string;
  avatarImageUrl?: string | null;
  onAvatarPress: () => void;
  breadcrumb: string;
  headerRight?: React.ReactNode;
  unreadNotificationCount?: number;
  onBellPress?: () => void;
  rightRail?: React.ReactNode;
  // Square image card shown in the sidebar, under the nav menu items.
  sidebarCoverImageUrl?: string | null;
  // Set false for screens that manage their own internal scrolling (e.g. a
  // chat thread with a pinned composer) — the content area becomes a plain
  // flex column instead of a ScrollView, so children aren't nested inside
  // two scroll containers.
  scrollable?: boolean;
  children: React.ReactNode;
}

// Persistent chrome for the course-admin / super-admin desktop-web experience
// (see useIsDesktopNav — native app and narrow browser windows never render
// this). Each screen renders its own instance of this wrapper rather than it
// living above the navigator, so it can use the screen's own `navigation`
// prop directly; screen transitions are disabled on desktop (see
// AdminNavigator/SuperAdminNavigator) so re-mounting it per screen doesn't
// produce a visible flicker.
export function DesktopShell({
  navigation,
  brandName,
  brandSub,
  navGroups,
  activeKey,
  userFirstName,
  userLastName,
  userRoleLabel,
  avatarImageUrl,
  onAvatarPress,
  breadcrumb,
  headerRight,
  unreadNotificationCount = 0,
  onBellPress,
  rightRail,
  sidebarCoverImageUrl,
  scrollable = true,
  children,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const showRail = !!rightRail && width >= RAIL_BREAKPOINT;
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const userInitials = initials(userFirstName, userLastName);
  const [footHovered, footHoverHandlers] = useHover();
  const [bellHovered, bellHoverHandlers] = useHover();
  const [avatarHovered, avatarHoverHandlers] = useHover();

  return (
    <View style={styles.shell}>
      <View style={styles.sidebar}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>F</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName} numberOfLines={1}>{brandName}</Text>
            <Text style={styles.brandSub}>{brandSub}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {navGroups.map((group) => (
            <View key={group.label} style={styles.navGroup}>
              <Text style={styles.navGroupLabel}>{group.label}</Text>
              {group.items.map((item) => (
                <NavItemButton
                  key={item.key}
                  item={item}
                  isActive={item.key === activeKey}
                  navigation={navigation}
                  colors={colors}
                  styles={styles}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        {sidebarCoverImageUrl ? (
          <Image source={{ uri: sidebarCoverImageUrl }} style={styles.sidebarCover} />
        ) : null}

        <TouchableOpacity
          style={[styles.sidebarFoot, hoverTransition, footHovered && styles.sidebarFootHover]}
          onPress={onAvatarPress}
          activeOpacity={0.7}
          {...footHoverHandlers}
        >
          <View style={styles.footAvatar}>
            {avatarImageUrl ? (
              <Image source={{ uri: avatarImageUrl }} style={styles.footAvatarImage} />
            ) : (
              <Text style={styles.footAvatarText}>{userInitials}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.footName} numberOfLines={1}>{userFirstName} {userLastName}</Text>
            <Text style={styles.footRole}>{userRoleLabel}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        <View style={styles.topbar}>
          <Text style={styles.crumb} numberOfLines={1}>
            {brandName} <Text style={styles.crumbActive}>/ {breadcrumb}</Text>
          </Text>
          <View style={[styles.search, hoverTransition, searchFocused && styles.searchFocused]}>
            <Ionicons name="search" size={14} color={searchFocused ? colors.clubGreen : colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, webNoOutline]}
            />
          </View>
          <View style={{ flex: 1 }} />
          {headerRight}
          {onBellPress ? (
            <TouchableOpacity
              style={[styles.iconBtn, hoverTransition, bellHovered && styles.iconBtnHover]}
              onPress={onBellPress}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
              {...bellHoverHandlers}
            >
              <Ionicons name="notifications-outline" size={17} color={bellHovered ? colors.clubGreen : colors.textSecondary} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.dot}>
                  <Text style={styles.dotText}>{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.avatarBtn, hoverTransition, avatarHovered && styles.avatarBtnHover]}
            onPress={onAvatarPress}
            accessibilityLabel="Profile"
            accessibilityRole="button"
            {...avatarHoverHandlers}
          >
            {avatarImageUrl ? (
              <Image source={{ uri: avatarImageUrl }} style={styles.avatarBtnImage} />
            ) : (
              <Text style={styles.avatarBtnText}>{userInitials}</Text>
            )}
          </TouchableOpacity>
        </View>

        {scrollable ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.nonScrollContent]}>{children}</View>
        )}
      </View>

      {showRail ? (
        <View style={styles.rail}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.railContent}>
            {rightRail}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  sidebar: {
    width: 248,
    backgroundColor: colors.darkGreen,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 22 },
  brandMark: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontFamily: fontFamily.headingBold, fontSize: 16, color: colors.darkGreen },
  brandName: { fontFamily: fontFamily.heading, fontSize: 15, color: colors.white },
  brandSub: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, marginTop: 1 },
  navGroup: { marginBottom: 18 },
  navGroupLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.38)',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  navItemActive: { backgroundColor: 'rgba(205,222,92,0.14)' },
  navItemActiveBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.lime,
  },
  navItemHover: { backgroundColor: 'rgba(255,255,255,0.08)' },
  navItemLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 13.5, color: 'rgba(255,255,255,0.78)', flexShrink: 1 },
  navItemLabelActive: { color: colors.white },
  sidebarFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
  },
  sidebarFootHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
  footAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  footAvatarImage: { width: '100%', height: '100%' },
  footAvatarText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.darkGreen },
  sidebarCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  footName: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.white },
  footRole: { fontFamily: fontFamily.body, fontSize: 10.5, color: 'rgba(255,255,255,0.5)' },
  main: { flex: 1, minWidth: 0 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  crumb: { fontFamily: fontFamily.body, fontSize: 12, color: colors.textMuted, maxWidth: 260 },
  crumbActive: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 240,
  },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, color: colors.textPrimary, padding: 0 },
  searchFocused: { borderColor: colors.clubGreen, backgroundColor: colors.surface },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnHover: { borderColor: colors.clubGreen, backgroundColor: colors.mintBg },
  dot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.negative,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontFamily: fontFamily.bodySemiBold, fontSize: 9, color: colors.white },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mintBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarBtnHover: { transform: [{ scale: 1.08 }] },
  avatarBtnImage: { width: '100%', height: '100%' },
  avatarBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.clubGreen },
  content: { padding: 28, paddingBottom: 60, gap: spacing.lg, maxWidth: 1160 },
  nonScrollContent: { flex: 1, paddingBottom: 0 },
  rail: {
    width: 292,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  railContent: {
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
});
}
