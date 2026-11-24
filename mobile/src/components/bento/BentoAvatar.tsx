import React from 'react';
import { Image, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { bentoBrand } from '../../theme/bento';

// The member's round avatar from the boards: their uploaded photo, or their
// initials in lime on fairway green.
export function BentoAvatar({ size = 42 }: { size?: number }) {
  const { user } = useApp();
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bentoBrand.fairway,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 0 0 2px rgba(255,255,255,0.55)',
      }}
    >
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: 'Fraunces_700Bold', fontSize: Math.round(size * 0.36), letterSpacing: 0.3, color: bentoBrand.lime }}>
          {initials}
        </Text>
      )}
    </View>
  );
}
