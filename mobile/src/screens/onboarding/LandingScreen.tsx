import React from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { IS_STORE_BUILD } from '../../config/buildConfig';
import { useBento } from '../../context/ThemeContext';
import { ONBOARDING_BACKGROUNDS } from '../../theme';
import { Appear, BentoButton } from '../../components/bento';
import { AuthBackdrop } from '../../components/bento/AuthBackdrop';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

// The opening screen (Bento Landing board): a club photo fading into the
// ground, the Flagrr wordmark, "Play. Earn. Redeem. Repeat." and the three
// ways in. The actions are the same as before.
export function LandingScreen({ navigation }: Props) {
  const { t } = useBento();
  const insets = useSafeAreaInsets();
  const line = { fontFamily: 'Fraunces_700Bold', fontSize: 52, lineHeight: 52, letterSpacing: -1.56, color: t.ink } as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <StatusBar barStyle="light-content" />
      <AuthBackdrop photo={ONBOARDING_BACKGROUNDS.signUpStep1} height={560} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32, paddingHorizontal: 24 }}>
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
            <Pressable onPress={() => navigation.navigate('AdminLogin')} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.muted }}>Golf Course Admin Login</Text>
            </Pressable>
          )}
          <Text style={{ fontSize: 13, lineHeight: 18, color: t.muted, textAlign: 'center' }}>
            By continuing, you're accepting our <Text style={{ fontWeight: '600', color: t.ink }}>Terms of Use</Text> and{' '}
            <Text style={{ fontWeight: '600', color: t.ink }}>Privacy Notice</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
