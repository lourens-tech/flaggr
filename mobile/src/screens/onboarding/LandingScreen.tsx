import React from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { FadeIn } from '../../components/motion';
import { AdminButton, FLAGRR_BACKDROP, Glass } from '../../components/admin/ui';
import { IS_STORE_BUILD } from '../../config/buildConfig';
import { AdminThemeScope, useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

// White and lime sit straight on the darkened photo in both themes (as on the
// admin sign-in screen); only the glass panel follows light and dark.
const ON_PHOTO = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(244,245,240,0.72)';
const LIME = '#CDDE5C';
const SCRIM = ['rgba(6,14,10,0.42)', 'rgba(6,14,10,0.78)'] as const;

// The opening screen wears the sign-in screens' Liquid Glass look, so it
// borrows the admin theme. It stays mounted under the member login and
// sign-up screens, so it leaves out the admin alert host: their alerts keep
// the member style.
export function LandingScreen(props: Props) {
  return (
    <AdminThemeScope alerts={false}>
      <Landing {...props} />
    </AdminThemeScope>
  );
}

function Landing({ navigation }: Props) {
  const { c } = useAdminTheme();
  const { width } = useWindowDimensions();
  // Desktop puts the headline and the panel side by side; phones, foldables
  // and tablets stack them.
  const wide = width >= 900;
  const titleSize = wide ? 84 : width >= 600 ? 68 : width < 360 ? 44 : 52;
  const line = {
    ...adminFont.title,
    fontSize: titleSize,
    lineHeight: Math.round(titleSize * 0.96),
    letterSpacing: -0.02 * titleSize,
    color: ON_PHOTO,
    textAlign: wide ? 'left' : 'center',
  } as const;

  const logo = (
    <FadeIn>
      <FlagrrLogo color="lime" size={wide ? 84 : 72} style={wide ? null : styles.center} />
    </FadeIn>
  );

  // Fraunces only; the Ws Paradose demo build can't draw the full stops.
  const headline = (
    <FadeIn distance={16}>
      <View accessible accessibilityRole="header" accessibilityLabel="Play. Earn. Redeem. Repeat.">
        <Text style={line}>Play.</Text>
        <Text style={line}>Earn.</Text>
        <Text style={[line, adminFont.titleItalic, { color: LIME }]}>Redeem.</Text>
        <Text style={line}>Repeat.</Text>
      </View>
    </FadeIn>
  );

  const panel = (
    <View style={styles.panel}>
      <FadeIn distance={24}>
        <Glass radius={adminRadius.lg} style={styles.card}>
          <AdminButton
            label="Get Started"
            variant="accent"
            size="lg"
            fullWidth
            iconRight="arrow-forward"
            onPress={() => navigation.navigate('SignUpStep1')}
          />
          {IS_STORE_BUILD ? null : (
            <AdminButton
              label="Golf Course Admin Login"
              variant="glass"
              size="lg"
              fullWidth
              icon="business-outline"
              onPress={() => navigation.navigate('AdminLogin')}
              style={styles.secondary}
            />
          )}
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Login')} accessibilityRole="button">
            <Text style={[styles.linkText, { color: c.accentText }]}>I already have an account</Text>
          </TouchableOpacity>
        </Glass>
      </FadeIn>
      <FadeIn>
        <Text style={styles.terms}>
          By continuing, you're accepting our <Text style={styles.termsBold}>Terms of Use</Text> and{' '}
          <Text style={styles.termsBold}>Privacy Notice</Text>
        </Text>
      </FadeIn>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.base }]}>
      <StatusBar barStyle="light-content" />
      <Image source={FLAGRR_BACKDROP} resizeMode="cover" style={styles.photo} accessible={false} />
      <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.scroll, wide && styles.scrollWide]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {wide ? (
            <View style={styles.row}>
              <View style={styles.intro}>
                {logo}
                <View style={styles.headlineWide}>{headline}</View>
              </View>
              {panel}
            </View>
          ) : (
            <>
              {logo}
              <View style={styles.headline}>{headline}</View>
              {panel}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // react-native-web's <Image> bakes the asset's intrinsic size into its own
  // style, which otherwise wins over absoluteFill's insets.
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16 },
  scrollWide: { justifyContent: 'center', paddingHorizontal: 48, paddingVertical: 48 },
  center: { alignSelf: 'center' },
  headline: { paddingVertical: 28 },
  row: { width: '100%', maxWidth: 1080, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 48 },
  intro: { flexShrink: 1 },
  headlineWide: { marginTop: 36 },
  panel: { width: 420, maxWidth: '100%' },
  card: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  secondary: { marginTop: 12 },
  linkRow: { alignItems: 'center', justifyContent: 'center', marginTop: 6, minHeight: 44 },
  linkText: { ...adminFont.bodySemiBold, fontSize: 14 },
  terms: { ...adminFont.body, fontSize: 12.5, lineHeight: 18, color: ON_PHOTO_MUTED, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
  termsBold: { ...adminFont.bodySemiBold, color: ON_PHOTO },
});
