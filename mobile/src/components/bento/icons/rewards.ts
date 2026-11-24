// Icons added for the rewards area in the store-build phase 3 restyle. Same rules as
// BentoIcon.tsx: 24-unit grid, line only, path data copied from the Bento boards.
// Before adding one, check BentoIcon.tsx and the other files here: reuse, don't duplicate.
export const rewardsIcons = {
  // The magnifier on the "No rewards match your search." card (AppRewardsNoResults board);
  // a little larger than the kit's `search`.
  rewardsSearch: ['M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13', 'M15.5 15.5 20 20'],
  // The clock on the "No activity yet" card (AppActivityEmpty board).
  rewardsActivity: ['M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17', 'M12 7.5V12l3 2'],
} as const satisfies Record<string, readonly string[]>;
