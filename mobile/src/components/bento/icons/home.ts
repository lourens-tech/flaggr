// Icons added for the home area in the store-build phase 3 restyle. Same rules as
// BentoIcon.tsx: 24-unit grid, line only, path data copied from the Bento boards.
// Before adding one, check BentoIcon.tsx and the other files here: reuse, don't duplicate.
export const homeIcons = {
  // The unread-notification bell in a Notifications row and in its empty state
  // (kept board G-A-NotifGroups / G-A-NotifEmpty). Not the base `bell`: the boards
  // draw this one with a rounded clapper.
  notificationBell: ['M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14z', 'M10 20.5a2.1 2.1 0 0 0 4 0'],
  // The Notifications header's "Notification Preferences" button (AppNotifications board).
  // Not the base `settings` cog: the board draws a sun-like gear.
  notificationSettings: ['M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8', 'M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7'],
} as const satisfies Record<string, readonly string[]>;
