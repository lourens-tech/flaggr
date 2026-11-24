import React from 'react';
import { StyleSheet } from 'react-native';
import { type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, fontSize } from '../../theme';
import { BentoSheet } from '../bento/BentoSheet';

// A bottom sheet over the whole screen, used for the scorecard, the bag and
// the round details during a round. One open at a time; tapping outside, the
// close button or the system back gesture closes it. Drawn as a Bento sheet
// (components/bento/BentoSheet); the props and behaviour are unchanged.
export function GolfSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <BentoSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose} footer={footer}>
      {children}
    </BentoSheet>
  );
}

export const sheetText = (colors: ThemeColors) =>
  StyleSheet.create({
    body: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
    strong: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
    small: { fontFamily: fontFamily.body, fontSize: fontSize.small - 0.5, color: colors.textMuted },
  });
