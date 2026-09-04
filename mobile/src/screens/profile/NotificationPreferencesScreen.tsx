import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { NotificationPreferences } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationPreferences'>;

const ROWS: Array<{ key: keyof NotificationPreferences; label: string; description: string }> = [
  {
    key: 'accountActivity',
    label: 'Account Activity',
    description: 'Receipts earned, redemptions, tier and streak rewards.',
  },
  {
    key: 'supportReplies',
    label: 'Support Replies',
    description: 'Replies to an enquiry you sent your club.',
  },
  {
    key: 'announcements',
    label: 'Club and Flagrr Announcements',
    description: 'Broadcasts from your club or the Flagrr team.',
  },
];

export function NotificationPreferencesScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { getNotificationPreferences, updateNotificationPreferences } = useApp();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPrefs(await getNotificationPreferences());
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t load preferences', message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSavingKey(key);
    try {
      await updateNotificationPreferences(next);
    } catch (err) {
      setPrefs(prefs); // revert on failure
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t update preferences', message);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Notification Preferences" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {loading || !prefs ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <View style={styles.card}>
          {ROWS.map((row, i) => (
            <View key={row.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowDescription}>{row.description}</Text>
              </View>
              {savingKey === row.key ? (
                <ActivityIndicator color={colors.clubGreen} size="small" />
              ) : (
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(value) => handleToggle(row.key, value)}
                  trackColor={{ true: colors.clubGreen }}
                />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  card: {
    margin: screenPadding,
    backgroundColor: colors.mintBgAlt,
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary },
  rowDescription: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
});
}
