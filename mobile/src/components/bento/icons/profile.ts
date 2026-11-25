// Icons added for the profile area in the store-build phase 3 restyle. Same rules as
// BentoIcon.tsx: 24-unit grid, line only, path data copied from the Bento boards.
// Before adding one, check BentoIcon.tsx and the other files here: reuse, don't duplicate.
export const profileIcons = {
  // Help Center row, placeholder club in Choose Golf Club (G-E-ProfileLower, G-E-ClubList).
  questionCircle: ['M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16', 'M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 1.9-2.2 3.3', 'M12 16.6h.01'],
  // My Enquiries and Notification Preferences rows (G-E-ProfileLower).
  bellRound: ['M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14z', 'M10 20.5a2.1 2.1 0 0 0 4 0'],
  // Appearance (G-E-ProfileLower).
  moon: ['M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'],
  // Security (G-E-ProfileLower).
  lock: ['M6 10.5h12v9.5H6z', 'M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7'],
  // Terms and Privacy row, Help Center articles (G-E-ProfileLower, G-E-HelpLive).
  docText: ['M7 3.5h7l4 4v13H7z', 'M14 3.5v4h4', 'M9.5 12h6M9.5 15.5h6'],
  // Log Out button (G-E-ProfileLower).
  logOut: ['M14 4.5H6v15h8', 'M10.5 12H20', 'M16.5 8.5 20 12l-3.5 3.5'],
  // Password field eye toggle: hidden (G-E-PasswordSheet) and shown (AppLogin board).
  eyeClosed: ['M3 3l18 18', 'M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.2 6 9.2 6a15 15 0 0 1-2.6 3.3', 'M6.3 7.6A15.7 15.7 0 0 0 2.8 12S6 18 12 18a9.3 9.3 0 0 0 4.4-1.1'],
  eyeOpen: ['M2.8 12S6 6 12 6s9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6z', 'M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8'],
  // Enquiries, Contact link, Help Center support tile, General Feedback (G-E-EnquiriesLive, G-E-ContactFAQ).
  chatBubble: ['M4.5 5.5h15v10h-8l-4 3.5v-3.5h-3z'],
  // Empty My Enquiries (AppEnquiriesEmpty).
  chatBubbleWide: ['M5 5.5h14v10H10l-4 3.5v-3.5H5z'],
  // Enquiry type field and FAQ items (G-E-ContactFAQ, G-E-HelpLive).
  chevronDown: ['M6 9.5 12 15.5l6-6'],
  // Give Feedback categories (G-E-FeedbackSending): Bug Found, Improvement Idea.
  alertTriangle: ['M12 4 2.8 19.5h18.4z', 'M12 10v4.5', 'M12 17.2h.01'],
  sparkle: ['M12 4l1.8 4.8L18.5 10.5l-4.7 1.8L12 17l-1.8-4.7L5.5 10.5l4.7-1.7z'],
} as const satisfies Record<string, readonly string[]>;
