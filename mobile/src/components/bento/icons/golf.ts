// Icons added for the golf area in the store-build phase 3 restyle. Same rules as
// BentoIcon.tsx: 24-unit grid, line only, path data copied from the Bento boards.
// Before adding one, check BentoIcon.tsx and the other files here: reuse, don't duplicate.
export const golfIcons = {
  // Warning triangle on the load-error tiles (G-D-CourseError, G-D-MyGolfError, G-D-HoleError).
  golfWarning: ['M12 4 2.8 19.5h18.4z', 'M12 10v4.5', 'M12 17.2h.01'],
  // Search field on the Course tab (AppCourse, G-D-CourseAway).
  golfSearch: ['M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13', 'M15.5 15.5 20 20'],
  // "Play your first round" chip on My Golf (AppMyGolfEmpty).
  golfStatsBars: ['M5 20v-6', 'M10 20V8', 'M15 20v-9', 'M20 20V5'],
  // Hole view map controls and steppers (G-D-HoleEmpty).
  golfMinus: ['M5 12h14'],
  golfFit: ['M4.5 9V4.5H9', 'M15 4.5h4.5V9', 'M19.5 15v4.5H15', 'M9 19.5H4.5V15'],
  golfLayers: ['M12 4 3.5 8.5 12 13l8.5-4.5z', 'M3.5 12.5 12 17l8.5-4.5', 'M3.5 16.5 12 21l8.5-4.5'],
  // Scorecard button on the score bar (G-D-HoleEmpty).
  golfCard: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  // "Not saved yet · will retry" status (G-D-HoleOffline).
  golfOffline: ['M3 3l18 18', 'M8.5 16.5a5 5 0 0 1 7 0', 'M5 12.5a10 10 0 0 1 4.3-2.3', 'M2 9a15 15 0 0 1 4-2.5', 'M14.8 10.3A10 10 0 0 1 19 12.5', 'M12 20h.01'],
} as const satisfies Record<string, readonly string[]>;
