import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { FaqAccordion } from '../../components/common/FaqAccordion';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { articles, faqs } from '../../data/faqData';
import { bentoBrand, bentoType } from '../../theme/bento';
import { Appear, BentoField, BentoIcon, BentoRow, BentoRowGroup, BentoScreen, BentoTile } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpCenter'>;

// Layout from G-E-HelpLive / HelpSearch / HelpNoResults. Copy is unchanged (the owner approves new text separately).
export function HelpCenterScreen({ navigation }: Props) {
  const { t } = useBento();
  const { user } = useApp();
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredArticles = useMemo(
    () =>
      normalizedQuery
        ? articles.filter((a) => a.title.toLowerCase().includes(normalizedQuery) || a.summary.toLowerCase().includes(normalizedQuery))
        : articles,
    [normalizedQuery],
  );
  const filteredFaqs = useMemo(
    () =>
      normalizedQuery
        ? faqs.filter((f) => f.question.toLowerCase().includes(normalizedQuery) || f.answer.toLowerCase().includes(normalizedQuery))
        : faqs,
    [normalizedQuery],
  );

  return (
    <BentoScreen title="Help Center" onBack={() => navigation.goBack()}>
      <View style={{ height: 2 }} />
      <Text style={{ fontSize: 15, color: t.muted }}>Hello, {user.firstName}</Text>
      <Text accessibilityRole="header" style={[bentoType.h1, { fontSize: 30, lineHeight: 31, color: t.ink }]}>
        How can we help you today?
      </Text>
      <BentoField placeholder="Search" accessibilityLabel="Search" rightIcon="search" value={query} onChangeText={setQuery} autoCorrect={false} />

      {/* Never filtered by the search. */}
      <Appear>
        <BentoTile tone="hero" padding={18} onPress={() => navigation.navigate('Contact')} accessibilityLabel="Contact Your Club">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <BentoIcon name="chatBubble" size={22} color={bentoBrand.lime} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: t.onHero }}>Contact Your Club</Text>
              <Text style={{ fontSize: 13, color: t.onHeroMuted, marginTop: 2 }}>Send a message and chat with your club's team</Text>
            </View>
            <BentoIcon name="chevronRight" size={16} color="rgba(255,255,255,0.8)" strokeWidth={1.8} />
          </View>
        </BentoTile>
      </Appear>

      {/* Hidden when no article matches. Articles are information only: they open nothing. */}
      {filteredArticles.length > 0 ? (
        <>
          <Heading>Latest Articles</Heading>
          <Appear>
            <BentoRowGroup>
              {filteredArticles.map((article) => (
                <BentoRow key={article.title} icon="docText" label={article.title} sublabel={article.summary} />
              ))}
            </BentoRowGroup>
          </Appear>
        </>
      ) : null}

      <Heading>Frequently Asked Questions</Heading>
      {filteredFaqs.length > 0 ? (
        <FaqAccordion items={filteredFaqs} />
      ) : (
        <Text style={{ fontSize: 14, lineHeight: 21, color: t.muted }}>No results for "{query.trim()}" — try a different search.</Text>
      )}
    </BentoScreen>
  );
}

function Heading({ children }: { children: string }) {
  const { t } = useBento();
  return (
    <Text accessibilityRole="header" style={[bentoType.h1, { fontSize: 22, lineHeight: 24, letterSpacing: -0.44, color: t.ink }]}>
      {children}
    </Text>
  );
}
