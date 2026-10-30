import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../../theme';
import { useAdminTheme } from '../../../context/ThemeContext';
import { useHover, hoverTransition } from '../../../hooks/useHover';
import { duration } from '../../../theme/motion';
import { FadeIn } from '../../motion';
import { adminFont, adminRadius, type AdminColors } from '../../../theme/admin';

export interface DesktopTableColumn<T> {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
  // Makes the column header a sort toggle.
  sortValue?: (row: T) => string | number;
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
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const totalWidth = useMemo(() => columns.reduce((sum, col) => sum + col.width, 0), [columns]);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    const col = sort && columns.find((x) => x.key === sort.key);
    if (!sort || !col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * sort.dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((cur) => (cur?.key !== key ? { key, dir: 1 } : cur.dir === 1 ? { key, dir: -1 } : null));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={styles.tableScroll}
      contentContainerStyle={{ flexGrow: 1, minWidth: totalWidth }}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          {columns.map((col) => {
            const active = sort?.key === col.key;
            const label = (
              <Text style={[styles.headerCell, active && { color: c.ink }, { textAlign: col.align ?? 'left' }]} numberOfLines={1}>
                {col.label}
              </Text>
            );
            return col.sortValue ? (
              <Pressable
                key={col.key}
                onPress={() => toggle(col.key)}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${col.label}${active ? (sort?.dir === 1 ? ', ascending' : ', descending') : ''}`}
                style={[columnFlex(col), styles.headerPress, col.align === 'right' && { justifyContent: 'flex-end' }]}
              >
                {label}
                <Ionicons name={active ? (sort?.dir === 1 ? 'chevron-up' : 'chevron-down') : 'swap-vertical'} size={12} color={active ? c.ink : c.ink3} />
              </Pressable>
            ) : (
              <View key={col.key} style={columnFlex(col)}>
                {label}
              </View>
            );
          })}
        </View>
        <ScrollView showsVerticalScrollIndicator style={styles.verticalScroll}>
          {sorted.map((row, i) => (
            <DataRow
              key={keyExtractor(row, i)}
              row={row}
              columns={columns}
              isLast={i === sorted.length - 1}
              animate={i < ANIMATED_ROWS}
              styles={styles}
            />
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

function columnFlex(c: { width: number }) {
  return { flexGrow: c.width, flexShrink: 0, flexBasis: c.width };
}

// Subtle hover tint on each row — mainly a scanning aid (helps track which
// row you're reading across a wide table), not an implied click affordance.
function DataRow<T>({
  row,
  columns,
  isLast,
  animate,
  styles,
}: {
  row: T;
  columns: DesktopTableColumn<T>[];
  isLast: boolean;
  animate: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, hoverHandlers] = useHover();
  return (
    <FadeIn distance={4} duration={duration.short} disabled={!animate}>
      <View
        style={[styles.dataRow, hoverTransition, hovered && styles.dataRowHover, isLast && styles.dataRowLast]}
        {...hoverHandlers}
      >
        {columns.map((c) => (
          <View key={c.key} style={[columnFlex(c), { paddingRight: spacing.sm }, c.align === 'right' && styles.cellAlignRight]}>
            {c.render(row)}
          </View>
        ))}
      </View>
    </FadeIn>
  );
}

// Rows past this point appear without an entrance — the cascade only needs
// to cover what's visible on first paint.
const ANIMATED_ROWS = 20;

function initials(a: string, b?: string): string {
  return `${a.charAt(0)}${b ? b.charAt(0) : ''}`.toUpperCase() || '?';
}

// A person/member cell: initials avatar + name, with an optional subtitle
// (typically the email) stacked underneath — the "profile pic" treatment
// for tables, reusing the same avatar language as the dashboard's member rows.
export function TableAvatarCell({ name, subtitle }: { name: string; subtitle?: string }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
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
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const toneStyle = TONE_STYLES[tone];

  return (
    <View style={[styles.tag, { backgroundColor: toneStyle.bg(c) }]}>
      <Text style={[styles.tagText, { color: toneStyle.fg(c) }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const TONE_STYLES: Record<TableTagTone, { bg: (c: AdminColors) => string; fg: (c: AdminColors) => string }> = {
  green: { bg: (c) => c.posBg, fg: (c) => c.pos },
  amber: { bg: (c) => c.amberBg, fg: (c) => c.amber },
  red: { bg: (c) => c.negBg, fg: (c) => c.neg },
  gray: { bg: (c) => c.fill, fg: (c) => c.ink2 },
};

export function TableText({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <Text style={[styles.plainText, muted && styles.plainTextMuted]} numberOfLines={1}>
      {children}
    </Text>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  tableScroll: { flex: 1 },
  verticalScroll: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.edge,
  },
  headerCell: {
    ...adminFont.bodyBold,
    fontSize: 11.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.ink3,
    paddingRight: spacing.xs,
    flexShrink: 1,
  },
  headerPress: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: spacing.sm },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.edge,
  },
  dataRowLast: { borderBottomWidth: 0 },
  dataRowHover: { backgroundColor: c.fill2 },
  cellAlignRight: { alignItems: 'flex-end' },
  plainText: { ...adminFont.body, fontSize: 14, color: c.ink, fontVariant: ['tabular-nums'] },
  plainTextMuted: { color: c.ink2 },
  avatarCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F4234',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...adminFont.bodyBold, fontSize: 12, color: '#CDDE5C' },
  avatarName: { ...adminFont.bodySemiBold, fontSize: 14, color: c.ink },
  avatarSubtitle: { ...adminFont.body, fontSize: 12.5, color: c.ink2, marginTop: 1 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: adminRadius.pill,
  },
  tagText: { ...adminFont.bodySemiBold, fontSize: 12, textTransform: 'capitalize' },
});
}
