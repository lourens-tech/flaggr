import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBento } from '../../context/ThemeContext';
import { bentoLayout as L, bentoType } from '../../theme/bento';
import { GlassIconButton } from '../bento/primitives';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

// Header row for member sub-screens (Help Center, Edit Profile, …), in the
// Bento style: a glass back button, the title centred in the system font,
// and an optional right-hand slot. Sits on the screen's ground colour.
export function ScreenHeader({ title, onBack, right }: Props) {
  const { t } = useBento();
  const navigation = useNavigation();
  return (
    <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: L.screenPadding, paddingVertical: 8, backgroundColor: t.ground }}>
      <GlassIconButton icon="back" onPress={onBack ?? (() => navigation.goBack())} accessibilityLabel="Back" />
      <Text accessibilityRole="header" numberOfLines={2} style={[bentoType.navTitle, { flex: 1, color: t.ink }]}>
        {title}
      </Text>
      {/* minWidth (not a fixed width) so a wider right-hand node can grow. */}
      <View style={{ minWidth: L.iconButton, alignItems: 'flex-end', justifyContent: 'center' }}>{right}</View>
    </View>
  );
}
