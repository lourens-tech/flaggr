import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from 'react-native';
import { useBento } from '../../context/ThemeContext';
import { BentoIcon, BentoTile } from '../bento';
import type { FaqEntry } from '../../data/faqData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// One Bento tile per question (G-E-HelpLive, G-E-ContactFAQ): the question and
// an accent chevron that turns when open, the answer under it. One open at a
// time; tapping the open one closes it.
export function FaqAccordion({ items, initialOpenIndex = 0 }: { items: FaqEntry[]; initialOpenIndex?: number }) {
  const { t } = useBento();
  const [openIndex, setOpenIndex] = useState<number | null>(initialOpenIndex);

  const toggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <View style={{ gap: 12 }}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <BentoTile key={item.question} padding={0} innerStyle={{ paddingVertical: 10, paddingHorizontal: 16 }}>
            <Pressable
              onPress={() => toggle(index)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: t.ink }}>{item.question}</Text>
              <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
                <BentoIcon name="chevronDown" size={18} color={t.accent} strokeWidth={2} />
              </View>
            </Pressable>
            {isOpen ? <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 21, color: t.muted }}>{item.answer}</Text> : null}
          </BentoTile>
        );
      })}
    </View>
  );
}
