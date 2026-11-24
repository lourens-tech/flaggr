import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Thin, even line icons from the Bento boards (24-unit grid, round caps and
// joins). Add icons here as screens are restyled; no emoji, no filled glyphs.
const PATHS = {
  home: ['M4 10.6 12 4l8 6.6', 'M6 9.4V20h12V9.4', 'M10 20v-5h4v5'],
  course: ['M7 21V3.5', 'M7 4.2h10.5l-2.6 3.7 2.6 3.7H7'],
  scan: [
    'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8',
    'M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8',
    'M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16',
    'M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16',
    'M7.5 12h9',
  ],
  rewards: [
    'M4 9h16v4H4z',
    'M5.5 13v7h13v-7',
    'M12 9v11',
    'M12 9c-1.6-3.2-5.4-3.6-5.4-1.2C6.6 9 9 9 12 9c3 0 5.4 0 5.4-1.2C17.4 5.4 13.6 5.8 12 9',
  ],
  profile: ['M12 4.2a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2', 'M5 20.5c0-3.9 3.1-6.6 7-6.6s7 2.7 7 6.6'],
  // Not on the 4-tab boards; drawn to match for the live app's 6-tab layout.
  myGolf: ['M5 20V13', 'M10 20V8', 'M15 20v-9', 'M20 20V5', 'M3.5 20h18'],
  activity: ['M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16', 'M12 8v4.4l2.8 1.8'],
  back: ['M14.5 5.5 8 12l6.5 6.5'],
  close: ['M7 7l10 10', 'M17 7 7 17'],
  chevronRight: ['M9.5 5.5 16 12l-6.5 6.5'],
  arrowUpRight: ['M7.5 16.5 16.5 7.5', 'M9.5 7.5h7v7'],
  bell: ['M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14z', 'M10 20.5h4'],
  check: ['M5.5 12.5 10 17l8.5-9.5'],
  camera: ['M4 8h3.2l1.6-2.5h6.4L16.8 8H20v11H4z', 'M12 10.5a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4'],
  calendar: ['M4 7h16v10H4z', 'M4 10.5h16'],
  search: ['M10.5 4.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12', 'M15 15l4.5 4.5'],
  flame: ['M12 3.5c.6 3-2.8 4.6-2.8 8a2.8 2.8 0 0 0 5.6 0c0-1.2-.6-2-1-2.6 2.4.8 4.2 3.2 4.2 5.8a6 6 0 0 1-12 0c0-5 5-7 6-11.2z'],
  golfFlag: ['M8 20.5V4', 'M8 4.5h9l-2.4 3.4L17 11.3H8', 'M5 20.5h6'],
  gallery: ['M4.5 5.5h15v13h-15z', 'M4.5 15.5l4.2-4.2 3.6 3.6 2.4-2.4 4.8 4.8', 'M15.5 8.8a1.2 1.2 0 1 1 0 .1'],
  receipt: ['M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z', 'M9 8h6M9 11.5h6M9 15h3.5'],
  info: ['M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16', 'M12 11v5', 'M12 8h.01'],
} as const;

export type BentoIconName = keyof typeof PATHS;

export function BentoIcon({
  name,
  size = 23,
  color,
  strokeWidth = 1.6,
}: {
  name: BentoIconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    // Decorative: the button or row around it carries the accessible label.
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {PATHS[name].map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    </View>
  );
}
