import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminTheme } from '../../../context/ThemeContext';
import { adminFont, adminRadius } from '../../../theme/admin';
import type { DesktopNavGroup, DesktopNavItem } from '../../../navigation/adminNavConfig';
import { Glass } from '../ui';

export interface PaletteMember {
  id: string;
  label: string;
  sub?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  navGroups: DesktopNavGroup[];
  onSection: (item: DesktopNavItem) => void;
  // Omitted for roles that can't look members up (staff, support agents).
  searchMembers?: (query: string) => Promise<PaletteMember[]>;
  onMember?: (member: PaletteMember) => void;
}

type Row = { kind: 'section'; item: DesktopNavItem } | { kind: 'member'; member: PaletteMember };

const webNoOutline = { outlineStyle: 'none' } as unknown as { outlineWidth: number };

// ⌘K / Ctrl K: jump to any section, or (for club admins and super admins)
// find a member by name, email or phone using the existing member search.
export function CommandPalette({ visible, onClose, navGroups, onSection, searchMembers, onMember }: Props) {
  const { c } = useAdminTheme();
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<PaletteMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setMembers([]);
    setCursor(0);
  }, [visible]);

  // Member lookups wait for a pause in typing and need two characters.
  useEffect(() => {
    if (!searchMembers || query.trim().length < 2) {
      setMembers([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchMembers(query.trim())
        .then((rows) => {
          if (!cancelled) setMembers(rows.slice(0, 6));
        })
        .catch(() => {
          if (!cancelled) setMembers([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, searchMembers]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const sections = navGroups
      .flatMap((g) => g.items)
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((item) => ({ kind: 'section' as const, item }));
    return [...sections, ...members.map((member) => ({ kind: 'member' as const, member }))];
  }, [navGroups, query, members]);

  useEffect(() => {
    if (cursor >= rows.length) setCursor(Math.max(0, rows.length - 1));
  }, [rows.length, cursor]);

  const choose = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    if (row.kind === 'section') onSection(row.item);
    else onMember?.(row.member);
  };

  const onKeyPress = (e: { nativeEvent: { key: string }; preventDefault?: () => void }) => {
    const key = e.nativeEvent.key;
    if (key === 'ArrowDown') {
      e.preventDefault?.();
      setCursor((i) => Math.min(rows.length - 1, i + 1));
    } else if (key === 'ArrowUp') {
      e.preventDefault?.();
      setCursor((i) => Math.max(0, i - 1));
    } else if (key === 'Escape') {
      onClose();
    }
  };

  const sectionCount = rows.filter((r) => r.kind === 'section').length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => inputRef.current?.focus()}>
      <Pressable style={[styles.scrim, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close search">
        <Pressable onPress={() => {}} style={styles.wrap}>
          <Glass radius={adminRadius.lg} style={[styles.panel, { backgroundColor: c.sheet }]}>
            <View style={[styles.inputRow, { borderBottomColor: c.edge }]}>
              <Ionicons name="search" size={18} color={c.ink3} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setCursor(0);
                }}
                onKeyPress={onKeyPress as never}
                onSubmitEditing={() => choose(rows[cursor])}
                placeholder={searchMembers ? 'Jump to a section or find a member' : 'Jump to a section'}
                placeholderTextColor={c.ink3}
                accessibilityLabel="Search"
                autoCorrect={false}
                style={[styles.input, { color: c.ink }, webNoOutline]}
              />
              <Text style={[styles.esc, { color: c.ink3, backgroundColor: c.fill }]}>esc</Text>
            </View>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {sectionCount > 0 ? <Text style={[styles.cap, { color: c.ink3 }]}>Sections</Text> : null}
              {rows.map((row, i) => {
                const on = i === cursor;
                const first = row.kind === 'member' && i === sectionCount;
                return (
                  <React.Fragment key={row.kind === 'section' ? `s-${row.item.key}` : `m-${row.member.id}`}>
                    {first ? <Text style={[styles.cap, { color: c.ink3 }]}>Members</Text> : null}
                    <Pressable
                      onPress={() => choose(row)}
                      onHoverIn={() => setCursor(i)}
                      accessibilityRole="button"
                      style={[styles.row, on && { backgroundColor: c.sel }]}
                    >
                      <Ionicons name={row.kind === 'section' ? row.item.icon : 'person-circle-outline'} size={18} color={c.ink2} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.rowText, { color: c.ink }]} numberOfLines={1}>
                          {row.kind === 'section' ? row.item.label : row.member.label}
                        </Text>
                        {row.kind === 'member' && row.member.sub ? (
                          <Text style={[styles.rowSub, { color: c.ink3 }]} numberOfLines={1}>{row.member.sub}</Text>
                        ) : null}
                      </View>
                      {on ? <Ionicons name="return-down-back" size={14} color={c.ink3} /> : null}
                    </Pressable>
                  </React.Fragment>
                );
              })}
              {rows.length === 0 && !searching ? (
                <Text style={[styles.none, { color: c.ink2 }]}>No sections{searchMembers ? ' or members' : ''} match “{query.trim()}”.</Text>
              ) : null}
              {searching ? <Text style={[styles.none, { color: c.ink3 }]}>Searching members…</Text> : null}
            </ScrollView>
          </Glass>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// "⌘K" on Apple devices, "Ctrl K" everywhere else.
export function commandKeyHint(): string {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return '⌘K';
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', paddingTop: 110, paddingHorizontal: 16 },
  wrap: { width: '100%', maxWidth: 600 },
  panel: { overflow: 'hidden' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, height: 58, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, ...adminFont.body, fontSize: 17, padding: 0 },
  esc: { ...adminFont.bodySemiBold, fontSize: 11.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  cap: { ...adminFont.bodyBold, fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 8, paddingHorizontal: 10, height: 46, borderRadius: adminRadius.sm },
  rowText: { ...adminFont.bodyMedium, fontSize: 15 },
  rowSub: { ...adminFont.body, fontSize: 12.5 },
  none: { ...adminFont.body, fontSize: 14, paddingHorizontal: 18, paddingVertical: 18 },
});
