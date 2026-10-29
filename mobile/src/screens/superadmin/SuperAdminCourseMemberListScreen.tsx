import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { ErrorState, Muted, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { pickMemberRosterFile, MemberRosterFileError } from '../../utils/pickMemberRosterFile';
import { showAlert } from '../../utils/alert';
import { spacing } from '../../theme';
import { useAdminTheme } from '../../context/ThemeContext';
import type { MemberRosterStatus } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseMemberList'>;

function clubInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Same feature as AdminMemberListScreen (the course_admin's own upload), just
// with an explicit courseId so a super_admin can upload a club's list on its
// behalf instead of relying on the club to do it themselves.
export function SuperAdminCourseMemberListScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName } = route.params;
  const { getSuperAdminMemberRosterStatus, uploadSuperAdminMemberRoster } = useAdmin();
  const [status, setStatus] = useState<MemberRosterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setStatus(await getSuperAdminMemberRosterStatus(courseId));
    } catch (err) {
      setLoadError(true);
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load member list status', message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

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
    }, [courseId]),
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
      const result = await uploadSuperAdminMemberRoster(courseId, picked.fileName, picked.base64);
      setStatus(await getSuperAdminMemberRosterStatus(courseId));
      showAlert(
        'Member list uploaded',
        `${result.rosterCount.toLocaleString()} members loaded from ${picked.fileName}. ${result.verifiedCount.toLocaleString()} of ${courseName}'s existing members were matched and verified.`,
      );
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t upload member list', message);
    } finally {
      setUploading(false);
    }
  };

  const helpText = (
    <>
      <Muted style={styles.helpText}>
        Upload {courseName}'s membership list on their behalf so new signups can be confirmed as actual members. CSV
        and Excel (.xlsx) files are supported — First Name, Last Name, and Email columns are needed (Member Number
        optional). Re-uploading replaces the previous list entirely.
      </Muted>
      <Muted style={styles.helpText}>
        A member who doesn't match the list can still use the app fully, but stays capped at Bronze tier until
        they're verified.
      </Muted>
    </>
  );

  const statusBlock = loadError ? (
    <ErrorState onRetry={load} />
  ) : loading ? (
    <SkeletonRows rows={2} />
  ) : (
    <View style={styles.statusRow}>
      <View style={styles.statusIcon}>
        <Ionicons name="people-outline" size={22} color={c.icon} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {status && status.count > 0 ? (
          <>
            <Text style={styles.statusTitle}>{status.count.toLocaleString()} members on file</Text>
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
  );

  const uploadButton = (
    <PillButton
      label={status && status.count > 0 ? 'Upload New Member List' : 'Upload Member List'}
      icon="cloud-upload-outline"
      onPress={handleUpload}
      loading={uploading}
    />
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`Courses › ${courseName} › Member List`} showRail={false}>
        <View style={styles.dHeadRow}>
          <View style={styles.crest}>
            <Text style={styles.crestText}>{clubInitials(courseName)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PageTitle>{courseName}</PageTitle>
            <Muted style={styles.dSection}>Member List</Muted>
          </View>
        </View>
        <View style={styles.dGrid}>
          <Tile style={styles.dMain}>
            {statusBlock}
            <View style={{ height: spacing.lg }} />
            {uploadButton}
          </Tile>
          <Tile style={styles.dSide}>{helpText}</Tile>
        </View>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Member List" subtitle={courseName} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Tile>{statusBlock}</Tile>
        <View style={{ height: spacing.md }} />
        {uploadButton}
        <View style={{ height: spacing.lg }} />
        {helpText}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, paddingBottom: spacing.xl * 2 },
    helpText: { marginBottom: spacing.sm, paddingHorizontal: 2 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    statusIcon: { width: 44, height: 44, borderRadius: adminRadius.sm, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
    statusTitle: { ...adminFont.bodyBold, ...tabularNums, fontSize: 18, color: c.ink },
    statusSubtitle: { ...adminFont.body, fontSize: 13, color: c.ink2, marginTop: 2 },
    dHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    crest: { width: 48, height: 48, borderRadius: adminRadius.sm, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
    crestText: { ...adminFont.bodyBold, fontSize: 16, color: '#CDDE5C' },
    dSection: { marginTop: 2, fontSize: 15 },
    dGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 18, alignItems: 'flex-start' },
    dMain: { flexGrow: 1.2, flexBasis: 360, padding: 22 },
    dSide: { flexGrow: 1, flexBasis: 300, padding: 22 },
  });
}
