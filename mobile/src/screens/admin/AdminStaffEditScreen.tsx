import React, { useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminButton, PageTitle, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminStaff } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminStaffEdit'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WIZARD_STEP_COUNT = 3;

export function AdminStaffEditScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { staff, createStaff, updateStaff, deleteStaff } = useAdmin();
  const existing = staff.find((s) => s.id === route.params?.staffId);

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Adding a new staff member walks through a short wizard (details, review,
  // success) rather than one plain form — editing an existing one keeps the
  // simple form below, since there's nothing to "confirm" there.
  const [wizardStep, setWizardStep] = useState(0);
  const [createdStaff, setCreatedStaff] = useState<AdminStaff | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit Staff Member' : 'New Staff Member' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateDetails = () => {
    if (!firstName.trim() || !email.trim()) {
      showAlert('Missing info', 'First name and email are required.');
      return false;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      showAlert('Invalid email', 'Enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleSaveEdit = async () => {
    if (!validateDetails()) return;
    if (newPassword && newPassword.length < 8) {
      showAlert('Invalid password', 'New password must be at least 8 characters.');
      return;
    }
    if (!existing) return;

    setSaving(true);
    try {
      await updateStaff({
        id: existing.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password: newPassword.trim() || undefined,
      });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save staff member', message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async () => {
    setSaving(true);
    try {
      const created = await createStaff({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
      setCreatedStaff(created);
      setWizardStep(2);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t add staff member', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    showAlert('Remove this staff member?', 'They will lose access immediately and their account will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteStaff(existing.id);
            navigation.goBack();
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove staff member', message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // --- Editing an existing staff member: unchanged simple form ---
  if (existing) {
    const editForm = (
      <>
        <TextField placeholder="First Name" variant="onLight" value={firstName} onChangeText={setFirstName} />
        <View style={styles.fieldGap} />
        <TextField placeholder="Last Name" variant="onLight" value={lastName} onChangeText={setLastName} />
        <View style={styles.fieldGap} />
        <TextField
          placeholder="Email"
          variant="onLight"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.helpText}>
          Just used to send login details — staff log in with a username instead, so this can be shared by more
          than one staff member (e.g. a shared shop inbox).
        </Text>

        <Text style={styles.sectionTitle}>Login Username</Text>
        <View style={styles.usernameBox}>
          <Text style={styles.usernameText}>{existing.username}</Text>
        </View>
        <Text style={styles.sectionTitle}>Reset Password</Text>
        <TextField
          placeholder="New Password (leave blank to keep current)"
          variant="onLight"
          isPassword
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <View style={styles.actionGap} />
        <AdminButton label="Save Changes" variant="accent" size="lg" fullWidth onPress={handleSaveEdit} loading={saving} />

        <AdminButton
          label="Remove Staff Member"
          variant="danger"
          size="lg"
          fullWidth
          onPress={handleDelete}
          disabled={saving}
          style={styles.deleteButton}
        />
      </>
    );

    if (isDesktop) {
      return (
        <AdminDesktopFrame activeKey="AdminStaffList" breadcrumb="Edit Staff Member" showRail={false}>
          <PageTitle>Edit Staff Member</PageTitle>
          <Tile style={styles.dFormTile}>{editForm}</Tile>
        </AdminDesktopFrame>
      );
    }

    return (
      <View style={styles.screen}>
        <AdminMobileHeader title="Edit Staff Member" onBack={() => navigation.goBack()} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Tile>{editForm}</Tile>
        </ScrollView>
      </View>
    );
  }

  // --- Adding a new staff member: details -> review -> success wizard ---
  const progressRow = (
    <View style={[styles.progressRow, isDesktop && styles.progressRowDesktop]}>
      {Array.from({ length: WIZARD_STEP_COUNT }).map((_, i) => (
        <View key={i} style={[styles.progressDot, i <= wizardStep && styles.progressDotActive]} />
      ))}
    </View>
  );

  const wizardBody = (
    <>
        {wizardStep === 0 ? (
          <>
            <Text style={styles.title}>Staff Details</Text>
            <View style={styles.fieldGap} />
            <TextField placeholder="First Name" variant="onLight" value={firstName} onChangeText={setFirstName} />
            <View style={styles.fieldGap} />
            <TextField placeholder="Last Name" variant="onLight" value={lastName} onChangeText={setLastName} />
            <View style={styles.fieldGap} />
            <TextField
              placeholder="Email"
              variant="onLight"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.helpText}>
              Just used to send login details — staff log in with a username instead, so this can be shared by more
              than one staff member (e.g. a shared shop inbox).
            </Text>
            <View style={styles.actionGap} />
            <AdminButton
              label="Next: Review"
              variant="accent"
              size="lg"
              fullWidth
              onPress={() => {
                if (validateDetails()) setWizardStep(1);
              }}
            />
          </>
        ) : null}

        {wizardStep === 1 ? (
          <>
            <Text style={styles.title}>Review and Send</Text>
            <View style={styles.fieldGap} />
            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Name</Text>
                <Text style={styles.reviewValue}>{firstName.trim()} {lastName.trim()}</Text>
              </View>
              <View style={[styles.reviewRow, styles.reviewRowDivider]}>
                <Text style={styles.reviewLabel}>Email</Text>
                <Text style={styles.reviewValue}>{email.trim()}</Text>
              </View>
            </View>
            <Text style={styles.helpText}>
              A username will be generated and emailed to them, along with a temporary password and a login link.
              They'll be asked to set their own password the first time they log in.
            </Text>
            <View style={styles.actionGap} />
            <AdminButton label="Send Invite" variant="accent" size="lg" fullWidth onPress={handleSendInvite} loading={saving} />
            <AdminButton
              label="Back"
              variant="glass"
              size="lg"
              fullWidth
              onPress={() => setWizardStep(0)}
              disabled={saving}
              style={styles.backButton}
            />
          </>
        ) : null}

        {wizardStep === 2 && createdStaff ? (
          <>
            <Ionicons name="checkmark-circle" size={56} color={c.accent} style={styles.successIcon} />
            <Text style={[styles.title, styles.titleCentered]}>Staff Member Added</Text>
            <Text style={styles.helpTextCentered}>
              {createdStaff.firstName} has been emailed their login details.
            </Text>
            <Text style={styles.sectionTitle}>Login Username</Text>
            <View style={styles.usernameBox}>
              <Text style={styles.usernameText}>{createdStaff.username}</Text>
            </View>
            <View style={styles.actionGap} />
            <AdminButton label="Done" variant="accent" size="lg" fullWidth onPress={() => navigation.goBack()} />
          </>
        ) : null}
    </>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminStaffList" breadcrumb="New Staff Member" showRail={false}>
        <PageTitle>New Staff Member</PageTitle>
        <Tile style={styles.dFormTile}>
          {progressRow}
          {wizardBody}
        </Tile>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="New Staff Member" onBack={() => navigation.goBack()} />

      {progressRow}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Tile>{wizardBody}</Tile>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 4 },
    progressDot: { flex: 1, height: 4, borderRadius: adminRadius.pill, backgroundColor: c.bar },
    progressDotActive: { backgroundColor: c.ink },
    progressRowDesktop: { paddingHorizontal: 0, paddingBottom: 0, marginBottom: 20 },
    content: { padding: 16, paddingBottom: 48 },
    fieldGap: { height: 12 },
    actionGap: { height: 22 },
    title: { ...adminFont.bodyBold, fontSize: 20, color: c.ink },
    titleCentered: { textAlign: 'center' },
    sectionTitle: {
      ...adminFont.bodySemiBold,
      fontSize: 13,
      color: c.ink2,
      marginTop: 20,
      marginBottom: 6,
      marginLeft: 4,
    },
    helpText: {
      ...adminFont.body,
      fontSize: 13,
      lineHeight: 19,
      color: c.ink2,
      marginTop: 8,
      marginHorizontal: 4,
    },
    helpTextCentered: {
      ...adminFont.body,
      fontSize: 15,
      lineHeight: 21,
      color: c.ink2,
      textAlign: 'center',
      marginTop: 6,
    },
    reviewCard: {
      backgroundColor: c.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
      borderRadius: adminRadius.md,
      paddingHorizontal: 16,
    },
    reviewRow: { paddingVertical: 12, gap: 2 },
    reviewRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
    reviewLabel: { ...adminFont.body, fontSize: 13, color: c.ink2 },
    reviewValue: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
    usernameBox: {
      backgroundColor: c.fill2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
      borderRadius: adminRadius.sm,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    usernameText: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
    successIcon: { alignSelf: 'center', marginBottom: 8 },
    backButton: { marginTop: 10 },
    deleteButton: { marginTop: 12 },
    dFormTile: { maxWidth: 520, width: '100%', padding: 24 },
  });
}
