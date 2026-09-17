import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { useApp } from '../../context/AppContext';
import { ApiError, type ReferralInfo } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Referral'>;

export function ReferralScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { getReferralInfo } = useApp();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReferralInfo()
      .then(setInfo)
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t load your referral code', message);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = async () => {
    if (!info) return;
    try {
      await Share.share({
        message: `Join me on Flagrr! Use my referral code ${info.code} when you sign up and we both earn Flagrr Cash.`,
      });
    } catch {
      // Share sheet dismissed/cancelled — nothing to do.
    }
  };

  const capped = info ? info.redeemedCount >= info.maxRedemptions : false;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Refer a Friend" onBack={() => navigation.goBack()} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Earn Flagrr Cash</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : !info ? null : (
        <View style={styles.content}>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your referral code</Text>
            <Text style={styles.code}>{info.code}</Text>
            <PillButton label="Share My Code" icon="share-social-outline" onPress={handleShare} />
            <Text style={styles.progressText}>
              {capped
                ? `You've reached the ${info.maxRedemptions}-referral limit — thank you!`
                : `${info.redeemedCount} of ${info.maxRedemptions} referral bonuses earned`}
            </Text>
          </View>

          <View style={{ height: spacing.lg }} />
          <Text style={styles.sectionLabel}>How it works</Text>

          <View style={styles.explainerRow}>
            <View style={styles.explainerIconChip}>
              <Ionicons name="person-add-outline" size={18} color={colors.clubGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.explainerTitle}>Refer a friend</Text>
              <Text style={styles.explainerBody}>
                When a friend signs up and enters your code, you get{' '}
                <Text style={styles.explainerBold}>{info.memberBonus} Flagrr Cash</Text>.
              </Text>
            </View>
          </View>

          <View style={{ height: spacing.md }} />
          <View style={styles.explainerRow}>
            <View style={styles.explainerIconChip}>
              <Ionicons name="golf-outline" size={18} color={colors.clubGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.explainerTitle}>Refer a golf club</Text>
              <Text style={styles.explainerBody}>
                When a golf club signs up for Flagrr using your code, you get{' '}
                <Text style={styles.explainerBold}>{info.courseBonus} Flagrr Cash</Text>.
              </Text>
            </View>
          </View>

          <View style={{ height: spacing.lg }} />
          <Text style={styles.footnote}>
            Your bonus is credited as soon as your friend's account is created, or once a referred club's first
            payment clears — you'll see it in your Activity feed and get a notification.
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.darkGreen },
  heroContent: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl, paddingTop: spacing.md },
  heroTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.white },
  content: { padding: screenPadding },
  codeCard: {
    backgroundColor: colors.mintBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeLabel: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary },
  code: { fontFamily: fontFamily.heading, fontSize: 34, letterSpacing: 4, color: colors.darkGreen, marginBottom: spacing.xs },
  progressText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  sectionLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary, marginBottom: spacing.sm },
  explainerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  explainerIconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.mintBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explainerTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  explainerBody: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 2, lineHeight: 19 },
  explainerBold: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
  footnote: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textMuted, lineHeight: 17 },
});
}
