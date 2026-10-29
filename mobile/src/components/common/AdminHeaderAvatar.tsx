import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  logoUrl: string | null;
  size?: number;
}

// Brand constants for the club crest: Fairway ground with a lime mark, the
// same treatment as the sidebar crest and member avatars in the admin consoles.
const FAIRWAY = '#1F4234';
const LIME = '#CDDE5C';

// Small circular header avatar for the course-admin side — shows the
// course's own logo in the "profile picture" slot instead of a person, since
// the identity that matters in this header is the club, not the individual
// admin. Same shape/placement as the member app's HeaderAvatar.
export function AdminHeaderAvatar({ logoUrl, size = 32 }: Props) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={styles.image} />
      ) : (
        <Ionicons name="business" size={Math.round(size * 0.5)} color={LIME} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: FAIRWAY,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
