import React from 'react';
import { Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { ONBOARDING_BACKGROUNDS, colors, fontFamily, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

export function LandingScreen({ navigation }: Props) {
  return (
    <View style={styles.background}>
      {/* ImageBackground's inner <img> doesn't respect resizeMode="cover" on
          web (renders at native pixel size, causing horizontal overflow and a
          gap below) — an absolutely-positioned Image is the reliable fix. */}
      <Image
        source={ONBOARDING_BACKGROUNDS.landing}
        style={[StyleSheet.absoluteFill, styles.backgroundImageSize]}
        resizeMode="cover"
      />
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.logoRow}>
          <FlagrrLogo size={88} />
        </View>

        <View style={styles.headline}>
          <Text style={styles.headlineText}>
            <Text style={styles.headlineWord}>Play</Text>.
          </Text>
          <Text style={styles.headlineText}>
            <Text style={styles.headlineWord}>Earn</Text>.
          </Text>
          <Text style={[styles.headlineText, { color: colors.lime }]}>
            <Text style={[styles.headlineWord, { color: colors.lime }]}>Redeem</Text>.
          </Text>
          <Text style={styles.headlineText}>
            <Text style={styles.headlineWord}>Repeat</Text>.
          </Text>
        </View>

        <View style={styles.footer}>
          <PillButton label="Get Started" onPress={() => navigation.navigate('SignUpStep1')} />
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.lg }}>
            <Text style={styles.loginLink}>I already have an account</Text>
          </TouchableOpacity>
          <Text style={styles.terms}>
            By continuing, you're accepting our{' '}
            <Text style={styles.termsBold}>Terms of Use</Text> and{' '}
            <Text style={styles.termsBold}>Privacy Notice</Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.darkGreen },
  // react-native-web's <Image> bakes the source asset's intrinsic width/height
  // into its own style array, which otherwise wins over absoluteFill's inset
  // properties — explicit 100% here overrides that.
  backgroundImageSize: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlayDarkGreen },
  safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: screenPadding, paddingTop: spacing.xl },
  logoRow: { alignItems: 'center', marginTop: spacing.md },
  headline: { alignItems: 'center', marginTop: -20 },
  headlineText: {
    // The period itself stays on Fraunces — the Ws Paradose demo build
    // substitutes a watermark glyph for "." (see typography.ts).
    fontFamily: fontFamily.heading,
    fontSize: 44,
    lineHeight: 52,
    color: colors.white,
  },
  headlineWord: {
    fontFamily: fontFamily.headingDisplay,
  },
  footer: { alignItems: 'center', paddingBottom: spacing.lg },
  loginLink: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.white },
  terms: {
    fontFamily: fontFamily.bodyLight,
    fontSize: 12,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 18,
  },
  termsBold: { fontFamily: fontFamily.bodyMedium },
});
