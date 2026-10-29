import React, { useState, useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
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

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DateField({ value, onChange, placeholder = 'Date of Birth', error, variant = 'onDark', maximumDate }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const onDark = variant === 'onDark';
  const selectedDate = value ? parseISODate(value) : new Date(2000, 0, 1);
  // In the admin consoles: the same neutral field as TextField (fill,
  // hairline edge, red edge on error) and a sheet-coloured picker. Member
  // screens get null here and keep their own look.
  const admin = useOptionalAdminTheme();
  const a = admin?.c;

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) onChange(toISODate(date));
    } else if (date) {
      onChange(toISODate(date));
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={
          a
            ? [styles.adminContainer, { backgroundColor: a.fill, borderColor: error ? a.neg : a.edge }, !!error && { borderWidth: 1.5 }]
            : [
                styles.container,
                onDark ? styles.containerOnDark : styles.containerOnLight,
                error && styles.containerError,
              ]
        }
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        {...(a ? { accessibilityRole: 'button' as const, accessibilityLabel: placeholder } : {})}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={a ? a.ink3 : onDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
          style={{ marginRight: spacing.sm }}
        />
        <Text
          style={
            a
              ? [styles.adminText, { color: value ? a.ink : a.ink3 }]
              : [
                  styles.text,
                  {
                    color: value
                      ? onDark
                        ? colors.white
                        : colors.textPrimary
                      : onDark
                        ? 'rgba(255,255,255,0.6)'
                        : colors.textSecondary,
                  },
                ]
          }
        >
          {value ? formatDisplay(value) : placeholder}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={a ? [styles.adminError, { color: a.neg }] : styles.errorText}>{error}</Text> : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="calendar"
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={a ? [styles.backdrop, { backgroundColor: a.scrim }] : styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
            <Pressable style={a ? [styles.sheet, { backgroundColor: a.sheet, borderRadius: adminRadius.lg }] : styles.sheet} onPress={() => {}}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                maximumDate={maximumDate}
                {...(admin ? { themeVariant: admin.scheme } : {})}
                onChange={handleChange}
              />
              <TouchableOpacity
                style={a ? [styles.doneButton, { minHeight: 44, justifyContent: 'center' }] : styles.doneButton}
                onPress={() => setOpen(false)}
                {...(a ? { accessibilityRole: 'button' as const } : {})}
              >
                <Text style={a ? [styles.adminDoneText, { color: a.accentText }] : styles.doneText}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </TouchableOpacity>
        </Modal>
      ) : null}
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
  text: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.body },
  errorText: {
    color: colors.negative,
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    marginTop: 4,
    marginLeft: 4,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  sheet: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md },
  doneButton: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm },
  doneText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.clubGreen },
  adminContainer: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: adminRadius.sm, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  adminText: { flex: 1, ...adminFont.body, fontSize: 15.5 },
  adminError: { ...adminFont.body, fontSize: 12.5, marginTop: 6, marginLeft: 4 },
  adminDoneText: { ...adminFont.bodySemiBold, fontSize: 16 },
});
}
