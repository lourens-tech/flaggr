import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, PageTitle, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminAgentCreate'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SuperAdminAgentCreateScreen({ navigation }: Props) {
  const isDesktop = useIsDesktopNav();
  const { createSupportAgent } = useAdmin();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !email.trim()) {
      showAlert('Missing info', 'First name and email are required.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      showAlert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      await createSupportAgent({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t add support agent', message);
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <>
      <TextField placeholder="First Name" variant="onLight" value={firstName} onChangeText={setFirstName} />
      <View style={styles.gap} />
      <TextField placeholder="Last Name" variant="onLight" value={lastName} onChangeText={setLastName} />
      <View style={styles.gap} />
      <TextField
        placeholder="Email"
        variant="onLight"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.actions}>
        <AdminButton label="Send Invite" variant="accent" size="lg" onPress={handleSave} loading={saving} />
      </View>
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminAgents" breadcrumb="New Support Agent" showRail={false}>
        <PageTitle>New Support Agent</PageTitle>
        <Tile style={styles.dCard}>{form}</Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="New Support Agent" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Tile>{form}</Tile>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: 64 },
  gap: { height: 14 },
  actions: { marginTop: 22, alignItems: 'flex-start' },
  dCard: { marginTop: 18, maxWidth: 520, padding: 22 },
});
