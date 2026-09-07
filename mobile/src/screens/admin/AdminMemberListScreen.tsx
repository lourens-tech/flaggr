import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { pickMemberRosterFile, MemberRosterFileError } from '../../utils/pickMemberRosterFile';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { MemberRosterStatus } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminMemberList'>;

export function AdminMemberListScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const body = (
    <>
      <Text style={styles.helpText}>
        Upload your club's membership list so Flagrr can confirm that new signups are actual members. CSV and Excel
        (.xlsx) files are supported — First Name, Last Name, and Email columns are needed (Member Number optional).
        Re-uploading replaces the previous list entirely.
      </Text>
      <Text style={styles.helpText}>
        A member who doesn't match your list can still use the app fully, but stays capped at Bronze tier until
        they're verified.
      </Text>

      <View style={{ height: spacing.lg }} />

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} />
      ) : (
        <View style={styles.statusCard}>
          <Ionicons name="people-outline" size={22} color={colors.clubGreen} />
          <View style={{ flex: 1 }}>
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
      )}

      <View style={{ height: spacing.lg }} />
      <PillButton
        label={status && status.count > 0 ? 'Upload New Member List' : 'Upload Member List'}
        icon="cloud-upload-outline"
        onPress={handleUpload}
        loading={uploading}
      />
    </>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminMemberList" breadcrumb="Member List" showRail={false}>
        <Text style={styles.dPageTitle}>Member List</Text>
        <DesktopPanel title=" " style={{ maxWidth: 560 }}>
          {body}
        </DesktopPanel>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Member List" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerSafeArea: { backgroundColor: colors.clubGreen },
    content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
    helpText: {
      fontFamily: fontFamily.body,
      fontSize: fontSize.tiny,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.mintBg,
      borderWidth: 0.5,
      borderColor: colors.clubGreen,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    statusTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
    statusSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
    dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
  });
}
