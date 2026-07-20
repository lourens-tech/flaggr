import React, { useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';
import type { FaqEntry } from '../../data/faqData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function FaqAccordion({ items, initialOpenIndex = 0 }: { items: FaqEntry[]; initialOpenIndex?: number }) {
  const [openIndex, setOpenIndex] = useState<number | null>(initialOpenIndex);

  const toggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <TouchableOpacity key={item.question} style={styles.card} onPress={() => toggle(index)} activeOpacity={0.8}>
            <View style={styles.headerRow}>
              <Text style={styles.question}>{item.question}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.clubGreen} />
            </View>
            {isOpen ? <Text style={styles.answer}>{item.answer}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.mintBgAlt, borderRadius: radius.md, padding: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  question: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary, marginRight: spacing.sm },
  answer: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
});
