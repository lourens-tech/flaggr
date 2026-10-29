import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useOptionalAdminTheme, useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';

interface Props {
  value: string | null; // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  variant?: 'onDark' | 'onLight';
  maximumDate?: Date;
}

// Native (iOS/Android) uses @react-native-community/datetimepicker, which has
// no web implementation — the browser's own <input type="date"> is the
// standard, accessible substitute here.
export function DateField({ value, onChange, placeholder = 'Date of Birth', error, variant = 'onDark', maximumDate }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const onDark = variant === 'onDark';
  // In the admin consoles: the same neutral field as TextField. Member
  // screens get null here and keep their own look.
  const admin = useOptionalAdminTheme();
  const a = admin?.c;

  const input = React.createElement('input', {
    type: 'date',
    value: value ?? '',
    max: maximumDate ? maximumDate.toISOString().slice(0, 10) : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    'aria-label': placeholder,
    style: a
      ? {
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: adminFont.body.fontFamily,
          fontSize: 15.5,
          color: value ? a.ink : a.ink3,
          colorScheme: admin?.scheme,
          width: '100%',
        }
      : {
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: fontFamily.body,
          fontSize: fontSize.body,
          color: onDark ? colors.white : colors.textPrimary,
          colorScheme: onDark ? 'dark' : 'light',
          width: '100%',
        },
  });

  return (
    <View>
      <View
        style={
          a
            ? [styles.adminContainer, { backgroundColor: a.fill, borderColor: error ? a.neg : a.edge }, !!error && { borderWidth: 1.5 }]
            : [
                styles.container,
                onDark ? styles.containerOnDark : styles.containerOnLight,
                error && styles.containerError,
              ]
        }
      >
        {input}
      </View>
      {error ? <Text style={a ? [styles.adminError, { color: a.neg }] : styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 53,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  containerOnDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  containerOnLight: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder },
  containerError: { borderWidth: 1, borderColor: colors.negative },
  errorText: {
    color: colors.negative,
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    marginTop: 4,
    marginLeft: 4,
  },
  adminContainer: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: adminRadius.sm, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  adminError: { ...adminFont.body, fontSize: 12.5, marginTop: 6, marginLeft: 4 },
});
}
