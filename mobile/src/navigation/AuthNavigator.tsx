import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { AuthStackParamList } from './types';
import { LandingScreen } from '../screens/onboarding/LandingScreen';
import { LoginScreen } from '../screens/onboarding/LoginScreen';
import { SignUpStep1Screen } from '../screens/onboarding/SignUpStep1Screen';
import { SignUpStep2Screen } from '../screens/onboarding/SignUpStep2Screen';
import { AdminLoginScreen } from '../screens/admin/AdminLoginScreen';
import { ForgotPasswordScreen } from '../screens/onboarding/ForgotPasswordScreen';
import { TermsPrivacyScreen } from '../screens/profile/TermsPrivacyScreen';
import { AdminForgotPasswordScreen } from '../screens/admin/AdminForgotPasswordScreen';
import { IS_STORE_BUILD } from '../config/buildConfig';
import { withAdminScope } from '../components/admin/AdminScope';

const ScopedAdminLogin = withAdminScope(AdminLoginScreen);
const ScopedAdminForgotPassword = withAdminScope(AdminForgotPasswordScreen);
import { pushOptions } from './transitions';

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  // headerMode 'float': lets pushed screens scroll on web (see RootNavigator).
  return (
    <Stack.Navigator screenOptions={() => ({ ...pushOptions(), headerShown: false, headerMode: 'float' })}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      {IS_STORE_BUILD ? null : (
        <>
          <Stack.Screen name="AdminLogin" component={ScopedAdminLogin} />
          <Stack.Screen name="AdminForgotPassword" component={ScopedAdminForgotPassword} />
        </>
      )}
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="SignUpStep1" component={SignUpStep1Screen} />
      <Stack.Screen name="SignUpStep2" component={SignUpStep2Screen} />
      <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} />
    </Stack.Navigator>
  );
}
