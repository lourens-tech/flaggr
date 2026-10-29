import React from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { useAdmin } from '../../context/AdminContext';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { AdminButton, FLAGRR_BACKDROP, Glass } from '../../components/admin/ui';

const SCRIM = ['rgba(6,14,10,0.5)', 'rgba(6,14,10,0.72)'] as const;

// Shown exactly once — right after a staff account completes its forced
// first-login password change (see AdminContext.changePassword /
// staffWelcomePending) — before landing on the normal Vouchers/Profile tabs.
export function AdminStaffWelcomeScreen() {
  const { c, scheme } = useAdminTheme();
  const { width } = useWindowDimensions();
  // Wide windows get a glass card. Phones in dark mode put the content
  // straight on the darkened photo; in light mode it needs the card.
  const glassCard = width >= 600 || scheme === 'light';
  const { admin, course, dismissStaffWelcome } = useAdmin();

  const content = (
    <>
      <View style={[styles.icon, { backgroundColor: c.fill }]}>
        <Ionicons name="qr-code-outline" size={30} color={c.icon} />
      </View>
      {/* Fraunces (adminFont.title) keeps the comma intact in this dynamic title. */}
      <Text accessibilityRole="header" style={[styles.headerTitle, { color: c.ink }]}>
        Welcome, {admin.firstName}
      </Text>
      <Text style={[styles.title, { color: c.ink }]}>You're all set up</Text>
      <Text style={[styles.subtitle, { color: c.ink2 }]}>
        You have access to {course.name}'s Vouchers tab, so you can validate members' reward vouchers at the club.
      </Text>

      <View style={styles.steps}>
        <View style={styles.stepRow}>
          <Ionicons name="scan-outline" size={20} color={c.icon} />
          <Text style={[styles.stepText, { color: c.ink2 }]}>Scan the QR code a member shows you, or enter their voucher code manually.</Text>
        </View>
        <View style={[styles.stepRow, styles.stepDivider, { borderTopColor: c.edge }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={c.icon} />
          <Text style={[styles.stepText, { color: c.ink2 }]}>Confirm the reward, and it's validated — the code can't be reused.</Text>
        </View>
      </View>

      <AdminButton label="Get Started" variant="accent" size="lg" fullWidth onPress={dismissStaffWelcome} style={styles.primary} />
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.base }]}>
      <StatusBar barStyle="light-content" />
      <Image source={FLAGRR_BACKDROP} resizeMode="cover" style={styles.photo} accessible={false} />
      <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.mark}>
            <FlagrrLogo color="lime" showTagline={false} size={72} />
          </View>

          {glassCard ? (
            <Glass radius={adminRadius.lg} style={[styles.card, styles.cardGlass]}>
              {content}
            </Glass>
          ) : (
            <View style={styles.card}>{content}</View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 32 },
  mark: { alignItems: 'center', marginBottom: 22 },
  card: { width: 420, maxWidth: '100%', paddingVertical: 8 },
  cardGlass: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 22 },
  icon: { alignSelf: 'center', width: 60, height: 60, borderRadius: adminRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  headerTitle: { ...adminFont.title, fontSize: 34, letterSpacing: -0.6, textAlign: 'center' },
  title: { ...adminFont.bodyBold, fontSize: 18, textAlign: 'center', marginTop: 14 },
  subtitle: { ...adminFont.body, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  steps: { marginTop: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  stepDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  stepText: { flex: 1, ...adminFont.body, fontSize: 13.5, lineHeight: 19 },
  primary: { marginTop: 14 },
});
