import React, { useState, useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useOptionalAdminTheme, useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';

export interface SelectOption {
  label: string;
  value: string;
}

interface Props {
  placeholder: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  variant?: 'onDark' | 'onLight';
  disabled?: boolean;
}

export function SelectField({ placeholder, options, value, onChange, variant = 'onDark', disabled }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const admin = useOptionalAdminTheme();
  // The admin consoles always render fields on an opaque tile or sheet.
  const onDark = variant === 'onDark' && !admin;
  const selected = options.find((o) => o.value === value);
  const a = admin?.c;
  const adminField = a ? { height: 48, borderRadius: adminRadius.sm, backgroundColor: a.fill, borderWidth: StyleSheet.hairlineWidth, borderColor: a.edge, paddingHorizontal: 14 } : null;
  const adminText = a ? { ...adminFont.body, fontSize: 15.5 } : null;

  return (
    <>
      <TouchableOpacity
        style={[styles.container, onDark ? styles.containerOnDark : styles.containerOnLight, adminField]}
        accessibilityRole="button"
        accessibilityLabel={selected ? `${placeholder}: ${selected.label}` : placeholder}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.text,
            adminText,
            {
              color: selected
                ? onDark
                  ? colors.white
                  : colors.textPrimary
                : onDark
                  ? 'rgba(255,255,255,0.6)'
                  : colors.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={onDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={[styles.backdrop, a && { backgroundColor: a.scrim }]} activeOpacity={1} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, a && { backgroundColor: a.surface, borderTopLeftRadius: adminRadius.lg, borderTopRightRadius: adminRadius.lg }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, a && { ...adminFont.bodyBold, fontSize: 17 }]}>{placeholder}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionRow, a && { minHeight: 50, paddingVertical: 12 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.value === value }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, adminText]}>{item.label}</Text>
                  {item.value === value ? (
                    <Ionicons name="checkmark" size={18} color={a ? a.accentText : colors.clubGreen} />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 53,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  containerOnDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  containerOnLight: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder },
  text: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.body },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '60%',
  },
  sheetTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
});
}
