// Icons added for the scan area in the store-build phase 3 restyle. Same rules as
// BentoIcon.tsx: 24-unit grid, line only, path data copied from the Bento boards.
// Before adding one, check BentoIcon.tsx and the other files here: reuse, don't duplicate.
export const scanIcons = {
  // The X on the camera's Close button and the full-screen receipt photo (AppScan, DlgPhoto);
  // slightly wider than BentoIcon's `close`.
  closeWide: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  // Camera torch (kept board G-B-ScanTorch: replaces AppScan's "Flash").
  torch: ['M9 3.5h6l-1 5h-4z', 'M10 8.5h4v11a2 2 0 0 1-4 0z', 'M12 12.5v2'],
  // Away-club notice on Review (AppReviewAway).
  pin: ['M12 21s6.5-6.2 6.5-11a6.5 6.5 0 0 0-13 0c0 4.8 6.5 11 6.5 11z', 'M12 7.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4'],
  // "View Photo" in Receipt History (AppReceipts).
  eye: ['M2.8 12S6 6 12 6s9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6z', 'M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8'],
} as const satisfies Record<string, readonly string[]>;
