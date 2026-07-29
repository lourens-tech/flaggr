// Set EXPO_PUBLIC_STORE_BUILD=1 in the eas.json build profile used for
// public App Store / Play Store submissions. course_admin, staff,
// super_admin, and support_agent continue to reach their login exclusively
// through the web deployment — the store binary is member-only.
export const IS_STORE_BUILD = process.env.EXPO_PUBLIC_STORE_BUILD === '1';
