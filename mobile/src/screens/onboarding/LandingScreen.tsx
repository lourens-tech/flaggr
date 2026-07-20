import React from 'react';
import { ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { colors, fontFamily, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

// Placeholder aerial course photo — swap for the branded shot from Figma once
// the asset can be provided directly (see conversation re: asset access).
const BACKGROUND_URI =
  'https://images.unsplash.com/photo-1587174786738-5699a41ba0c2?w=1200&q=80';

export function LandingScreen({ navigation }: Props) {
  return (
    <ImageBackground source={{ uri: BACKGROUND_URI }} style={styles.background} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.logoRow}>
          <FlagrrLogo />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.darkGreen },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlayDarkGreen },
  safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: screenPadding, paddingTop: spacing.xxl },
  logoRow: { alignItems: 'center', marginTop: spacing.xl },
  headline: { alignItems: 'center', marginTop: -40 },
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
