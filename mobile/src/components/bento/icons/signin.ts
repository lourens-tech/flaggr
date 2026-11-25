// Icons added for the signin area in the store-build phase 3 restyle. Same rules as
// BentoIcon.tsx: 24-unit grid, line only, path data copied from the Bento boards.
// Before adding one, check BentoIcon.tsx and the other files here: reuse, don't duplicate.
export const signinIcons = {
  // Password field "Show password" (AppLoginLight, AppSignUp2Light: the eye on a hidden password).
  eye: ['M2.8 12S6 6 12 6s9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6z', 'M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8'],
  // "Hide password" (kept board G-E-PasswordSheet: the struck-through eye next to a shown password).
  eyeOff: [
    'M3 3l18 18',
    'M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.2 6 9.2 6a15 15 0 0 1-2.6 3.3',
    'M6.3 7.6A15.7 15.7 0 0 0 2.8 12S6 18 12 18a9.3 9.3 0 0 0 4.4-1.1',
  ],
  // Golf Club picker field (kept boards G-A-SignUp1Club, G-A-ClubSheet).
  chevronDown: ['M6 9.5 12 15.5l6-6'],
} as const satisfies Record<string, readonly string[]>;
