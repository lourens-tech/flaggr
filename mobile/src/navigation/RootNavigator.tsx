import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { VoucherScreen } from '../screens/rewards/VoucherScreen';
import { ScanReceiptScreen } from '../screens/receipts/ScanReceiptScreen';
import { ReviewReceiptScreen } from '../screens/receipts/ReviewReceiptScreen';
import { ReceiptSuccessScreen } from '../screens/receipts/ReceiptSuccessScreen';
import { MemberTiersScreen } from '../screens/profile/MemberTiersScreen';
import { NotificationsScreen } from '../screens/profile/NotificationsScreen';
import { HelpCenterScreen } from '../screens/profile/HelpCenterScreen';
import { ContactScreen } from '../screens/profile/ContactScreen';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isInitializing } = useApp();

  if (isInitializing) {
    // Restoring a stored session (checking /me) before deciding which stack to
    // mount — avoids a flash of the Landing screen on a warm start.
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.clubGreen} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Voucher" component={VoucherScreen} />
          <Stack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
          <Stack.Screen name="ReviewReceipt" component={ReviewReceiptScreen} />
          <Stack.Screen name="ReceiptSuccess" component={ReceiptSuccessScreen} />
          <Stack.Screen name="MemberTiers" component={MemberTiersScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
          <Stack.Screen name="Contact" component={ContactScreen} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
