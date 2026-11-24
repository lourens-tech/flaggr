import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBento } from '../../context/ThemeContext';
import { bentoLayout as L, bentoType } from '../../theme/bento';
import { AuthBackdrop } from '../../components/bento/AuthBackdrop';
import { BentoField, BentoIcon, Eyebrow, H1 } from '../../components/bento';
import { PressableScale } from '../../components/motion/PressableScale';

// Pieces shared by the sign-in screens only (Login, Sign up 1 and 2, Reset
// password, Landing), drawn from the Bento sign-in boards (AppLogin*,
// AppSignUp*, kept boards G-A-*). Everything else comes from components/bento.

// The photo screens (Login, Sign up): ground colour with the club photo
// fading in across the top (270 pt on the boards), the content in a column
// that scrolls (and moves clear of the keyboard on iOS), 24 pt sides and 40 pt
// at the bottom. The column starts 62 pt from the top as on the boards (safe
// area + 8, as BentoScreen, but never less than 62): the photo is drawn from
// the top edge, so with no safe area (the web build) the title would
// otherwise sit on the photo.
export function AuthPhotoScreen({
  photo,
  gap,
  children,
}: {
  photo: ImageSourcePropType;
  gap: number;
  children: React.ReactNode;
}) {
  const { t } = useBento();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <StatusBar barStyle="light-content" />
      <AuthBackdrop photo={photo} height={270} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            gap,
            paddingTop: Math.max(insets.top + 8, BOARD_TOP),
            paddingBottom: insets.bottom + 40,
            paddingLeft: L.screenPadding + insets.left,
            paddingRight: L.screenPadding + insets.right,
          }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// The boards' back button over a photo (bento-kit `.gbtn.dk`): a 42 pt dark
// glass circle with a white chevron.
// Where the boards start the content (their 390 x 844 frame includes the status bar).
export const BOARD_TOP = 62;

const webBlur = { backdropFilter: 'blur(20px) saturate(1.6)', WebkitBackdropFilter: 'blur(20px) saturate(1.6)' } as unknown as ViewStyle;

export function PhotoBackButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={2}
      style={[
        {
          alignSelf: 'flex-start',
          width: L.iconButton,
          height: L.iconButton,
          borderRadius: L.iconButton / 2,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
          backgroundColor: 'rgba(10,24,17,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        Platform.OS === 'web' ? webBlur : null,
      ]}
    >
      <BentoIcon name="back" size={20} color="#FFFFFF" strokeWidth={1.8} />
    </PressableScale>
  );
}

// "Step 1 of 2" block on the sign-up boards: a two-part progress bar, the
// eyebrow and the 32 pt title 6 pt under it.
export function SignUpHeader({ step, title }: { step: 1 | 2; title: string }) {
  const { t } = useBento();
  return (
    <>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: t.accent }} />
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step === 2 ? t.accent : t.track }} />
      </View>
      <View>
        <Eyebrow>{`Step ${step} of 2`}</Eyebrow>
        <H1 style={authTitle(32, 6)}>{title}</H1>
      </View>
    </>
  );
}

// Fraunces titles on the sign-in boards: 36 pt (Login) or 32 pt, line height 1.02.
export function authTitle(size: number, marginTop = 0) {
  return { fontSize: size, lineHeight: Math.round(size * 1.02), letterSpacing: -0.025 * size, marginTop };
}

// A labelled password field with the eye toggle (hidden by default).
export function PasswordField(props: TextInputProps & { label: string; helper?: string; error?: string }) {
  const [hidden, setHidden] = useState(true);
  return (
    <BentoField
      {...props}
      secureTextEntry={hidden}
      rightIcon={hidden ? 'eye' : 'eyeOff'}
      onRightIconPress={() => setHidden((h) => !h)}
      rightIconLabel={hidden ? 'Show password' : 'Hide password'}
    />
  );
}

// A centred prompt and link ("Forgot Password? Recover here."): the whole
// line is the tap target, as before; the link part is semibold accent.
export function PromptLink({
  prompt,
  link,
  onPress,
  size = 15,
  disabled = false,
  split = false,
  style,
}: {
  prompt: string;
  link: string;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  // Prompt and link as separate texts (a row) rather than one sentence.
  split?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useBento();
  const base = { fontSize: size, lineHeight: Math.round(size * 1.4), color: t.muted, textAlign: 'center' as const };
  const linkStyle = { fontWeight: '600' as const, color: t.accent };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      hitSlop={{ top: 10, bottom: 10 }}
      style={[{ minHeight: 24, justifyContent: 'center', alignSelf: 'center', opacity: disabled ? 0.45 : 1 }, split ? { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 } : null, style]}
    >
      {split ? (
        <>
          <Text style={base}>{prompt}</Text>
          <Text style={[base, linkStyle]}>{link}</Text>
        </>
      ) : (
        <Text style={base}>
          {prompt} <Text style={linkStyle}>{link}</Text>
        </Text>
      )}
    </Pressable>
  );
}

// "By continuing, you're accepting our Terms of Use and Privacy Notice"
// (kept board G-A-LandingStore): 13 pt muted, the two names semibold ink.
// Both names open Terms and Privacy (owner decision 24 Nov 2026).
export function LegalLine({ onTerms, onPrivacy, style }: { onTerms: () => void; onPrivacy: () => void; style?: StyleProp<ViewStyle> }) {
  const { t } = useBento();
  const name = { fontWeight: '600' as const, color: t.ink };
  return (
    <View style={style}>
      <Text style={[bentoType.helper, { fontSize: 13, lineHeight: Math.round(13 * 1.45), color: t.muted, textAlign: 'center' }]}>
        By continuing, you're accepting our{' '}
        <Text style={name} onPress={onTerms} accessibilityRole="link" suppressHighlighting>
          Terms of Use
        </Text>{' '}
        and{' '}
        <Text style={name} onPress={onPrivacy} accessibilityRole="link" suppressHighlighting>
          Privacy Notice
        </Text>
      </Text>
    </View>
  );
}
