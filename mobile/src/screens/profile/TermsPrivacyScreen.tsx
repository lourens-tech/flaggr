import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { colors, fontFamily, fontSize, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsPrivacy'>;

export function TermsPrivacyScreen({ navigation }: Props) {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Terms and Privacy" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Coming soon</Text>
          <Text style={styles.noticeBody}>
            Strand Golf Club's Terms of Use and Privacy Notice haven't been added to the app yet. Once the club
            provides its official terms and privacy policy, they'll appear here.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>In the meantime</Text>
        <Text style={styles.paragraph}>
          Flaggr collects the account details you provide (name, contact details, birthday) and your in-app activity
          (receipts scanned, Flagrr Bucks earned and redeemed) to run your loyalty account for {'“'}Strand Golf
          Club{'”'}. Contact the club directly using the Contact Us page if you have questions about how your
          information is used.
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding },
  noticeCard: {
    backgroundColor: colors.mintBgAlt,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  noticeTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.darkGreen, marginBottom: spacing.sm },
  noticeBody: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary, lineHeight: 20 },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.textPrimary, marginBottom: spacing.sm },
  paragraph: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary, lineHeight: 20 },
});
