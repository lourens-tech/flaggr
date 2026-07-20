// Figma uses "Ws Paradose" (headings/numbers/buttons) and "Poppins" (body/labels),
// plus "Satoshi" in one small spot. Those first and third are premium fonts we don't
// have license/files for, so they're substituted with visually-close Google Fonts:
// Ws Paradose -> Fraunces (elegant serif, same warm/premium feel)
// Satoshi     -> Poppins SemiBold (only used for a tiny notification-badge number)
// Swap the `heading`/`logo` family below once real font files are provided.
export const fontFamily = {
  heading: 'Fraunces_600SemiBold',
  headingItalic: 'Fraunces_600SemiBold_Italic',
  headingBold: 'Fraunces_800ExtraBold',
  body: 'Poppins_400Regular',
  bodyLight: 'Poppins_300Light',
  bodyMedium: 'Poppins_500Medium',
  bodySemiBold: 'Poppins_600SemiBold',
  logo: 'Pacifico_400Regular',
} as const;

export const fontsToLoad = {
  Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf'),
  Fraunces_600SemiBold_Italic: require('@expo-google-fonts/fraunces/600SemiBold_Italic/Fraunces_600SemiBold_Italic.ttf'),
  Fraunces_800ExtraBold: require('@expo-google-fonts/fraunces/800ExtraBold/Fraunces_800ExtraBold.ttf'),
  Poppins_300Light: require('@expo-google-fonts/poppins/300Light/Poppins_300Light.ttf'),
  Poppins_400Regular: require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
  Poppins_500Medium: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
  Poppins_600SemiBold: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
  Pacifico_400Regular: require('@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf'),
};

// Type scale distilled from the Figma frames (Home, Landing, Rewards Shop, etc.)
export const fontSize = {
  hero: 44, // landing headline ("Play. Earn. Redeem. Repeat.") — scaled down from the 72px spec for typical phone widths
  displayValue: 32, // large stat numbers (e.g. points balance)
  title: 24, // screen/section headings
  cardTitle: 16,
  button: 16,
  body: 14,
  label: 13,
  small: 12,
  tiny: 10,
} as const;
