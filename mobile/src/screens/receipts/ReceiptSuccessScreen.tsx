import React, { useMemo } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { fontFamily, fontSize, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptSuccess'>;

export function ReceiptSuccessScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Your Reward" onBack={() => navigation.navigate('Main')} />
      </SafeAreaView>

      <View style={styles.content}>
        <View style={styles.trophyCircle}>
          <Ionicons name="trophy" size={64} color={colors.lime} />
        </View>

        <Text style={styles.title}>Receipt Scanned{'\n'}Successfully!</Text>
        <Text style={styles.subtitle}>
          +{route.params.pointsAwarded} Flagrr Cash have been added to your wallet!
        </Text>
        <Text style={styles.body}>
          Your new Flagrr Cash balance is now available in your wallet and ready to redeem on rewards.{'\n\n'}
          Play more rounds, scan your receipts, and redeem rewards to unlock higher membership tiers and exclusive
          benefits.
        </Text>

        <View style={{ height: spacing.xl }} />
        <PillButton label="View Current Balance" onPress={() => navigation.navigate('Main')} />
        <View style={{ height: spacing.md }} />
        <PillButton
          label="Submit Another Receipt"
          variant="outline"
          icon={null}
          onPress={() => navigation.replace('ScanReceipt')}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { flex: 1, paddingHorizontal: screenPadding, alignItems: 'center', justifyContent: 'center' },
  trophyCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.darkGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.title,
    color: colors.clubGreen,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
}
