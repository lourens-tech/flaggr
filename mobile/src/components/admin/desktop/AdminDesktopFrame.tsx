import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fontFamily } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';
import { useAdmin } from '../../../context/AdminContext';
import { getAdminNavGroups } from '../../../navigation/adminNavConfig';
import { DesktopShell, type DesktopNavigator } from './DesktopShell';
import { AdminActivityRail } from './AdminActivityRail';
import { useHover, hoverTransition } from '../../../hooks/useHover';
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
  const { admin, course, notifications, unreadNotificationCount, markNotificationRead } = useAdmin();
  const [supportHovered, supportHoverHandlers] = useHover();

  const handleActivityPress = (n: AdminNotification) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.enquiryId) navigation.navigate('AdminEnquiryChat', { enquiryId: n.enquiryId });
    else if (n.receiptId) navigation.navigate('AdminFraudOversight');
    else if (/enquiry/i.test(`${n.title} ${n.body}`)) navigation.navigate('AdminEnquiries');
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
          <TouchableOpacity
            style={[styles.subSupportBtn, hoverTransition, supportHovered && styles.subSupportBtnHover]}
            onPress={() => navigation.navigate('AdminSupportTickets')}
            activeOpacity={0.8}
            {...supportHoverHandlers}
          >
            <Ionicons name="headset-outline" size={14} color={colors.darkGreen} />
            <Text style={styles.subSupportBtnText}>Contact Support</Text>
          </TouchableOpacity>
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
      avatarImageUrl={course.logoUrl}
      onAvatarPress={() => navigation.navigate(admin.role === 'staff' ? 'AdminStaffProfile' : 'AdminCourseProfile')}
      breadcrumb={breadcrumb}
      headerRight={headerRight}
      unreadNotificationCount={unreadNotificationCount}
      onBellPress={() => navigation.navigate('AdminNotifications')}
      rightRail={rail}
      sidebarCoverImageUrl={course.coverImageUrl}
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
  subSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.lime,
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 8,
  },
  subSupportBtnHover: { backgroundColor: colors.white, transform: [{ translateY: -1 }] },
  subSupportBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.darkGreen },
});
}
