import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

interface Props extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  variant?: 'onDark' | 'onLight';
  error?: string;
}

export function TextField({ icon, isPassword, variant = 'onDark', error, style, ...rest }: Props) {
  const [hidden, setHidden] = useState(!!isPassword);
  const onDark = variant === 'onDark';

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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 53,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  containerOnDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  containerOnLight: { backgroundColor: '#F5F6F8', borderWidth: 1, borderColor: '#E5E7EB' },
  containerError: { borderWidth: 1, borderColor: colors.negative },
  input: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.body },
  errorText: {
    color: colors.negative,
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    marginTop: 4,
    marginLeft: 4,
  },
});
