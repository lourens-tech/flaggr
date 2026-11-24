import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useBento, useOptionalAdminTheme, useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';

interface Props extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  variant?: 'onDark' | 'onLight';
  error?: string;
}

// The browser's own focus outline is replaced by the field's accent ring.
const webNoOutline = { outlineStyle: 'none' } as unknown as { outlineWidth: number };

export function TextField({ icon, isPassword, variant = 'onDark', error, style, ...rest }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hidden, setHidden] = useState(!!isPassword);
  const [focused, setFocused] = useState(false);
  const onDark = variant === 'onDark';
  const admin = useOptionalAdminTheme();
  const { t: bt } = useBento();

  // In the admin consoles every field sits on an opaque tile or sheet, so
  // both variants share one look: a neutral fill, a hairline edge, an accent
  // ring while focused and a red one with its message on error.
  if (admin) {
    const { c } = admin;
    const { onFocus, onBlur, ...inputProps } = rest;
    return (
      <View>
        <View
          style={[
            styles.adminContainer,
            { backgroundColor: c.fill, borderColor: error ? c.neg : focused ? c.focus : c.edge },
            (error || focused) && { borderWidth: 1.5 },
          ]}
        >
          {icon ? <Ionicons name={icon} size={18} color={c.ink3} style={{ marginRight: spacing.sm }} /> : null}
          <TextInput
            placeholderTextColor={c.ink3}
            secureTextEntry={hidden}
            aria-invalid={!!error}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.adminInput, { color: c.ink }, webNoOutline, style]}
            {...inputProps}
          />
          {isPassword ? (
            <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
              <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.ink3} />
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? <Text style={[styles.adminError, { color: c.neg }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      </View>
    );
  }

  // On light (member forms): the Bento field. On dark (sign-in screens over
  // a photo) keeps its translucent look until those screens are restyled.
  if (!onDark) {
    const { onFocus, onBlur, ...inputProps } = rest;
    return (
      <View>
        <View
          style={[
            styles.bentoContainer,
            { backgroundColor: bt.tile, borderColor: error ? bt.danger : focused ? bt.accent : bt.hair },
          ]}
        >
          {icon ? <Ionicons name={icon} size={18} color={bt.muted} style={{ marginRight: spacing.sm }} /> : null}
          <TextInput
            placeholderTextColor={bt.muted}
            secureTextEntry={hidden}
            aria-invalid={!!error}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.bentoInput, { color: bt.ink }, webNoOutline, style]}
            {...inputProps}
          />
          {isPassword ? (
            <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
              <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={bt.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? (
          <Text style={[styles.bentoError, { color: bt.danger }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <View
        style={[
          styles.container,
          onDark ? styles.containerOnDark : styles.containerOnLight,
          error && styles.containerError,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={onDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
            style={{ marginRight: spacing.sm }}
          />
        ) : null}
        <TextInput
          placeholderTextColor={onDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary}
          secureTextEntry={hidden}
          style={[styles.input, { color: onDark ? colors.white : colors.textPrimary }, style]}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={onDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
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
  bentoContainer: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  bentoInput: { flex: 1, fontSize: 16, minHeight: 50 },
  bentoError: { fontSize: 13, marginTop: 6, marginLeft: 4 },
  containerOnDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  containerOnLight: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder },
  containerError: { borderWidth: 1, borderColor: colors.negative },
  input: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.body },
  errorText: {
    color: colors.negative,
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    marginTop: 4,
    marginLeft: 4,
  },
  adminContainer: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: adminRadius.sm, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  adminInput: { flex: 1, ...adminFont.body, fontSize: 15.5 },
  adminError: { ...adminFont.body, fontSize: 12.5, marginTop: 6, marginLeft: 4 },
});
}
