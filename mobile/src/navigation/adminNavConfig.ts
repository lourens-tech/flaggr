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

// Every section a course_admin can reach, grouped for the desktop sidebar,
// the phone More tab and ⌘K search. Detail/edit screens (AdminRewardEdit,
// AdminEnquiryChat, AdminStaffEdit, AdminCatalogItemEdit, AdminReportDetail,
// etc.) are reached from inside their parent screen, so they aren't items
// here; they pass their parent's key as activeKey so it stays highlighted.
export const ADMIN_NAV_GROUPS: DesktopNavGroup[] = [
  {
    label: '',
    items: [{ key: 'AdminDashboard', label: 'Home', icon: 'home-outline', target: tab('AdminTabs', 'AdminDashboard') }],
  },
  {
    label: 'Members',
    items: [
      { key: 'AdminEnquiries', label: 'Enquiries', icon: 'chatbubble-outline', target: tab('AdminTabs', 'AdminEnquiries') },
      { key: 'AdminFraudOversight', label: 'Fraud Review', icon: 'flag-outline', target: stack('AdminFraudOversight') },
      { key: 'AdminMemberList', label: 'Member Roster', icon: 'people-outline', target: stack('AdminMemberList') },
    ],
  },
  {
    label: 'Rewards',
    items: [
      { key: 'AdminRewards', label: 'Rewards', icon: 'gift-outline', target: tab('AdminTabs', 'AdminRewards') },
      { key: 'AdminCatalog', label: 'Products and Activities', icon: 'pricetag-outline', target: stack('AdminCatalog') },
      { key: 'AdminVouchers', label: 'Vouchers', icon: 'qr-code-outline', target: tab('AdminTabs', 'AdminVouchers') },
    ],
  },
  {
    label: 'Messaging',
    items: [{ key: 'AdminPush', label: 'Push Notifications', icon: 'megaphone-outline', target: tab('AdminTabs', 'AdminPush') }],
  },
  {
    label: 'Club',
    items: [
      { key: 'AdminStaffList', label: 'Staff and Admins', icon: 'person-outline', target: stack('AdminStaffList') },
      { key: 'AdminCourseProfile', label: 'Club Settings', icon: 'business-outline', target: tab('AdminTabs', 'AdminCourseProfile') },
      { key: 'AdminSupportTickets', label: 'Flagrr Support', icon: 'headset-outline', target: stack('AdminSupportTickets') },
    ],
  },
];

// A `staff` account only sees Vouchers, Flagrr Support and its own profile
// (see AdminTabNavigator; enforced server-side by STAFF_ALLOWED_ACTIONS).
export const ADMIN_STAFF_NAV_GROUPS: DesktopNavGroup[] = [
  {
    label: '',
    items: [
      { key: 'AdminVouchers', label: 'Vouchers', icon: 'qr-code-outline', target: tab('AdminTabs', 'AdminVouchers') },
      { key: 'AdminSupportTickets', label: 'Flagrr Support', icon: 'headset-outline', target: stack('AdminSupportTickets') },
      { key: 'AdminStaffProfile', label: 'Profile', icon: 'person-circle-outline', target: tab('AdminTabs', 'AdminStaffProfile') },
    ],
  },
];

export function getAdminNavGroups(role: AdminRole): DesktopNavGroup[] {
  return role === 'staff' ? ADMIN_STAFF_NAV_GROUPS : ADMIN_NAV_GROUPS;
}

// Every super_admin section. Profile lives on the account button.
export const SUPER_ADMIN_NAV_GROUPS: DesktopNavGroup[] = [
  {
    label: 'Clubs',
    items: [
      { key: 'SuperAdminCourses', label: 'Courses', icon: 'business-outline', target: tab('SuperAdminTabs', 'SuperAdminCourses') },
      { key: 'SuperAdminCourseMaps', label: 'Course Maps', icon: 'map-outline', target: stack('SuperAdminCourseMaps') },
    ],
  },
  {
    label: 'Insights',
    items: [{ key: 'SuperAdminReports', label: 'Reports', icon: 'bar-chart-outline', target: tab('SuperAdminTabs', 'SuperAdminReports') }],
  },
  {
    label: 'Engagement',
    items: [
      { key: 'SuperAdminAds', label: 'Ads', icon: 'albums-outline', target: tab('SuperAdminTabs', 'SuperAdminAds') },
      { key: 'SuperAdminPush', label: 'Push Notifications', icon: 'megaphone-outline', target: tab('SuperAdminTabs', 'SuperAdminPush') },
    ],
  },
  {
    label: 'Trust and support',
    items: [
      { key: 'SuperAdminFraudOversight', label: 'Fraud Review', icon: 'flag-outline', target: stack('SuperAdminFraudOversight') },
      { key: 'SuperAdminSupport', label: 'Support Inbox', icon: 'headset-outline', target: tab('SuperAdminTabs', 'SuperAdminSupport') },
    ],
  },
  {
    label: 'Admin',
    items: [
      { key: 'SuperAdminAgents', label: 'Support Agents', icon: 'people-outline', target: stack('SuperAdminAgents') },
      { key: 'SuperAdminAuditLog', label: 'Audit Log', icon: 'time-outline', target: stack('SuperAdminAuditLog') },
    ],
  },
];

// A `support_agent` account only sees the Support inbox and its own profile
// (see SuperAdminTabNavigator; enforced server-side).
export const SUPER_ADMIN_SUPPORT_AGENT_NAV_GROUPS: DesktopNavGroup[] = [
  {
    label: '',
    items: [
      { key: 'SuperAdminSupport', label: 'Inbox', icon: 'headset-outline', target: tab('SuperAdminTabs', 'SuperAdminSupport') },
      { key: 'SuperAdminProfile', label: 'Profile', icon: 'person-circle-outline', target: tab('SuperAdminTabs', 'SuperAdminProfile') },
    ],
  },
];

export function getSuperAdminNavGroups(role: AdminRole): DesktopNavGroup[] {
  return role === 'support_agent' ? SUPER_ADMIN_SUPPORT_AGENT_NAV_GROUPS : SUPER_ADMIN_NAV_GROUPS;
}
