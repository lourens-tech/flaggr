import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAdmin } from '../../../context/AdminContext';
import { getSuperAdminNavGroups } from '../../../navigation/adminNavConfig';
import { DesktopShell, type DesktopNavigator } from './DesktopShell';
import { SuperAdminActivityRail } from './SuperAdminActivityRail';
import type { PaletteMember } from './CommandPalette';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  support_agent: 'Support agent',
};

interface Props {
  activeKey: string;
  breadcrumb: string;
  headerRight?: React.ReactNode;
  // Set false to omit the Activity inspector entirely — e.g. on
  // already-dense screens like a chat thread.
  showRail?: boolean;
  // Set false for screens that manage their own internal scrolling (e.g. a
  // chat thread with a pinned composer) — see DesktopShell.
  scrollable?: boolean;
  children: React.ReactNode;
}

// DesktopShell for super-admin and support-agent screens. There's no single
// club to brand with, so the sidebar carries the Flagrr mark and there's no
// notifications bell; the Activity inspector shows the audit log (or, for a
// support agent, their own tickets).
export function SuperAdminDesktopFrame({ activeKey, breadcrumb, headerRight, showRail = true, scrollable = true, children }: Props) {
  const navigation = useNavigation() as unknown as DesktopNavigator;
  const { admin, searchSuperAdminMembers } = useAdmin();
  const isAgent = admin.role === 'support_agent';

  const memberSearch = useCallback(
    async (q: string): Promise<PaletteMember[]> =>
      (await searchSuperAdminMembers(q)).map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}`, sub: `${m.courseName} · ${m.email}` })),
    [searchSuperAdminMembers],
  );

  return (
    <DesktopShell
      navigation={navigation}
      brandName="Flagrr"
      brandSub={ROLE_LABELS[admin.role] ?? 'Super admin'}
      brandIsFlagrr
      navGroups={getSuperAdminNavGroups(admin.role)}
      activeKey={activeKey}
      userFirstName={admin.firstName}
      userLastName={admin.lastName}
      userRoleLabel={ROLE_LABELS[admin.role] ?? 'Super admin'}
      onAvatarPress={() => navigation.navigate('SuperAdminTabs', { screen: 'SuperAdminProfile' })}
      breadcrumb={breadcrumb}
      headerRight={headerRight}
      rightRail={showRail ? <SuperAdminActivityRail /> : undefined}
      searchMembers={isAgent ? undefined : memberSearch}
      onMember={isAgent ? undefined : (m) => navigation.navigate('SuperAdminMemberStats', { memberId: m.id })}
      scrollable={scrollable}
    >
      {children}
    </DesktopShell>
  );
}
