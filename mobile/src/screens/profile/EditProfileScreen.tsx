import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { bentoLayout as L, bentoType } from '../../theme/bento';
import { BentoButton, BentoField, BentoIcon, BentoScreen } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditProfileScreen({ navigation }: Props) {
  const { user, updateProfile } = useApp();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(user.dateOfBirth);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmedName = firstName.trim();
    const trimmedEmail = email.trim();
    const nextNameError = !trimmedName ? 'First name is required' : undefined;
    const nextEmailError = !EMAIL_PATTERN.test(trimmedEmail) ? 'Enter a valid email address' : undefined;
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    if (nextNameError || nextEmailError) return;

    setSaving(true);
    try {
      await updateProfile({
        firstName: trimmedName,
        lastName: lastName.trim(),
        email: trimmedEmail,
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth ?? undefined,
      });
      navigation.goBack();
    } catch (err) {
      showAlert('Couldn’t save changes', friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  // Form from G-E-EditFocus / G-E-EditErrors: labelled fields, one per line.
  return (
    <BentoScreen title="Edit Profile" onBack={() => navigation.goBack()}>
      <View style={{ height: 4 }} />
      <BentoField
        label="First Name"
        placeholder="First Name"
        value={firstName}
        onChangeText={(text) => {
          setFirstName(text);
          if (nameError) setNameError(undefined);
        }}
        error={nameError}
        aria-invalid={!!nameError}
      />
      <BentoField label="Last Name" placeholder="Last Name" value={lastName} onChangeText={setLastName} />
      <BentoField
        label="Email"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (emailError) setEmailError(undefined);
        }}
        error={emailError}
        aria-invalid={!!emailError}
      />
      <BentoField label="Phone Number" placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} maximumDate={new Date()} />
      <View style={{ height: 4 }} />
      <BentoButton label="Save Changes" nub onPress={handleSave} loading={saving} />
    </BentoScreen>
  );
}

// ── Date of Birth ─────────────────────────────────────────────────────────────
// Same behaviour as the shared DateField, drawn as a Bento field with the
// calendar on the right (G-E-EditFocus) and the iOS calendar card (G-E-DateIOS):
// iOS a centred card with the inline calendar and Done (changes apply as you
// pick, tapping outside closes); Android the system dialog (applies on OK);
// web the browser's date input (max today, can be cleared).

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

const PLACEHOLDER = 'Date of Birth';

function DateOfBirthField({ value, onChange, maximumDate }: { value: string | null; onChange: (v: string) => void; maximumDate: Date }) {
  const { t, scheme } = useBento();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = value ? parseISODate(value) : new Date(2000, 0, 1);

  const box: ViewStyle = {
    minHeight: L.controlHeight,
    borderRadius: L.fieldRadius,
    borderWidth: 1,
    borderColor: focused ? t.accent : t.hair,
    boxShadow: focused ? `0 0 0 3px ${t.accentSoft}` : undefined,
    backgroundColor: t.tile,
    paddingLeft: 16,
    paddingRight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  };
  const icon = (
    <View pointerEvents="none" style={{ position: 'absolute', right: 16, top: 15 }}>
      <BentoIcon name="calendar" size={20} color={t.muted} strokeWidth={1.7} />
    </View>
  );

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) onChange(toISODate(date));
    } else if (date) {
      onChange(toISODate(date));
    }
  };

  if (Platform.OS === 'web') {
    const input = React.createElement('input', {
      type: 'date',
      value: value ?? '',
      max: maximumDate.toISOString().slice(0, 10),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      'aria-label': PLACEHOLDER,
      style: {
        flex: 1,
        width: '100%',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: 16,
        color: value ? t.ink : t.muted,
        colorScheme: scheme,
      },
    });
    return (
      <View style={{ gap: 8 }}>
        <Text style={[bentoType.label, { color: t.ink }]}>Date of Birth</Text>
        {/* The browser draws its own calendar button at the right of the input. */}
        <View style={[box, { paddingRight: 16 }]}>{input}</View>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={[bentoType.label, { color: t.ink }]}>Date of Birth</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={PLACEHOLDER} accessibilityValue={value ? { text: selected.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) } : undefined} style={box}>
        <Text style={{ fontSize: 16, color: value ? t.ink : t.muted }}>
          {value ? selected.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : PLACEHOLDER}
        </Text>
        {icon}
      </Pressable>

      {open && Platform.OS === 'android' ? <DateTimePicker value={selected} mode="date" display="calendar" maximumDate={maximumDate} onChange={handleChange} /> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
          <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
            <View
              accessibilityViewIsModal
              accessibilityLabel={PLACEHOLDER}
              style={{ borderRadius: 26, backgroundColor: t.tile, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.45)' }}
            >
              <DateTimePicker value={selected} mode="date" display="inline" maximumDate={maximumDate} themeVariant={scheme} accentColor={t.accent} onChange={handleChange} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: t.hair, marginTop: 6 }}>
                <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Done" style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: t.accent }}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
