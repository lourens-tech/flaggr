import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { useApp } from '../../context/AppContext';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Voucher'>;

export function VoucherScreen({ route, navigation }: Props) {
  const { vouchers, rewards } = useApp();
  const voucher = vouchers.find((v) => v.id === route.params.voucherId);
  const reward = rewards.find((r) => r.id === voucher?.rewardId);

  if (!voucher || !reward) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Voucher" />
        <View style={styles.center}>
          <Text style={styles.fallbackText}>Voucher not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Voucher" />
      </SafeAreaView>

      <View style={styles.content}>
        <LinearGradient
          colors={[colors.clubGreen, colors.darkGreen]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.card}
        >
          <View style={styles.qrWrapper}>
            <QRCode value={voucher.qrValue} size={180} backgroundColor={colors.white} color={colors.darkGreen} />
          </View>
          <Text style={styles.redeemedTitle}>Reward Redeemed</Text>
          <Text style={styles.redeemedSubtitle}>
            Your reward has been successfully redeemed. Present your QR code or voucher code at the club to claim.
          </Text>
          <View style={styles.rewardPill}>
            <Text style={styles.rewardPillText}>{reward.title}</Text>
          </View>
          <Text style={styles.codeLabel}>Voucher Code</Text>
          <Text style={styles.codeValue}>{voucher.code}</Text>
        </LinearGradient>

        <View style={{ height: spacing.xl }} />
        <PillButton label="Back to Rewards" variant="dark" onPress={() => navigation.navigate('Main')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { fontFamily: fontFamily.body, color: colors.textSecondary },
  content: { flex: 1, paddingHorizontal: screenPadding, paddingTop: spacing.lg, justifyContent: 'center' },
  card: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center' },
  qrWrapper: { backgroundColor: colors.white, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  redeemedTitle: { fontFamily: fontFamily.heading, fontSize: 28, color: colors.lime, marginBottom: spacing.sm },
  redeemedSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  rewardPill: {
    backgroundColor: colors.clubGreen,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  rewardPillText: { fontFamily: fontFamily.heading, fontSize: fontSize.button, color: colors.white },
  codeLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.white },
  codeValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.white, marginTop: 2 },
});
