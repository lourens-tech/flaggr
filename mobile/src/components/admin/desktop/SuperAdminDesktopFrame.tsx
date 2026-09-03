import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAdmin } from '../../../context/AdminContext';
import { getSuperAdminNavGroups } from '../../../navigation/adminNavConfig';
import { DesktopShell, type DesktopNavigator } from './DesktopShell';
import { SuperAdminActivityRail } from './SuperAdminActivityRail';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  support_agent: 'Support Agent',
};

interface Props {
  activeKey: string;
  breadcrumb: string;
  headerRight?: React.ReactNode;
  // Set false to omit the right-hand "Recent Activity" rail (audit log)
  // entirely — e.g. on already-dense screens like a chat thread.
  showRail?: boolean;
  // Set false for screens that manage their own internal scrolling (e.g. a
  // chat thread with a pinned composer) — see DesktopShell.
  scrollable?: boolean;
  children: React.ReactNode;
}

// Convenience wrapper around DesktopShell for super-admin screens — mirrors
// AdminDesktopFrame's course-admin version, but there's no single course to
// brand with and no notifications feed, so the bell is omitted and the rail
// shows the audit log instead.
export function SuperAdminDesktopFrame({ activeKey, breadcrumb, headerRight, showRail = true, scrollable = true, children }: Props) {
  const navigation = useNavigation() as unknown as DesktopNavigator;
  const { admin } = useAdmin();

  return (
    <DesktopShell
      navigation={navigation}
      brandName="Flagrr"
      brandSub={admin.role === 'support_agent' ? 'SUPPORT' : 'SUPER ADMIN'}
      navGroups={getSuperAdminNavGroups(admin.role)}
      activeKey={activeKey}
      userFirstName={admin.firstName}
      userLastName={admin.lastName}
      userRoleLabel={ROLE_LABELS[admin.role] ?? 'Super Admin'}
      onAvatarPress={() => navigation.navigate('SuperAdminTabs', { screen: 'SuperAdminProfile' })}
      breadcrumb={breadcrumb}
      headerRight={headerRight}
      rightRail={showRail ? <SuperAdminActivityRail /> : undefined}
      scrollable={scrollable}
    >
      {children}
    </DesktopShell>
  );
}
