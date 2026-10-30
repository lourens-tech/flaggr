import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useAdminTheme } from '../../../context/ThemeContext';
import { useAdmin } from '../../../context/AdminContext';

// Super admin, support agents and the sign-in screens aren't tied to one club,
// so they get Flagrr's own course photo (already bundled for member
// onboarding) in place of a club cover.
export const FLAGRR_BACKDROP = require('../../../../assets/images/strand-golf-club-fairway.jpg');

// The club's cover photo, blurred right down and laid behind the whole
// window so the glass navigation picks up its colour. Clubs without a cover,
// and Reduce Transparency, get the plain window colour.
export function useAdminBackdropSource(): ImageSourcePropType | null {
  const { admin, course } = useAdmin();
  if (admin.role === 'super_admin' || admin.role === 'support_agent') return FLAGRR_BACKDROP;
  return course.coverImageUrl ? { uri: course.coverImageUrl } : null;
}

interface Props {
  source?: ImageSourcePropType | null;
  children?: React.ReactNode;
}

export function AdminBackdrop({ source, children }: Props) {
  const { c, reduceTransparency } = useAdminTheme();
  return (
    <View style={[styles.root, { backgroundColor: c.base }]}>
      {source && !reduceTransparency ? (
        // The photo's bleed is clipped by its own layer: left in root, it made
        // root wider than the window, and focusing a control (search, a
        // field) scrolled the whole console sideways on the web.
        <View style={styles.photoClip} pointerEvents="none">
          <Image
            source={source}
            resizeMode="cover"
            blurRadius={60}
            style={[styles.photo, { opacity: c.ambientOpacity }]}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}

// Same backdrop, picking the source from the signed-in admin.
export function AdminSessionBackdrop({ children }: { children?: React.ReactNode }) {
  const source = useAdminBackdropSource();
  return <AdminBackdrop source={source}>{children}</AdminBackdrop>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  photoClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  // Scaled up past the edges so the blur doesn't fade to a soft border.
  // (Negative insets moved the image up on the web without growing it,
  // leaving an unblurred band along the bottom.)
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', transform: [{ scale: 1.2 }] },
});
