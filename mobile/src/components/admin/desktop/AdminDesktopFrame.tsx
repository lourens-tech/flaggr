import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fontFamily } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';
import { useAdmin } from '../../../context/AdminContext';
import { getAdminNavGroups } from '../../../navigation/adminNavConfig';
import { DesktopShell, type DesktopNavigator } from './DesktopShell';
import { AdminActivityRail } from './AdminActivityRail';
import type { AdminNotification } from '../../../data/adminTypes';

const ROLE_LABELS: Record<string, string> = {
  course_admin: 'Course Admin',
  staff: 'Staff',
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active Plan',
  past_due: 'Payment Failed',
};

interface Props {
  activeKey: string;
  breadcrumb: string;
  headerRight?: React.ReactNode;
  // Set false to omit the right-hand "Recent Activity" rail entirely (e.g.
  // on already-dense screens like a chat thread or a long form).
  showRail?: boolean;
  // Set false for screens that manage their own internal scrolling (e.g. a
  // chat thread with a pinned composer) — see DesktopShell.
  scrollable?: boolean;
  children: React.ReactNode;
}

// Convenience wrapper around DesktopShell for course-admin screens — pulls
// admin/course/notification state from AdminContext so each screen only has
// to say which nav item is active and what the page is called.
export function AdminDesktopFrame({ activeKey, breadcrumb, headerRight, showRail = true, scrollable = true, children }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation() as unknown as DesktopNavigator;
  const { admin, course, notifications, unreadNotificationCount } = useAdmin();

  const handleActivityPress = (n: AdminNotification) => {
    if (n.enquiryId) navigation.navigate('AdminEnquiryChat', { enquiryId: n.enquiryId });
    else if (n.receiptId) navigation.navigate('AdminFraudOversight');
  };

  const rail = showRail ? (
    <AdminActivityRail
      notifications={notifications}
      onPress={handleActivityPress}
      footer={
        <View style={styles.subCard}>
          <Text style={styles.subPlan}>{(SUBSCRIPTION_LABELS[course.subscriptionStatus ?? 'active'] ?? 'Active Plan').toUpperCase()}</Text>
          <Text style={styles.subTitle}>Flagrr Subscription</Text>
          <Text style={styles.subBody}>
            {course.subscriptionStatus === 'past_due'
              ? 'Your last payment failed. Contact Flagrr support to update your billing details.'
              : 'Managed by the Flagrr team. Contact support with any billing questions.'}
          </Text>
          <Text style={styles.subRate}>
            Conversion rate <Text style={styles.subRateValue}>{course.fbPerRand} FC</Text> / R1
          </Text>
        </View>
      }
    />
  ) : undefined;

  return (
    <DesktopShell
      navigation={navigation}
      brandName={course.name || 'Course Admin'}
      brandSub="COURSE ADMIN"
      navGroups={getAdminNavGroups(admin.role)}
      activeKey={activeKey}
      userFirstName={admin.firstName}
      userLastName={admin.lastName}
      userRoleLabel={ROLE_LABELS[admin.role] ?? 'Course Admin'}
      onAvatarPress={() => navigation.navigate(admin.role === 'staff' ? 'AdminStaffProfile' : 'AdminCourseProfile')}
      breadcrumb={breadcrumb}
      headerRight={headerRight}
      unreadNotificationCount={unreadNotificationCount}
      onBellPress={() => navigation.navigate('AdminNotifications')}
      rightRail={rail}
      scrollable={scrollable}
    >
      {children}
    </DesktopShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  subCard: {
    backgroundColor: colors.darkGreen,
    borderRadius: 16,
    padding: 18,
    gap: 6,
  },
  subPlan: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lime,
    color: colors.darkGreen,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 4,
  },
  subTitle: { fontFamily: fontFamily.heading, fontSize: 16, color: colors.white },
  subBody: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 17 },
  subRate: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  subRateValue: { fontFamily: fontFamily.heading, fontSize: 15, color: colors.lime },
});
}
