import React, { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { AppNotification } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

function groupLabel(dateIso: string): string {
  const date = new Date(dateIso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  const daysAgo = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 7) return 'This Week';
  return 'Earlier';
}

export function NotificationsScreen({ navigation }: Props) {
  const { notifications, markNotificationRead } = useApp();

  const grouped = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    for (const n of notifications) {
      const label = groupLabel(n.date);
      groups[label] = groups[label] ?? [];
      groups[label].push(n);
    }
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    return order.filter((l) => groups[l]?.length).map((label) => ({ label, entries: groups[label] }));
  }, [notifications]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {grouped.map((group) => (
          <View key={group.label} style={{ marginBottom: spacing.lg }}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <View style={styles.card}>
              {group.entries.map((n, i) => (
                <View key={n.id} style={[styles.row, i !== group.entries.length - 1 && styles.rowDivider]}>
                  <Ionicons
                    name={n.read ? 'checkmark-circle-outline' : 'notifications'}
                    size={18}
                    color={colors.clubGreen}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{n.title}</Text>
                    <Text style={styles.rowBody}>{n.body}</Text>
                  </View>
                  <TouchableOpacity onPress={() => markNotificationRead(n.id)}>
                    <Text style={styles.viewLink}>View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding },
  groupLabel: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginBottom: spacing.sm },
  card: { backgroundColor: colors.mintBgAlt, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm + 4, alignItems: 'flex-start' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(31,66,52,0.08)' },
  rowTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary },
  rowBody: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  viewLink: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen, marginTop: 2 },
});
