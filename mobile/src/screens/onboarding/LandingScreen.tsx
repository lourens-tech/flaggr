import React from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { IS_STORE_BUILD } from '../../config/buildConfig';
import { useBento } from '../../context/ThemeContext';
import { ONBOARDING_BACKGROUNDS } from '../../theme';
import { bentoLayout as L } from '../../theme/bento';
import { Appear, BentoButton } from '../../components/bento';
import { AuthBackdrop } from '../../components/bento/AuthBackdrop';
import { BOARD_TOP, LegalLine } from './authParts';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

// The opening screen (Bento boards AppLanding and, for the store build,
// G-A-LandingStore): a club photo fading into the ground, the Flagrr
// wordmark, "Play. Earn. Redeem. Repeat." and the ways in. Terms of Use and
// Privacy Notice open Terms and Privacy (owner decision 24 Nov 2026).
export function LandingScreen({ navigation }: Props) {
  const { t } = useBento();
  const insets = useSafeAreaInsets();
  const line = { fontFamily: 'Fraunces_700Bold', fontSize: 52, lineHeight: Math.round(52 * 0.98), letterSpacing: -1.56, color: t.ink } as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <StatusBar barStyle="light-content" />
      <AuthBackdrop photo={ONBOARDING_BACKGROUNDS.signUpStep1} height={560} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          // The wordmark sits 64 pt from the top on the boards (2 pt below the content line of the other sign-in screens).
          paddingTop: Math.max(insets.top + 8, BOARD_TOP) + 2,
          paddingBottom: insets.bottom + 40,
          paddingLeft: L.screenPadding + insets.left,
          paddingRight: L.screenPadding + insets.right,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <FlagrrLogo color="white" size={48} />
        </View>
        <View style={{ flex: 1, minHeight: 200 }} />
        <Appear>
          <View accessible accessibilityRole="header" accessibilityLabel="Play. Earn. Redeem. Repeat." style={{ marginBottom: 18 }}>
            <Text style={line}>Play.</Text>
            <Text style={line}>Earn.</Text>
            <Text style={line}>Redeem.</Text>
            <Text style={[line, { color: t.accent }]}>Repeat.</Text>
          </View>
        </Appear>
        <View style={{ gap: 12 }}>
          <BentoButton label="Get Started" nub onPress={() => navigation.navigate('SignUpStep1')} />
          <BentoButton label="I already have an account" variant="secondary" onPress={() => navigation.navigate('Login')} />
          {IS_STORE_BUILD ? null : (
            <Pressable
              onPress={() => navigation.navigate('AdminLogin')}
              accessibilityRole="button"
              // Padding, not hitSlop: react-native-web's Pressable ignores hitSlop, and this link is
              // web only. 12 pt all round gives a 44 pt target; the negative margins keep it where the board draws it.
              style={{ alignSelf: 'center', marginTop: -4, marginBottom: -12, padding: 12 }}
            >
              <Text style={{ fontSize: 13, color: t.muted }}>Golf Course Admin Login</Text>
            </Pressable>
          )}
          <LegalLine
            style={{ marginTop: 8 }}
            onTerms={() => navigation.navigate('TermsPrivacy', { section: 'terms' })}
            onPrivacy={() => navigation.navigate('TermsPrivacy', { section: 'privacy' })}
          />
        </View>
      </ScrollView>
    </View>
  );
}
