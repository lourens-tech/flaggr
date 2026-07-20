import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';

export type FlagrrLogoColor = 'darkGreen' | 'clubGreen' | 'lime' | 'white';

// Full wordmark (script "Flagrr" + "LOYALTY" tagline baked into the artwork).
const LOGO_SOURCES: Record<FlagrrLogoColor, ImageSourcePropType> = {
  darkGreen: require('../../../assets/images/flagrr-logo-dark-green.png'),
  clubGreen: require('../../../assets/images/flagrr-logo-club-green.png'),
  lime: require('../../../assets/images/flagrr-logo-lime.png'),
  white: require('../../../assets/images/flagrr-logo-white.png'),
};

// "F" monogram + golf ball mark only, no tagline.
const ICON_SOURCES: Record<FlagrrLogoColor, ImageSourcePropType> = {
  darkGreen: require('../../../assets/images/flagrr-icon-dark-green.png'),
  clubGreen: require('../../../assets/images/flagrr-icon-club-green.png'),
  lime: require('../../../assets/images/flagrr-icon-lime.png'),
  white: require('../../../assets/images/flagrr-icon-white.png'),
};

const LOGO_ASPECT_RATIO = 2250 / 1168;
const ICON_ASPECT_RATIO = 2250 / 1921;

interface Props {
  color?: FlagrrLogoColor;
  size?: number; // rendered height in px; width follows the artwork's aspect ratio
  showTagline?: boolean; // true = full wordmark + "LOYALTY" tagline, false = icon mark only
  style?: StyleProp<ImageStyle>;
}

export function FlagrrLogo({ color = 'white', size = 44, showTagline = true, style }: Props) {
  const source = showTagline ? LOGO_SOURCES[color] : ICON_SOURCES[color];
  const aspectRatio = showTagline ? LOGO_ASPECT_RATIO : ICON_ASPECT_RATIO;

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={[{ height: size, width: size * aspectRatio }, style]}
    />
  );
}
