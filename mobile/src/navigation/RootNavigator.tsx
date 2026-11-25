import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { VoucherScreen } from '../screens/rewards/VoucherScreen';
import { ScanFlowNavigator } from './ScanFlowNavigator';
import { MyGolfScreen } from '../screens/golf/MyGolfScreen';
import { RewardsActivityScreen } from '../screens/rewards/RewardsActivityScreen';
import { MemberTabBar } from './MemberTabBar';
import { ReceiptHistoryScreen } from '../screens/receipts/ReceiptHistoryScreen';
import { MemberTiersScreen } from '../screens/profile/MemberTiersScreen';
import { NotificationsScreen } from '../screens/profile/NotificationsScreen';
import { HelpCenterScreen } from '../screens/profile/HelpCenterScreen';
import { ContactScreen } from '../screens/profile/ContactScreen';
import { GiveFeedbackScreen } from '../screens/profile/GiveFeedbackScreen';
import { ReferralScreen } from '../screens/profile/ReferralScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { TermsPrivacyScreen } from '../screens/profile/TermsPrivacyScreen';
import { MyEnquiriesScreen } from '../screens/profile/MyEnquiriesScreen';
import { EnquiryChatScreen } from '../screens/profile/EnquiryChatScreen';
import { MyFeedbackScreen } from '../screens/profile/MyFeedbackScreen';
import { FeedbackThreadScreen } from '../screens/profile/FeedbackThreadScreen';
import { NotificationPreferencesScreen } from '../screens/profile/NotificationPreferencesScreen';
import { RoundSetupScreen } from '../screens/golf/RoundSetupScreen';
import { CourseGuideScreen } from '../screens/golf/CourseGuideScreen';
import { RoundDetailScreen } from '../screens/golf/RoundDetailScreen';
import { AdminNavigator } from './AdminNavigator';
import { SuperAdminNavigator } from './SuperAdminNavigator';
import { AdminForceChangePasswordScreen } from '../screens/admin/AdminForceChangePasswordScreen';
import { AdminStaffWelcomeScreen } from '../screens/admin/AdminStaffWelcomeScreen';
import { withAdminScope } from '../components/admin/AdminScope';

const ScopedForceChangePassword = withAdminScope(AdminForceChangePasswordScreen);
const ScopedStaffWelcome = withAdminScope(AdminStaffWelcomeScreen);
import { fadeOptions, modalOptions, pushOptions } from './transitions';
import { useApp } from '../context/AppContext';
import { useAdmin } from '../context/AdminContext';
import { useBento, useThemeColors, type ThemeColors } from '../context/ThemeContext';

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Member screens sit on the Bento ground. The tab cross-fade shows what's
  // behind the tab scenes for a moment, so the Main screen's own background
  // must be the ground too (not the navigation default light grey).
  const { t } = useBento();
  const { isAuthenticated, isInitializing } = useApp();
  const { isAdminAuthenticated, isInitializing: isAdminInitializing, admin, staffWelcomePending } = useAdmin();

  if (isInitializing || isAdminInitializing) {
    // Restoring a stored session (member and/or admin) before deciding which
    // stack to mount — avoids a flash of the Landing screen on a warm start.
    return (
      <View style={[styles.loading, { backgroundColor: t.ground }]}>
        <ActivityIndicator color={t.accent} size="large" />
      </View>
    );
  }

  const memberSignedIn = isAuthenticated && !isAdminAuthenticated;

  return (
    <Stack.Navigator
      // JS stack so the Bento prototype's transitions are exact (navigation/transitions.ts).
      // headerMode 'float' (iOS's default; no header is shown anywhere): on web, @react-navigation/stack
      // otherwise puts the focused card in "page" mode (min-height 100%) so the browser page scrolls,
      // but Expo's web body never scrolls, so pushed screens could not scroll at all (CardContent.tsx).
      screenOptions={() => ({ ...pushOptions(), headerShown: false, headerMode: 'float' })}
      // Black behind the screens: what shows around a screen that shrinks under the scan flow.
      layout={({ children, state, navigation }) => (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {children}
          {memberSignedIn ? <MemberTabBar state={state} navigation={navigation} /> : null}
        </View>
      )}
    >
      {isAdminAuthenticated ? (
        // A course-admin/staff session takes priority — these are separate
        // identities (see api/_lib/auth.ts), but a device is realistically
        // either a staff device or a member's, not both at once. A staff
        // member with a system-generated temp password must set their own
        // before they can reach any other screen.
        admin.mustChangePassword ? (
          <Stack.Screen name="AdminForceChangePassword" component={ScopedForceChangePassword} options={fadeOptions} />
        ) : staffWelcomePending ? (
          <Stack.Screen name="AdminStaffWelcome" component={ScopedStaffWelcome} options={fadeOptions} />
        ) : admin.role === 'super_admin' || admin.role === 'support_agent' ? (
          <Stack.Screen name="SuperAdminMain" component={SuperAdminNavigator} options={fadeOptions} />
        ) : (
          <Stack.Screen name="AdminMain" component={AdminNavigator} options={fadeOptions} />
        )
      ) : isAuthenticated ? (
        <>
          {/* Signing in cross-fades into the app (and signing out back to Landing). */}
          <Stack.Screen name="Main" component={MainTabNavigator} options={() => ({ ...fadeOptions(), cardStyle: { backgroundColor: t.ground } })} />
          <Stack.Screen name="Voucher" component={VoucherScreen} />
          {/* Scan → Review → Success rise together as one modal; the screen behind shrinks. */}
          <Stack.Screen name="ScanFlow" component={ScanFlowNavigator} options={() => ({ ...modalOptions(), gestureEnabled: false })} />
          {/* My Golf keeps the tab bar (Course lit). Closed by a tab press, it cross-fades like a tab switch. */}
          <Stack.Screen name="MyGolf" component={MyGolfScreen} options={({ route }) => (route.params?.closeAs === 'tab' ? fadeOptions() : pushOptions())} />
          <Stack.Screen name="Activity" component={RewardsActivityScreen} />
          <Stack.Screen name="ReceiptHistory" component={ReceiptHistoryScreen} />
          <Stack.Screen name="MemberTiers" component={MemberTiersScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
          <Stack.Screen name="Contact" component={ContactScreen} />
          <Stack.Screen name="GiveFeedback" component={GiveFeedbackScreen} />
          <Stack.Screen name="Referral" component={ReferralScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} />
          <Stack.Screen name="MyEnquiries" component={MyEnquiriesScreen} />
          <Stack.Screen name="EnquiryChat" component={EnquiryChatScreen} />
          <Stack.Screen name="MyFeedback" component={MyFeedbackScreen} />
          <Stack.Screen name="FeedbackThread" component={FeedbackThreadScreen} />
          <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
          <Stack.Screen name="RoundSetup" component={RoundSetupScreen} />
          {/* No swipe-back during a round: horizontal drags on the hole map must stay with the map. */}
          <Stack.Screen name="CourseGuide" component={CourseGuideScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="RoundDetail" component={RoundDetailScreen} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} options={fadeOptions} />
      )}
    </Stack.Navigator>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
}
