import React, { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { FaqAccordion } from '../../components/common/FaqAccordion';
import { useApp } from '../../context/AppContext';
import { articles, faqs } from '../../data/faqData';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpCenter'>;

export function HelpCenterScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useApp();
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredArticles = useMemo(
    () =>
      normalizedQuery
        ? articles.filter(
            (a) => a.title.toLowerCase().includes(normalizedQuery) || a.summary.toLowerCase().includes(normalizedQuery),
          )
        : articles,
    [normalizedQuery],
  );
  const filteredFaqs = useMemo(
    () =>
      normalizedQuery
        ? faqs.filter(
            (f) => f.question.toLowerCase().includes(normalizedQuery) || f.answer.toLowerCase().includes(normalizedQuery),
          )
        : faqs,
    [normalizedQuery],
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Help Center" onBack={() => navigation.goBack()} />
        <View style={styles.heroContent}>
          <Text style={styles.welcome}>Hello, {user.firstName} 👋</Text>
          <Text style={styles.heroTitle}>How can we help you today?</Text>
          <TextField icon="search" placeholder="Search" variant="onLight" value={query} onChangeText={setQuery} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.supportRow} onPress={() => navigation.navigate('SupportTickets')} activeOpacity={0.85}>
          <Ionicons name="headset-outline" size={20} color={colors.clubGreen} />
          <View style={{ flex: 1 }}>
            <Text style={styles.supportTitle}>Contact Flagrr Support</Text>
            <Text style={styles.supportSubtitle}>Log a ticket and chat with our support team</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {filteredArticles.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Latest Articles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {filteredArticles.map((article) => (
                <View key={article.title} style={styles.articleCard}>
                  <View style={styles.articleAccent} />
                  <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
                  <Text style={styles.articleSummary} numberOfLines={2}>{article.summary}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Frequently Asked Questions</Text>
        {filteredFaqs.length > 0 ? (
          <FaqAccordion items={filteredFaqs} />
        ) : (
          <Text style={styles.emptyText}>No results for "{query.trim()}" — try a different search.</Text>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.darkGreen, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  heroContent: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  welcome: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.body, color: colors.white },
  heroTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.white, marginVertical: spacing.md, lineHeight: 32 },
  content: { padding: screenPadding },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  supportTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  supportSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary },
  articleCard: {
    width: 140,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'rgba(31,66,52,0.1)',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  articleAccent: { width: 24, height: 3, backgroundColor: colors.clubGreen, borderRadius: 2, marginBottom: spacing.sm },
  articleTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textPrimary },
  articleSummary: { fontFamily: fontFamily.body, fontSize: 9, color: colors.textSecondary, marginTop: 4 },
});
}
