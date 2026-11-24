import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { ScanFlowParamList } from './types';
import { ScanReceiptScreen } from '../screens/receipts/ScanReceiptScreen';
import { ReviewReceiptScreen } from '../screens/receipts/ReviewReceiptScreen';
import { ReceiptSuccessScreen } from '../screens/receipts/ReceiptSuccessScreen';
import { pushOptions } from './transitions';

// The receipt flow (Scan → Review → Success) is one group that rises over the
// app as a modal (RootNavigator), so closing it from any step leaves the whole
// flow. Inside it, steps push like any other screen.
const Stack = createStackNavigator<ScanFlowParamList>();

export function ScanFlowNavigator() {
  return (
    <Stack.Navigator screenOptions={() => ({ ...pushOptions(), headerShown: false })}>
      {/* "Submit Another Receipt" replaces Success with Scan: it moves back, so it animates as a pop. */}
      <Stack.Screen name="ScanReceipt" component={ScanReceiptScreen} options={{ animationTypeForReplace: 'pop' }} />
      <Stack.Screen name="ReviewReceipt" component={ReviewReceiptScreen} />
      <Stack.Screen name="ReceiptSuccess" component={ReceiptSuccessScreen} />
    </Stack.Navigator>
  );
}
