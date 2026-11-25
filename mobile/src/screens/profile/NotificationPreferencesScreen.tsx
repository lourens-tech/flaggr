import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { Appear, BentoScreen, BentoTile, BentoToggle, LoadError } from '../../components/bento';
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
  const { t } = useBento();
  const { getNotificationPreferences, updateNotificationPreferences } = useApp();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(null);

  // Owner decision (24 Nov 2026): a failed load shows a message with Try again, which runs the same load
  // (it used to leave the spinner turning forever).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPrefs(await getNotificationPreferences());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [getNotificationPreferences]);

  useEffect(() => {
    load();
    // Once on open, as before.
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
      showAlert('Couldn’t update preferences', friendlyError(err));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <BentoScreen title="Notification Preferences" onBack={() => navigation.goBack()}>
      <View style={{ height: 4 }} />
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 36 }}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      ) : error || !prefs ? (
        <LoadError title="Couldn’t load preferences" body={error ?? undefined} onRetry={load} />
      ) : (
        <Appear>
          <BentoTile padding={0} innerStyle={{ paddingHorizontal: 16 }}>
            {ROWS.map((row, i) => (
              <View
                key={row.key}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{row.label}</Text>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: t.muted, marginTop: 2 }}>{row.description}</Text>
                </View>
                {savingKey === row.key ? (
                  // Saving: a spinner where the switch was (G-E-NotifSaving).
                  <View style={{ width: 52, alignItems: 'center' }}>
                    <ActivityIndicator color={t.accent} size="small" />
                  </View>
                ) : (
                  <BentoToggle value={prefs[row.key]} onValueChange={(value) => handleToggle(row.key, value)} accessibilityLabel={row.label} />
                )}
              </View>
            ))}
          </BentoTile>
        </Appear>
      )}
    </BentoScreen>
  );
}
