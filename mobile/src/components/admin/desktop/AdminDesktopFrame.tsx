import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAdminTheme } from '../../../context/ThemeContext';
import { useAdmin } from '../../../context/AdminContext';
import { getAdminNavGroups } from '../../../navigation/adminNavConfig';
import { adminFont, adminRadius } from '../../../theme/admin';
import { DesktopShell, type DesktopNavigator } from './DesktopShell';
import { AdminActivityRail } from './AdminActivityRail';
import { AdminButton, Banner, Eyebrow, Muted } from '../ui';
import type { AdminNotification } from '../../../data/adminTypes';
import type { PaletteMember } from './CommandPalette';

const ROLE_LABELS: Record<string, string> = {
  course_admin: 'Course admin',
  staff: 'Staff',
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active plan',
  past_due: 'Payment failed',
};

interface Props {
  activeKey: string;
  breadcrumb: string;
  headerRight?: React.ReactNode;
  // Set false to omit the Activity inspector (e.g. on already-dense screens
  // like a chat thread or a long form).
  showRail?: boolean;
  // Set false for screens that manage their own internal scrolling (e.g. a
  // chat thread with a pinned composer) — see DesktopShell.
  scrollable?: boolean;
  children: React.ReactNode;
}

// DesktopShell for course-admin and staff screens — pulls admin/course/
// notification state from AdminContext so each screen only has to say which
// nav item is active and what the page is called.
export function AdminDesktopFrame({ activeKey, breadcrumb, headerRight, showRail = true, scrollable = true, children }: Props) {
  const { c } = useAdminTheme();
  const navigation = useNavigation() as unknown as DesktopNavigator;
  const { admin, course, notifications, unreadNotificationCount, markNotificationRead, loadNotifications, searchMembers } = useAdmin();
  const isStaff = admin.role === 'staff';

  // The Activity inspector's notifications are otherwise only loaded once,
  // at login — a long-lived desktop session (this frame wraps every admin
  // screen) would never pick up a new member enquiry/receipt without a
  // manual re-login. Poll while any admin screen is open, on top of the
  // login-time load.
  useEffect(() => {
    if (!showRail) return;
    const interval = setInterval(() => {
      loadNotifications().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [showRail, loadNotifications]);

  const handleActivityPress = (n: AdminNotification) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.enquiryId) navigation.navigate('AdminEnquiryChat', { enquiryId: n.enquiryId });
    else if (n.receiptId) navigation.navigate('AdminFraudOversight');
    else if (/enquiry/i.test(`${n.title} ${n.body}`)) navigation.navigate('AdminTabs', { screen: 'AdminEnquiries' });
  };

  const memberSearch = useCallback(
    async (q: string): Promise<PaletteMember[]> =>
      (await searchMembers(q)).map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}`, sub: `${m.email} · ${m.tier}` })),
    [searchMembers],
  );

  const pastDue = course.subscriptionStatus === 'past_due';
  const contactSupport = () => navigation.navigate('AdminSupportTickets');

  const rail =
    showRail && !isStaff ? (
      <AdminActivityRail
        notifications={notifications}
        onPress={handleActivityPress}
        onShowAll={() => navigation.navigate('AdminNotifications')}
        footer={
          <View style={[styles.plan, { backgroundColor: c.surface, borderColor: c.edge }]}>
            <Eyebrow>{SUBSCRIPTION_LABELS[course.subscriptionStatus ?? 'active'] ?? 'Active plan'}</Eyebrow>
            <Text style={[styles.planTitle, { color: c.ink }]}>Flagrr subscription</Text>
            <Muted>
              {pastDue
                ? 'Your last payment didn’t go through. Contact Flagrr support to update your billing details.'
                : 'Managed by the Flagrr team. Contact support with any billing questions.'}
            </Muted>
            <AdminButton label="Contact support" icon="headset-outline" onPress={contactSupport} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
          </View>
        }
      />
    ) : undefined;

  return (
    <DesktopShell
      navigation={navigation}
      brandName={course.name || 'Your club'}
      brandSub={ROLE_LABELS[admin.role] ?? 'Course admin'}
      brandLogoUrl={course.logoUrl}
      navGroups={getAdminNavGroups(admin.role)}
      activeKey={activeKey}
      userFirstName={admin.firstName}
      userLastName={admin.lastName}
      userRoleLabel={ROLE_LABELS[admin.role] ?? 'Course admin'}
      onAvatarPress={() => navigation.navigate('AdminTabs', { screen: isStaff ? 'AdminStaffProfile' : 'AdminCourseProfile' })}
      breadcrumb={breadcrumb}
      headerRight={headerRight}
      unreadNotificationCount={isStaff ? 0 : unreadNotificationCount}
      onBellPress={isStaff ? undefined : () => navigation.navigate('AdminNotifications')}
      rightRail={rail}
      poweredByFlagrr
      searchMembers={isStaff ? undefined : memberSearch}
      onMember={isStaff ? undefined : (m) => navigation.navigate('AdminMemberStats', { memberId: m.id })}
      scrollable={scrollable}
      topBanner={
        pastDue && !isStaff ? (
          <Banner
            tone="neg"
            title="Your last payment didn’t go through"
            body="Your club keeps working in the meantime. Contact Flagrr support to update your billing details."
            action={<AdminButton label="Contact support" onPress={contactSupport} />}
          />
        ) : undefined
      }
    >
      {children}
    </DesktopShell>
  );
}

const styles = StyleSheet.create({
  plan: { borderRadius: adminRadius.md, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  planTitle: { ...adminFont.bodyBold, fontSize: 16 },
});
