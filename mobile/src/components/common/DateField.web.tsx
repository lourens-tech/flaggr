import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

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

  const input = React.createElement('input', {
    type: 'date',
    value: value ?? '',
    max: maximumDate ? maximumDate.toISOString().slice(0, 10) : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    'aria-label': placeholder,
    style: {
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
        style={[
          styles.container,
          onDark ? styles.containerOnDark : styles.containerOnLight,
          error && styles.containerError,
        ]}
      >
        {input}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
});
}
