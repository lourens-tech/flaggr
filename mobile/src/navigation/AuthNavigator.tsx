import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { LandingScreen } from '../screens/onboarding/LandingScreen';
import { LoginScreen } from '../screens/onboarding/LoginScreen';
import { SignUpStep1Screen } from '../screens/onboarding/SignUpStep1Screen';
import { SignUpStep2Screen } from '../screens/onboarding/SignUpStep2Screen';
import { AdminLoginScreen } from '../screens/admin/AdminLoginScreen';
import { ForgotPasswordScreen } from '../screens/onboarding/ForgotPasswordScreen';
import { AdminForgotPasswordScreen } from '../screens/admin/AdminForgotPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="AdminForgotPassword" component={AdminForgotPasswordScreen} />
      <Stack.Screen name="SignUpStep1" component={SignUpStep1Screen} />
      <Stack.Screen name="SignUpStep2" component={SignUpStep2Screen} />
    </Stack.Navigator>
  );
}
