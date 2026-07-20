// Figma uses "Ws Paradose" (headings/numbers/buttons) and "Poppins" (body/labels),
// plus "Satoshi" in one small spot (tiny notification-badge number) that's still
// substituted with Poppins SemiBold since no Satoshi files have been provided.
//
// The Ws Paradose file we have is a foundry "Demo" build: it renders fine, but
// punctuation glyphs (., , ! ?) are swapped for the foundry's watermark symbol,
// and toLocaleString()-formatted numbers use "," as a thousands separator, so it
// can't safely be used anywhere punctuation or formatted numbers might appear.
// `heading`/`headingBold` stay on Fraunces (safe, unlimited glyph set) as the
// default; `headingDisplay` opts in to the real Ws Paradose for spots that are
// verified punctuation-free (static button labels, screen titles, bare headline
// words). Swap `heading` itself once a non-demo Ws Paradose file is available.
export const fontFamily = {
  heading: 'Fraunces_600SemiBold',
  headingBold: 'Fraunces_800ExtraBold',
  headingDisplay: 'WsParadose-Regular',
  body: 'Poppins_400Regular',
  bodyLight: 'Poppins_300Light',
  bodyMedium: 'Poppins_500Medium',
  bodySemiBold: 'Poppins_600SemiBold',
} as const;

export const fontsToLoad = {
  Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf'),
  Fraunces_800ExtraBold: require('@expo-google-fonts/fraunces/800ExtraBold/Fraunces_800ExtraBold.ttf'),
  'WsParadose-Regular': require('../../assets/fonts/WsParadose-Regular.ttf'),
  Poppins_300Light: require('@expo-google-fonts/poppins/300Light/Poppins_300Light.ttf'),
  Poppins_400Regular: require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
  Poppins_500Medium: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
  Poppins_600SemiBold: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
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
