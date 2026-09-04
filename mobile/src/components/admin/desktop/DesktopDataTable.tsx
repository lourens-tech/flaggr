import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize, radius, spacing } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';

export interface DesktopTableColumn<T> {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: DesktopTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
}

// Modern replacement for the old dark-header/zebra-striped grid — a light,
// flat header and plain divided rows, matching the rest of the desktop
// dashboard's card language. Cell content is fully caller-supplied (see
// TableAvatarCell/TableTag below) so a "Member" column can show an avatar
// and a "Status"/"Tier" column a colored tag.
//
// Each column's `width` is used as a flex ratio (not a hard pixel size): if
// the columns' combined width is narrower than the table card, they grow
// proportionally to fill it; if it's wider (many columns), they hold their
// size and the table scrolls horizontally instead of squeezing.
export function DesktopDataTable<T>({ columns, rows, keyExtractor }: Props<T>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const totalWidth = useMemo(() => columns.reduce((sum, c) => sum + c.width, 0), [columns]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={styles.tableScroll}
      contentContainerStyle={{ flexGrow: 1, minWidth: totalWidth }}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          {columns.map((c) => (
            <Text
              key={c.key}
              style={[styles.headerCell, columnFlex(c), { textAlign: c.align ?? 'left' }]}
              numberOfLines={1}
            >
              {c.label}
            </Text>
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator style={styles.verticalScroll}>
          {rows.map((row, i) => (
            <View key={keyExtractor(row, i)} style={[styles.dataRow, i === rows.length - 1 && styles.dataRowLast]}>
              {columns.map((c) => (
                <View
                  key={c.key}
                  style={[columnFlex(c), { paddingRight: spacing.sm }, c.align === 'right' && styles.cellAlignRight]}
                >
                  {c.render(row)}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

function columnFlex(c: { width: number }) {
  return { flexGrow: c.width, flexShrink: 0, flexBasis: c.width };
}

function initials(a: string, b?: string): string {
  return `${a.charAt(0)}${b ? b.charAt(0) : ''}`.toUpperCase() || '?';
}

// A person/member cell: initials avatar + name, with an optional subtitle
// (typically the email) stacked underneath — the "profile pic" treatment
// for tables, reusing the same avatar language as the dashboard's member rows.
export function TableAvatarCell({ name, subtitle }: { name: string; subtitle?: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const parts = name.trim().split(/\s+/);

  return (
    <View style={styles.avatarCell}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(parts[0] ?? '', parts[1])}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.avatarName} numberOfLines={1}>{name}</Text>
        {subtitle ? <Text style={styles.avatarSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export type TableTagTone = 'green' | 'amber' | 'red' | 'gray';

// Known status vocabularies across receipts (pending/approved/rejected) and
// vouchers/redemptions (issued/redeemed/expired) — anything unrecognized
// falls back to a neutral gray tag rather than guessing.
export function statusTone(status: string): TableTagTone {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'redeemed') return 'green';
  if (s === 'pending') return 'amber';
  if (s === 'rejected' || s === 'expired') return 'red';
  return 'gray';
}

export function TableTag({ label, tone = 'green' }: { label: string; tone?: TableTagTone }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const toneStyle = TONE_STYLES[tone];

  return (
    <View style={[styles.tag, { backgroundColor: toneStyle.bg(colors) }]}>
      <Text style={[styles.tagText, { color: toneStyle.fg(colors) }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const TONE_STYLES: Record<TableTagTone, { bg: (c: ThemeColors) => string; fg: (c: ThemeColors) => string }> = {
  green: { bg: (c) => c.mintBg, fg: (c) => c.clubGreen },
  amber: { bg: (c) => c.warningBg, fg: (c) => c.warning },
  red: { bg: (c) => c.dangerBg, fg: (c) => c.negative },
  gray: { bg: (c) => c.inputBg, fg: (c) => c.textSecondary },
};

export function TableText({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Text style={[styles.plainText, muted && styles.plainTextMuted]} numberOfLines={1}>
      {children}
    </Text>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  tableScroll: { flex: 1 },
  verticalScroll: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCell: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    paddingRight: spacing.sm,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dataRowLast: { borderBottomWidth: 0 },
  cellAlignRight: { alignItems: 'flex-end' },
  plainText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textPrimary },
  plainTextMuted: { color: colors.textSecondary },
  avatarCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.mintBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fontFamily.bodySemiBold, fontSize: 11.5, color: colors.clubGreen },
  avatarName: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: colors.textPrimary },
  avatarSubtitle: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textSecondary, marginTop: 1 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagText: { fontFamily: fontFamily.bodySemiBold, fontSize: 11.5, textTransform: 'capitalize' },
});
}
