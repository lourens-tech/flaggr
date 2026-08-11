import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { ClubAdminSummary } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminClubAdmins'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrors MAX_COURSE_ADMINS_PER_CLUB in api/admin/index.ts — the server is
// the actual source of truth (rejects a 3rd invite), this only decides
// whether to show the invite form at all.
const MAX_CLUB_ADMINS = 2;

export function AdminClubAdminsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { admin, getClubAdmins, inviteClubAdmin, revokeClubAdmin, reactivateClubAdmin, deleteClubAdmin } = useAdmin();
  const [admins, setAdmins] = useState<ClubAdminSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAdmins(await getClubAdmins());
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load club admins', message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const handleInvite = async () => {
    if (!firstName.trim() || !email.trim()) {
      showAlert('Missing info', 'First name and email are required.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      showAlert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setInviting(true);
    try {
      await inviteClubAdmin({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
      setFirstName('');
      setLastName('');
      setEmail('');
      await load();
      showAlert('Invite sent', `${firstName.trim()} has been emailed a temporary password to log in.`);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send invite', message);
    } finally {
      setInviting(false);
    }
  };

  const handleToggleAccess = (item: ClubAdminSummary) => {
    const isRevoked = item.revoked;
    showAlert(
      isRevoked ? 'Reactivate admin?' : 'Revoke admin access?',
      isRevoked
        ? `${item.firstName} ${item.lastName} will be able to log in again.`
        : `${item.firstName} ${item.lastName} will no longer be able to log in. You can reactivate them later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isRevoked ? 'Reactivate' : 'Revoke',
          style: isRevoked ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              if (isRevoked) await reactivateClubAdmin(item.id);
              else await revokeClubAdmin(item.id);
              await load();
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t update access', message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleDelete = (item: ClubAdminSummary) => {
    showAlert(
      'Delete this admin?',
      `${item.firstName} ${item.lastName} will permanently lose access and their account will be deleted. Their email will be free to invite again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await deleteClubAdmin(item.id);
              await load();
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t delete admin', message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const canInviteMore = admins.filter((a) => !a.revoked).length < MAX_CLUB_ADMINS;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Club Admins" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {admins.map((a) => (
              <View key={a.id} style={styles.card}>
                <Ionicons name="person-circle-outline" size={22} color={colors.clubGreen} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {a.firstName} {a.lastName}
                    {a.id === admin.id ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.cardEmail}>{a.email}</Text>
                  {a.revoked ? <Text style={styles.revokedBadge}>Revoked</Text> : null}
                </View>
                {a.id === admin.id ? null : busyId === a.id ? (
                  <ActivityIndicator color={colors.clubGreen} size="small" />
                ) : (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => handleToggleAccess(a)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={a.revoked ? `Reactivate ${a.firstName} ${a.lastName}` : `Revoke ${a.firstName} ${a.lastName}`}
                    >
                      <Ionicons
                        name={a.revoked ? 'lock-open-outline' : 'lock-closed-outline'}
                        size={20}
                        color={a.revoked ? colors.clubGreen : colors.negative}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(a)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${a.firstName} ${a.lastName}`}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.negative} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            {canInviteMore ? (
              <>
                <Text style={styles.sectionTitle}>Add Another Admin</Text>
                <Text style={styles.helpText}>
                  Your club can have up to {MAX_CLUB_ADMINS} admins. They'll be emailed a temporary password to log
                  in with full course admin access.
                </Text>
                <View style={{ height: spacing.md }} />
                <TextField placeholder="First Name" variant="onLight" value={firstName} onChangeText={setFirstName} />
                <View style={{ height: spacing.md }} />
                <TextField placeholder="Last Name" variant="onLight" value={lastName} onChangeText={setLastName} />
                <View style={{ height: spacing.md }} />
                <TextField
                  placeholder="Email"
                  variant="onLight"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <View style={{ height: spacing.lg }} />
                <PillButton label="Send Invite" onPress={handleInvite} loading={inviting} />
              </>
            ) : (
              <Text style={styles.helpText}>
                Your club already has the maximum of {MAX_CLUB_ADMINS} active admins. Revoke one above to invite
                another.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerSafeArea: { backgroundColor: colors.clubGreen },
    content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.mintBg,
      borderWidth: 0.5,
      borderColor: colors.clubGreen,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
    cardEmail: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
    cardActions: { flexDirection: 'row', gap: spacing.md },
    revokedBadge: {
      fontFamily: fontFamily.bodySemiBold,
      fontSize: 10,
      color: colors.negative,
      marginTop: 2,
    },
    sectionTitle: {
      fontFamily: fontFamily.heading,
      fontSize: fontSize.cardTitle,
      color: colors.textPrimary,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    helpText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  });
}
