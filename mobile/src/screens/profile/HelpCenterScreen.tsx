import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { FaqAccordion } from '../../components/common/FaqAccordion';
import { useApp } from '../../context/AppContext';
import { articles, faqs } from '../../data/faqData';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpCenter'>;

export function HelpCenterScreen({ navigation }: Props) {
  const { user } = useApp();
  const [query, setQuery] = useState('');

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
        <Text style={styles.sectionLabel}>Latest Articles</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {articles.map((article) => (
            <View key={article.title} style={styles.articleCard}>
              <View style={styles.articleAccent} />
              <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
              <Text style={styles.articleSummary} numberOfLines={2}>{article.summary}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Frequently Asked Questions</Text>
        <FaqAccordion items={faqs} />

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.darkGreen, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  heroContent: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  welcome: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.body, color: colors.white },
  heroTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.white, marginVertical: spacing.md, lineHeight: 32 },
  content: { padding: screenPadding },
  sectionLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary, marginBottom: spacing.sm },
  articleCard: {
    width: 140,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(31,66,52,0.1)',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  articleAccent: { width: 24, height: 3, backgroundColor: colors.clubGreen, borderRadius: 2, marginBottom: spacing.sm },
  articleTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textPrimary },
  articleSummary: { fontFamily: fontFamily.body, fontSize: 9, color: colors.textSecondary, marginTop: 4 },
});
