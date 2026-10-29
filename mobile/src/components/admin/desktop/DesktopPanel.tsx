import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminTheme } from '../../../context/ThemeContext';
import { useHover, hoverTransition } from '../../../hooks/useHover';
import { adminFont, adminRadius } from '../../../theme/admin';
import { FadeIn } from '../../motion';

interface Props {
  title: string;
  onViewAll?: () => void;
  viewAllLabel?: string;
  children: React.ReactNode;
  style?: object;
}

// Opaque tile that groups a block of content (a chart, a list, a table) under
// a heading, with an optional "View all" link.
export function DesktopPanel({ title, onViewAll, viewAllLabel = 'View all', children, style }: Props) {
  const { c, scheme } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <FadeIn
      style={[
        styles.panel,
        { backgroundColor: c.surface, borderColor: c.edge, shadowOpacity: scheme === 'dark' ? 0.3 : 0.08 },
        style,
      ]}
    >
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>{title}</Text>
        {onViewAll ? (
          <Pressable
            style={styles.link}
            onPress={onViewAll}
            accessibilityRole="link"
            accessibilityLabel={`${viewAllLabel}: ${title}`}
            onHoverIn={hoverHandlers.onMouseEnter}
            onHoverOut={hoverHandlers.onMouseLeave}
          >
            <Text style={[styles.linkText, { color: c.accentText }, hovered && styles.linkTextHover]}>{viewAllLabel}</Text>
            <Ionicons name="chevron-forward" size={13} color={c.accentText} style={[hoverTransition, hovered && styles.chevronHover] as never} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: adminRadius.md,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 30,
    elevation: 2,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...adminFont.bodyBold, fontSize: 17 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 32 },
  linkText: { ...adminFont.bodySemiBold, fontSize: 14 },
  linkTextHover: { textDecorationLine: 'underline' },
  chevronHover: { transform: [{ translateX: 2 }] },
});
