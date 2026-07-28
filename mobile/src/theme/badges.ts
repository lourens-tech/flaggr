import type { ThemeColors } from './colors';

export interface BadgeStyle {
  label: string;
  bg: string;
  fg: string;
}

// Shared status-badge palette: 'open'/'pending' (theme-flipped warning tint),
// 'in_progress' (existing mint/clubGreen tokens), 'resolved' (existing
// input-border/textSecondary tokens) — reused across every support-ticket
// and enquiry list/thread screen (member, course_admin, super_admin) so
// they can't drift out of sync with each other or with dark mode.
export function ticketStatusBadges(colors: ThemeColors): Record<'open' | 'in_progress' | 'resolved', BadgeStyle> {
  return {
    open: { label: 'Open', bg: colors.warningBg, fg: colors.warning },
    in_progress: { label: 'In Progress', bg: colors.mintBg, fg: colors.clubGreen },
    resolved: { label: 'Resolved', bg: colors.inputBorder, fg: colors.textSecondary },
  };
}

export function enquiryStatusBadges(colors: ThemeColors): Record<'pending' | 'in_progress' | 'resolved', BadgeStyle> {
  return {
    pending: { label: 'Pending', bg: colors.warningBg, fg: colors.warning },
    in_progress: { label: 'Chat in Progress', bg: colors.mintBg, fg: colors.clubGreen },
    resolved: { label: 'Resolved', bg: colors.inputBorder, fg: colors.textSecondary },
  };
}

export function priorityBadges(colors: ThemeColors): Record<'low' | 'normal' | 'high' | 'urgent', BadgeStyle> {
  return {
    urgent: { label: 'Urgent', bg: colors.dangerBg, fg: colors.negative },
    high: { label: 'High', bg: colors.warningBg, fg: colors.warning },
    normal: { label: 'Normal', bg: colors.mintBgAlt, fg: colors.textSecondary },
    low: { label: 'Low', bg: colors.inputBorder, fg: colors.textSecondary },
  };
}
