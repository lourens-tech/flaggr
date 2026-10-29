import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useOptionalAdminTheme, useTheme, type ThemePreference } from '../../context/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { Segmented } from '../admin/ui/primitives';

const OPTIONS: Array<{ label: string; value: ThemePreference }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const ADMIN_OPTIONS = OPTIONS.map((o) => ({ key: o.value, label: o.label }));

interface Props {
  onChange: (preference: ThemePreference) => void;
  disabled?: boolean;
}

// A three-way segmented control for the dark-mode preference — used on the
// member, course-admin, and staff profile screens alike, since all three
// account types sync the same 'system' | 'light' | 'dark' choice to their
// own record (see ThemeContext / AppContext.updateThemePreference /
// AdminContext.updateThemePreference). Inside the admin consoles it renders
// as the admin kit's Segmented control (neutral selection); the member app
// keeps its own look.
export function ThemeToggleRow({ onChange, disabled }: Props) {
  const { preference, colors } = useTheme();
  const admin = useOptionalAdminTheme();

  if (admin) {
    return (
      // Segmented has no disabled state, so block presses while a change saves.
      <View pointerEvents={disabled ? 'none' : 'auto'} accessibilityState={{ disabled: !!disabled }}>
        <Segmented
          options={ADMIN_OPTIONS}
          value={preference}
          onChange={onChange}
          accessibilityLabel="Theme"
          fullWidth
        />
      </View>
    );
  }

  return (
    <View style={[styles.row, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.pill, active && { backgroundColor: colors.clubGreen }]}
            onPress={() => onChange(opt.value)}
            disabled={disabled}
            accessibilityLabel={`Theme ${opt.label}`}
            accessibilityRole="button"
          >
            <Text style={[styles.label, { color: active ? colors.white : colors.textPrimary }]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, gap: 4, borderWidth: 1 },
  pill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
  label: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny },
});
