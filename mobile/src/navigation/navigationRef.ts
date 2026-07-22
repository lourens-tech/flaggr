import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Lets code outside the component tree (the push-notification tap handler)
// navigate without needing a screen's own navigation prop.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
