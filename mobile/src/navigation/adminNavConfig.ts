import type { Ionicons } from '@expo/vector-icons';
import type { AdminRole } from '../data/adminTypes';

export type NavIcon = keyof typeof Ionicons.glyphMap;

// A generic "go to this screen" pointer that works whether the destination
// lives directly on the Stack navigator or nested inside the Tab navigator
// (AdminTabs / SuperAdminTabs). Kept as plain strings/params rather than
// typed navigation props so the same config can drive both the course-admin
// and super-admin desktop sidebars.
export interface DesktopNavTarget {
  screen: string;
  nestedIn?: string; // e.g. 'AdminTabs' — navigate(nestedIn, { screen })
}

export interface DesktopNavItem {
  key: string; // unique id, also used to detect the active item
  label: string;
  icon: NavIcon;
  target: DesktopNavTarget;
}

export interface DesktopNavGroup {
  label: string;
  items: DesktopNavItem[];
}

function tab(nestedIn: string, screen: string): DesktopNavTarget {
  return { screen, nestedIn };
}
function stack(screen: string): DesktopNavTarget {
  return { screen };
}

// Mirrors exactly what's reachable today via AdminTabNavigator + AdminNavigator
// for a course_admin — regrouped for a sidebar instead of a flat tab bar.
// Detail/edit screens (AdminRewardEdit, AdminEnquiryChat, AdminStaffEdit,
// AdminCatalogItemEdit, AdminReportDetail, etc.) are reached from inside
// their parent screen, same as before, so they aren't top-level nav items.
export const ADMIN_NAV_GROUPS: DesktopNavGroup[] = [
  {
    label: 'Overview',
    items: [{ key: 'AdminDashboard', label: 'Dashboard', icon: 'grid-outline', target: tab('AdminTabs', 'AdminDashboard') }],
  },
  {
    label: 'Engagement',
    items: [
      { key: 'AdminEnquiries', label: 'Enquiries', icon: 'chatbubbles-outline', target: tab('AdminTabs', 'AdminEnquiries') },
      { key: 'AdminPush', label: 'Push Notifications', icon: 'megaphone-outline', target: tab('AdminTabs', 'AdminPush') },
      { key: 'AdminRewards', label: 'Rewards', icon: 'gift-outline', target: tab('AdminTabs', 'AdminRewards') },
      { key: 'AdminCatalog', label: 'Products & Activities', icon: 'pricetags-outline', target: stack('AdminCatalog') },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'AdminVouchers', label: 'Voucher Redemption', icon: 'qr-code-outline', target: tab('AdminTabs', 'AdminVouchers') },
      { key: 'AdminFraudOversight', label: 'Fraud Review', icon: 'flag-outline', target: stack('AdminFraudOversight') },
      { key: 'AdminMemberList', label: 'Member List', icon: 'people-outline', target: stack('AdminMemberList') },
    ],
  },
  {
    label: 'Settings',
    items: [
      { key: 'AdminStaffList', label: 'Staff & Club Admins', icon: 'people-circle-outline', target: stack('AdminStaffList') },
      { key: 'AdminCourseProfile', label: 'Course Profile', icon: 'business-outline', target: tab('AdminTabs', 'AdminCourseProfile') },
    ],
  },
];

// A `staff` account only ever sees Vouchers + its own profile (see
// AdminTabNavigator) — mirror that restriction in the sidebar.
export const ADMIN_STAFF_NAV_GROUPS: DesktopNavGroup[] = [
  {
    label: 'Operations',
    items: [{ key: 'AdminVouchers', label: 'Voucher Redemption', icon: 'qr-code-outline', target: tab('AdminTabs', 'AdminVouchers') }],
  },
  {
    label: 'Settings',
    items: [{ key: 'AdminStaffProfile', label: 'Profile', icon: 'person-circle-outline', target: tab('AdminTabs', 'AdminStaffProfile') }],
  },
];

export function getAdminNavGroups(role: AdminRole): DesktopNavGroup[] {
  return role === 'staff' ? ADMIN_STAFF_NAV_GROUPS : ADMIN_NAV_GROUPS;
}

// Mirrors SuperAdminTabNavigator + SuperAdminNavigator for a super_admin.
export const SUPER_ADMIN_NAV_GROUPS: DesktopNavGroup[] = [
  {
    label: 'Overview',
    items: [{ key: 'SuperAdminCourses', label: 'Courses', icon: 'business-outline', target: tab('SuperAdminTabs', 'SuperAdminCourses') }],
  },
  {
    label: 'Engagement',
    items: [
      { key: 'SuperAdminAds', label: 'Ads', icon: 'megaphone-outline', target: tab('SuperAdminTabs', 'SuperAdminAds') },
      { key: 'SuperAdminPush', label: 'Push Notifications', icon: 'notifications-outline', target: tab('SuperAdminTabs', 'SuperAdminPush') },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'SuperAdminReports', label: 'Reports', icon: 'bar-chart-outline', target: tab('SuperAdminTabs', 'SuperAdminReports') },
      { key: 'SuperAdminFraudOversight', label: 'Fraud Review', icon: 'flag-outline', target: stack('SuperAdminFraudOversight') },
      { key: 'SuperAdminSupport', label: 'Support Inbox', icon: 'headset-outline', target: tab('SuperAdminTabs', 'SuperAdminSupport') },
    ],
  },
  {
    label: 'Settings',
    items: [
      { key: 'SuperAdminAgents', label: 'Support Agents', icon: 'people-outline', target: stack('SuperAdminAgents') },
      { key: 'SuperAdminAuditLog', label: 'Audit Log', icon: 'time-outline', target: stack('SuperAdminAuditLog') },
      { key: 'SuperAdminProfile', label: 'Profile', icon: 'person-circle-outline', target: tab('SuperAdminTabs', 'SuperAdminProfile') },
    ],
  },
];

// A `support_agent` account only sees Support + its own profile (see
// SuperAdminTabNavigator).
export const SUPER_ADMIN_SUPPORT_AGENT_NAV_GROUPS: DesktopNavGroup[] = [
  {
    label: 'Operations',
    items: [{ key: 'SuperAdminSupport', label: 'Support Inbox', icon: 'headset-outline', target: tab('SuperAdminTabs', 'SuperAdminSupport') }],
  },
  {
    label: 'Settings',
    items: [{ key: 'SuperAdminProfile', label: 'Profile', icon: 'person-circle-outline', target: tab('SuperAdminTabs', 'SuperAdminProfile') }],
  },
];

export function getSuperAdminNavGroups(role: AdminRole): DesktopNavGroup[] {
  return role === 'support_agent' ? SUPER_ADMIN_SUPPORT_AGENT_NAV_GROUPS : SUPER_ADMIN_NAV_GROUPS;
}
