import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { TableAvatarCell } from '../../components/admin/desktop/DesktopDataTable';
import { AdminButton, PageTitle, Segmented, SkeletonRows, StatusPill, Tile, type SegmentOption } from '../../components/admin/ui';
import { PressableScale } from '../../components/motion';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { ClubAdminSummary } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminClubAdmins'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrors MAX_COURSE_ADMINS_PER_CLUB in api/admin/index.ts — the server is
// the actual source of truth (rejects a 3rd invite), this only decides
// whether to show the invite form at all.
const MAX_CLUB_ADMINS = 2;

// Staff, Club Admins and Activity read as one "Staff and Admins" page: each
// keeps its own route, and this segment (repeated on all three screens)
// swaps between them in place.
type StaffSection = 'AdminStaffList' | 'AdminClubAdmins' | 'AdminStaffActivity';
const STAFF_SECTIONS: SegmentOption<StaffSection>[] = [
  { key: 'AdminStaffList', label: 'Staff' },
  { key: 'AdminClubAdmins', label: 'Club Admins' },
  { key: 'AdminStaffActivity', label: 'Activity' },
];

export function AdminClubAdminsScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
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

  const goToSection = (key: StaffSection) => {
    if (key === 'AdminStaffList') navigation.replace('AdminStaffList');
    else if (key === 'AdminStaffActivity') navigation.replace('AdminStaffActivity');
  };

  const sectionSegment = (
    <Segmented
      options={STAFF_SECTIONS}
      value="AdminClubAdmins"
      onChange={goToSection}
      accessibilityLabel="Staff and Admins section"
      fullWidth={!isDesktop}
    />
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
  // Icon-only actions: 44pt on phones, 36 on desktop.
  const iconSize = isDesktop ? 36 : 44;

  const adminList =
    admins.length > 0 ? (
      <Tile padded={false}>
        {admins.map((a, i) => (
          <View key={a.id} style={[styles.row, i > 0 && styles.rowDivider]}>
            <View style={styles.rowMain}>
              <TableAvatarCell name={`${a.firstName} ${a.lastName}${a.id === admin.id ? ' (You)' : ''}`} subtitle={a.email} />
            </View>
            {a.revoked ? <StatusPill label="Revoked" tone="neg" /> : null}
            {a.id === admin.id ? null : busyId === a.id ? (
              <ActivityIndicator color={c.ink2} size="small" />
            ) : (
              <View style={styles.rowActions}>
                <PressableScale
                  onPress={() => handleToggleAccess(a)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={a.revoked ? `Reactivate ${a.firstName} ${a.lastName}` : `Revoke ${a.firstName} ${a.lastName}`}
                  style={[styles.iconBtn, { width: iconSize, height: iconSize, backgroundColor: c.fill }]}
                >
                  <Ionicons name={a.revoked ? 'lock-open-outline' : 'lock-closed-outline'} size={17} color={c.ink} />
                </PressableScale>
                <PressableScale
                  onPress={() => handleDelete(a)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${a.firstName} ${a.lastName}`}
                  style={[styles.iconBtn, { width: iconSize, height: iconSize, backgroundColor: c.negBg }]}
                >
                  <Ionicons name="trash-outline" size={17} color={c.neg} />
                </PressableScale>
              </View>
            )}
          </View>
        ))}
      </Tile>
    ) : null;

  const inviteTile = canInviteMore ? (
    <Tile>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Add Another Admin</Text>
      <Text style={styles.helpText}>
        Your club can have up to {MAX_CLUB_ADMINS} admins. They'll be emailed a temporary password to log
        in with full course admin access.
      </Text>
      <View style={styles.formGap} />
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
      <View style={styles.formGap} />
      <AdminButton label="Send Invite" variant="accent" size="lg" fullWidth onPress={handleInvite} loading={inviting} />
    </Tile>
  ) : (
    <Tile>
      <View style={styles.capRow}>
        <Ionicons name="information-circle-outline" size={22} color={c.icon} />
        <Text style={[styles.helpText, styles.capText]}>
          Your club already has the maximum of {MAX_CLUB_ADMINS} active admins. Revoke one above to invite
          another.
        </Text>
      </View>
    </Tile>
  );

  const loadingTile = (
    <Tile>
      <SkeletonRows rows={3} />
    </Tile>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminStaffList" breadcrumb="Staff and Admins">
        <View style={styles.dHead}>
          <View style={styles.dTopBar}>{sectionSegment}</View>
          <PageTitle>Staff and Admins</PageTitle>
        </View>
        {loading ? (
          loadingTile
        ) : (
          <View style={styles.dCols}>
            <View style={styles.dListCol}>{adminList}</View>
            <View style={styles.dFormCol}>{inviteTile}</View>
          </View>
        )}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Club Admins" onBack={() => navigation.goBack()} />

      <View style={styles.segmentArea}>{sectionSegment}</View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          loadingTile
        ) : (
          <>
            {adminList}
            {inviteTile}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    segmentArea: { paddingHorizontal: 16 },
    content: { padding: 16, paddingBottom: 48, gap: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
    rowMain: { flex: 1, minWidth: 0 },
    rowActions: { flexDirection: 'row', gap: 8 },
    iconBtn: { borderRadius: adminRadius.pill, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink, marginBottom: 6 },
    helpText: { ...adminFont.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 },
    formGap: { height: 16 },
    fieldGap: { height: 12 },
    capRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    capText: { flex: 1, fontSize: 14, lineHeight: 20 },
    dHead: { gap: 14 },
    dTopBar: { flexDirection: 'row', alignItems: 'center' },
    dCols: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 },
    dListCol: { flexGrow: 1.2, flexBasis: 380 },
    dFormCol: { flexGrow: 1, flexBasis: 320 },
  });
}
