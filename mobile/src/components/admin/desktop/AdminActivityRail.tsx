import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fontFamily } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';
import type { AdminNotification } from '../../../data/adminTypes';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  notifications: AdminNotification[];
  onPress: (n: AdminNotification) => void;
  footer?: React.ReactNode;
}

// Right-rail "Recent Activity" feed — reuses the same notifications feed
// that powers AdminNotificationsScreen/the topbar bell, just surfaced more
// prominently, per the approved dashboard mockup. Not a new data source.
export function AdminActivityRail({ notifications, onPress, footer }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const recent = notifications.slice(0, 6);

  return (
    <View style={{ gap: 22 }}>
      <View>
        <Text style={styles.heading}>Recent Activity</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>Nothing yet.</Text>
        ) : (
          recent.map((n, i) => {
            const dotColor = n.receiptId ? colors.warning : n.enquiryId ? colors.clubGreen : '#38468C';
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.item, i === recent.length - 1 && styles.itemLast]}
                onPress={() => onPress(n)}
                disabled={!n.enquiryId && !n.receiptId}
                activeOpacity={0.7}
              >
                <View style={[styles.dot, { backgroundColor: dotColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.text}>
                    <Text style={styles.textBold}>{n.title}</Text> — {n.body}
                  </Text>
                  <Text style={styles.time}>{timeAgo(n.date)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
      {footer}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  heading: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  empty: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textSecondary, paddingVertical: 8 },
  item: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLast: { borderBottomWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  text: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18, color: colors.textPrimary },
  textBold: { fontFamily: fontFamily.bodySemiBold },
  time: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
}
