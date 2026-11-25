import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useBento } from '../../context/ThemeContext';
import { bentoLayout as L, bentoType } from '../../theme/bento';
import { BentoIcon, type BentoIconName } from './BentoIcon';
import { BentoSheet } from './BentoSheet';
import { BentoButton, BentoField, BentoTile, Glass } from './primitives';
import { haptic } from '../../utils/haptics';

// Shared pieces for the phase 3 screen restyle, drawn from the Bento kit
// (bento-kit.css on the design canvases) and the motion prototype:
//   rows inside a tile, status pills, empty and load-error states, chat
//   bubbles and composer, and a picker sheet.
// Every area uses these instead of drawing its own, so the app stays consistent.

// ── Rows inside a tile ────────────────────────────────────────────────────────
// As the profile boards draw them: 13 pt above and below (66 pt with the 40 pt icon chip), 16 pt sides,
// a hairline between rows inset 16 pt from both edges, a 17 pt chevron. Rows stay full-width tap targets.

export function BentoRowGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useBento();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <BentoTile padding={0} style={style}>
      {rows.map((row, i) => (
        <View key={i}>
          {i > 0 ? <View style={{ height: 1, marginHorizontal: 16, backgroundColor: t.hair }} /> : null}
          {row}
        </View>
      ))}
    </BentoTile>
  );
}

export type RowTone = 'accent' | 'danger' | 'muted';

export function BentoRow({
  label,
  sublabel,
  value,
  icon,
  tone = 'accent',
  trailing,
  chevron,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  labelStyle,
}: {
  label: string;
  sublabel?: React.ReactNode;
  // Right-hand text, muted (e.g. "Light", "0821234567").
  value?: string;
  icon?: BentoIconName;
  // danger: red label and icon (Delete account, Log out).
  tone?: RowTone;
  trailing?: React.ReactNode;
  // Defaults to true when the row opens something.
  chevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  labelStyle?: StyleProp<TextStyle>;
}) {
  const { t } = useBento();
  const showChevron = chevron ?? Boolean(onPress);
  const ink = tone === 'danger' ? t.danger : t.ink;
  const chipBg = tone === 'danger' ? t.dangerSoft : tone === 'muted' ? t.seg : t.accentSoft;
  const chipFg = tone === 'danger' ? t.danger : tone === 'muted' ? t.muted : t.accent;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 13 }}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' }}>
          <BentoIcon name={icon} size={20} color={chipFg} strokeWidth={1.8} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[{ fontSize: 15, fontWeight: '600', color: ink }, labelStyle]}>{label}</Text>
        {sublabel ? (
          typeof sublabel === 'string' ? (
            <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{sublabel}</Text>
          ) : (
            sublabel
          )
        ) : null}
      </View>
      {value ? (
        <Text style={{ fontSize: 14, color: t.muted, maxWidth: '45%' }} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <BentoIcon name="chevronRight" size={17} color={t.muted} strokeWidth={2} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : 1, backgroundColor: pressed ? t.seg : 'transparent' })}
    >
      {body}
    </Pressable>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
// 12 pt semibold on a soft fill: accent (good), warn (under review, pending),
// muted (used, already redeemed, resolved), danger (expired, rejected).

export type PillTone = 'accent' | 'warn' | 'muted' | 'danger';

export function StatusPill({ label, tone = 'muted', style }: { label: string; tone?: PillTone; style?: StyleProp<ViewStyle> }) {
  const { t } = useBento();
  const c =
    tone === 'accent'
      ? { bg: t.accentSoft, fg: t.accent }
      : tone === 'warn'
        ? { bg: t.pillWarnBg, fg: t.pillWarnInk }
        : tone === 'danger'
          ? { bg: t.dangerSoft, fg: t.dangerInk }
          : { bg: t.seg, fg: t.muted };
  return (
    <View style={[{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: c.bg }, style]}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: c.fg }} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}

// ── Empty state, load error ───────────────────────────────────────────────────
// Centred in a tile: a 64 pt icon chip, a 22 pt title, a short line and an
// optional action (the boards' "No activity yet" card).

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  style,
}: {
  icon: BentoIconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useBento();
  return (
    <BentoTile padding={18} style={style}>
      <View style={{ alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          {/* 30 pt, stroke 1.7: every empty-state drawing on the boards (22 of 22). */}
          <BentoIcon name={icon} size={30} color={t.accent} strokeWidth={1.7} />
        </View>
        <Text accessibilityRole="header" style={[bentoType.number, { fontSize: 22, lineHeight: 26, color: t.ink, marginTop: 14, textAlign: 'center' }]}>
          {title}
        </Text>
        {body ? <Text style={[bentoType.body, { color: t.muted, marginTop: 6, maxWidth: 270, textAlign: 'center' }]}>{body}</Text> : null}
        {actionLabel && onAction ? (
          <BentoButton label={actionLabel} onPress={onAction} variant={actionVariant} nub={actionVariant === 'primary'} compact style={{ marginTop: 18, alignSelf: 'stretch' }} />
        ) : null}
      </View>
    </BentoTile>
  );
}

// For lists that failed to load (owner decision 24 Nov 2026: no silent failures).
export function LoadError({
  title = 'Couldn’t load this',
  body = 'Check your connection and try again.',
  onRetry,
  style,
}: {
  title?: string;
  body?: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return <EmptyState icon="info" title={title} body={body} actionLabel="Try again" actionVariant="secondary" onAction={onRetry} style={style} />;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
// The member's messages on the right in the accent colour, the club's on the
// left in a tile, each with a small time line under it (Enquiry chat board).

export function ChatDay({ label }: { label: string }) {
  const { t } = useBento();
  return <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '600', letterSpacing: 0.12 * 12, textTransform: 'uppercase', color: t.muted, marginVertical: 4 }}>{label}</Text>;
}

// `sender` labels the other side's bubbles (e.g. "Flagrr Support" in My Feedback).
export function ChatBubble({ text, mine, meta, sender }: { text: string; mine: boolean; meta?: string; sender?: string }) {
  const { t } = useBento();
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
      {sender ? <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted, marginLeft: 4 }}>{sender}</Text> : null}
      <View
        style={{
          maxWidth: '78%',
          paddingVertical: 12,
          paddingHorizontal: 15,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderBottomLeftRadius: mine ? 22 : 6,
          borderBottomRightRadius: mine ? 6 : 22,
          backgroundColor: mine ? t.accent : t.tile,
          boxShadow: `0 0 0 1px ${t.ring}`,
        }}
      >
        <Text style={{ fontSize: 15, lineHeight: 21, color: mine ? t.accentInk : t.ink }} selectable>
          {text}
        </Text>
      </View>
      {meta ? <Text style={{ fontSize: 12, color: t.muted }}>{meta}</Text> : null}
    </View>
  );
}

// Glass bar pinned under the thread: a rounded input and a round Send button.
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  sending = false,
  placeholder = 'Type a message…',
  bottomInset = 0,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  bottomInset?: number;
}) {
  const { t } = useBento();
  const canSend = value.trim().length > 0 && !sending;
  return (
    <Glass radius={0} style={{ borderWidth: 0, borderTopWidth: 1, borderColor: t.hair, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 + bottomInset, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        accessibilityLabel="Message"
        multiline
        // Web: a multiline field is a textarea that defaults to two rows; one row matches the 44 pt board
        // field (it still grows to maxHeight). Native ignores this for multiline sizing.
        {...(Platform.OS === 'web' ? { numberOfLines: 1 } : null)}
        style={[
          // 44 pt field, radius 22, 15 pt text (boards G-E-ChatLive / ChatSending); grows to 120 pt for long messages.
          { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, borderRadius: 22, borderWidth: 1, borderColor: t.hair, backgroundColor: t.tile, color: t.ink, fontSize: 15 },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null,
        ]}
      />
      <Pressable
        onPress={() => {
          if (!canSend) return;
          haptic.light();
          onSend();
        }}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend, busy: sending }}
        aria-busy={sending}
        // Boards: 44 pt; accent with the send icon when it can send, accent with a spinner while sending,
        // and grey (seg) with a muted icon while there is nothing to send.
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: canSend || sending ? t.accent : t.seg, alignItems: 'center', justifyContent: 'center' }}
      >
        {sending ? (
          <ActivityIndicator color={t.accentInk} size="small" />
        ) : (
          <BentoIcon name="send" size={20} color={canSend ? t.accentInk : t.muted} strokeWidth={1.8} />
        )}
      </Pressable>
    </Glass>
  );
}

// ── Picker sheet ──────────────────────────────────────────────────────────────
// A bottom sheet of large rows with a check on the current choice; optional
// search for long lists (Choose Golf Club). Replaces dropdowns (owner decision:
// the enquiry type picker uses the board's sheet).

export interface PickerOption<V extends string> {
  value: V;
  label: string;
  sublabel?: string;
}

export function PickerSheet<V extends string>({
  visible,
  title,
  subtitle,
  options,
  selected,
  onSelect,
  onClose,
  searchPlaceholder,
  emptyText = 'Nothing matches that search.',
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: PickerOption<V>[];
  selected?: V | null;
  onSelect: (value: V) => void;
  onClose: () => void;
  // Shown when set: filters options by label and sublabel.
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const { t } = useBento();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q));
  }, [options, query]);
  return (
    <BentoSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={() => {
        setQuery('');
        onClose();
      }}
    >
      {searchPlaceholder ? (
        <BentoField value={query} onChangeText={setQuery} placeholder={searchPlaceholder} accessibilityLabel={searchPlaceholder} rightIcon="search" containerStyle={{ marginBottom: 12 }} autoCorrect={false} />
      ) : null}
      {shown.length === 0 ? (
        <Text style={[bentoType.body, { color: t.muted, textAlign: 'center', paddingVertical: 18 }]}>{emptyText}</Text>
      ) : (
        <View style={{ borderRadius: L.fieldRadius, borderWidth: 1, borderColor: t.hair, overflow: 'hidden', backgroundColor: t.tile }}>
          {shown.map((o, i) => {
            const on = o.value === selected;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  haptic.selection();
                  setQuery('');
                  onSelect(o.value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, selected: on }}
                aria-checked={on}
                accessibilityLabel={o.label}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 56,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: t.hair,
                  backgroundColor: pressed ? t.seg : 'transparent',
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: on ? '600' : '500', color: t.ink }}>{o.label}</Text>
                  {o.sublabel ? <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{o.sublabel}</Text> : null}
                </View>
                {on ? <BentoIcon name="check" size={20} color={t.accent} strokeWidth={2} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </BentoSheet>
  );
}
