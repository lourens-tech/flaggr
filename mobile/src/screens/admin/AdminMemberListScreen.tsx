import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminButton, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminApiError } from '../../api/adminClient';
import { pickMemberRosterFile, MemberRosterFileError } from '../../utils/pickMemberRosterFile';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { MemberRosterStatus } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminMemberList'>;

export function AdminMemberListScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { getMemberRosterStatus, uploadMemberRoster } = useAdmin();
  const [status, setStatus] = useState<MemberRosterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getMemberRosterStatus());
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load member list status', message);
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

  const handleUpload = async () => {
    let picked;
    try {
      picked = await pickMemberRosterFile();
    } catch (err) {
      const message = err instanceof MemberRosterFileError ? err.message : 'Could not open that file.';
      showAlert('Couldn’t read file', message);
      return;
    }
    if (!picked) return;

    setUploading(true);
    try {
      const result = await uploadMemberRoster(picked.fileName, picked.base64);
      setStatus(await getMemberRosterStatus());
      showAlert(
        'Member list uploaded',
        `${result.rosterCount.toLocaleString()} members loaded from ${picked.fileName}. ${result.verifiedCount.toLocaleString()} of your existing members were matched and verified.`,
      );
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t upload member list', message);
    } finally {
      setUploading(false);
    }
  };

  const hasList = !!status && status.count > 0;

  const statusTile = (
    <Tile style={isDesktop ? styles.dStatusTile : undefined}>
      {loading ? (
        <SkeletonRows rows={2} />
      ) : (
        <View style={styles.statusRow}>
          <View style={styles.iconWell}>
            <Ionicons name="people-outline" size={24} color={c.icon} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {status && status.count > 0 ? (
              <>
                <View accessible accessibilityLabel={`${status.count.toLocaleString()} members on file`}>
                  <Text style={styles.bigCount}>{status.count.toLocaleString()}</Text>
                  <Text style={styles.statusTitle}>members on file</Text>
                </View>
                {status.lastUploadedAt ? (
                  <Text style={styles.statusSubtitle}>
                    Last uploaded {new Date(status.lastUploadedAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.statusTitle}>No member list uploaded yet</Text>
            )}
          </View>
        </View>
      )}

      <AdminButton
        label={hasList ? 'Upload New Member List' : 'Upload Member List'}
        icon="cloud-upload-outline"
        variant="accent"
        size="lg"
        onPress={handleUpload}
        loading={uploading}
        fullWidth={!isDesktop}
        style={[styles.uploadButton, isDesktop && styles.uploadButtonDesktop]}
      />
    </Tile>
  );

  const rulesTile = (
    <Tile style={isDesktop ? styles.dRulesTile : undefined}>
      <View style={styles.rule}>
        <View style={styles.ruleIcon}>
          <Ionicons name="document-text-outline" size={15} color={c.icon} />
        </View>
        <Text style={styles.ruleText}>
          Upload your club's membership list so Flagrr can confirm that new signups are actual members. CSV and Excel
          (.xlsx) files are supported — First Name, Last Name, and Email columns are needed (Member Number optional).
          Re-uploading replaces the previous list entirely.
        </Text>
      </View>
      <View style={[styles.rule, styles.ruleDivider]}>
        <View style={styles.ruleIcon}>
          <Ionicons name="ribbon-outline" size={15} color={c.icon} />
        </View>
        <Text style={styles.ruleText}>
          A member who doesn't match your list can still use the app fully, but stays capped at Bronze tier until
          they're verified.
        </Text>
      </View>
    </Tile>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminMemberList" breadcrumb="Member List" showRail={false}>
        <PageTitle>Member List</PageTitle>
        <View style={styles.dCols}>
          {statusTile}
          {rulesTile}
        </View>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Member List" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {statusTile}
        {rulesTile}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, paddingBottom: 48, gap: 16 },
    dCols: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 },
    dStatusTile: { flexGrow: 1.25, flexBasis: 360 },
    dRulesTile: { flexGrow: 1, flexBasis: 320 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    iconWell: {
      width: 48,
      height: 48,
      borderRadius: adminRadius.sm,
      backgroundColor: c.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bigCount: { ...adminFont.bodyBold, ...tabularNums, fontSize: 44, lineHeight: 48, letterSpacing: -1.2, color: c.ink },
    statusTitle: { ...adminFont.bodySemiBold, fontSize: 15.5, color: c.ink },
    statusSubtitle: { ...adminFont.body, fontSize: 13, color: c.ink2, marginTop: 4 },
    uploadButton: { marginTop: 18 },
    uploadButtonDesktop: { alignSelf: 'flex-start' },
    rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
    ruleDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
    ruleIcon: {
      width: 28,
      height: 28,
      borderRadius: adminRadius.sm,
      backgroundColor: c.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ruleText: { flex: 1, ...adminFont.body, fontSize: 14, lineHeight: 21, color: c.ink2 },
  });
}
