import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont } from '../../theme/admin';
import { PressableScale } from '../motion';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  // Tab-root screens (Home, etc.) aren't reached by pushing a stack screen,
  // so there's nothing to go "back" to — hide the chevron there and put a
  // bell/avatar or similar in `right` instead.
  showBack?: boolean;
  right?: React.ReactNode;
}

// The admin consoles' phone header: an iOS-style back button and actions on
// top, a large Fraunces title underneath, sitting straight on the club's
// backdrop. Member-facing and onboarding screens keep ScreenHeader.
export function AdminMobileHeader({ title, subtitle, onBack, showBack = true, right }: Props) {
  const { c, scheme } = useAdminTheme();
  const navigation = useNavigation();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {showBack || right ? (
        <View style={styles.topRow}>
          {showBack ? (
            <PressableScale
              onPress={onBack ?? (() => navigation.goBack())}
              hitSlop={12}
              style={styles.back}
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={24} color={c.accentText} />
              <Text style={[styles.backText, { color: c.accentText }]}>Back</Text>
            </PressableScale>
          ) : null}
          <View style={{ flex: 1 }} />
          {right}
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: c.ink2 }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', marginLeft: -8, height: 44, paddingRight: 8 },
  backText: { ...adminFont.body, fontSize: 17 },
  title: { ...adminFont.title, fontSize: 32, letterSpacing: -0.5, lineHeight: 38, marginTop: 6 },
  subtitle: { ...adminFont.body, fontSize: 14.5, lineHeight: 20, marginTop: 4 },
});
