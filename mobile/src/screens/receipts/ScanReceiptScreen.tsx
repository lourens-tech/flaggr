import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Image, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { StackScreenProps } from '@react-navigation/stack';
import type { ScanFlowParamList } from '../../navigation/types';
import { api } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoType } from '../../theme/bento';
import { prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { PressableScale } from '../../components/motion';
import { BentoButton, BentoIcon, type BentoIconName } from '../../components/bento';

type Props = StackScreenProps<ScanFlowParamList, 'ScanReceipt'>;

// Full-resolution phone photos (often 3000-4000px) push server-side OCR well
// past Vercel's 60s hard limit on the Hobby plan. Downscaling the long edge
// keeps text plenty legible while cutting OCR time and upload size drastically.
const MAX_LONG_EDGE = 1800;

// Failures while preparing or scanning a photo that carry no member-facing server text.
const SCAN_FALLBACK = 'Something went wrong scanning that receipt.';

// Frosted dark glass on the camera (AppScan board: backdrop blur on the web build).
const webBlur = (px: number) => (Platform.OS === 'web' ? ({ backdropFilter: `blur(${px}px)`, WebkitBackdropFilter: `blur(${px}px)` } as unknown as ViewStyle) : null);

async function prepareForScan(uri: string, width: number, height: number): Promise<string> {
  const longEdge = Math.max(width, height);
  const isLandscape = width > height;
  const needsResize = longEdge > MAX_LONG_EDGE;

  const context = ImageManipulator.manipulate(uri);
  if (needsResize) {
    context.resize(isLandscape ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE });
  }
  const rendered = await context.renderAsync();
  // 0.6 JPEG quality was tuned for upload size, but the compression
  // artifacts it introduces blur the fine, low-contrast print on a thermal
  // receipt just enough to meaningfully hurt OCR accuracy. 0.9 costs more
  // bytes but the resize above already caps the long edge at 1800px, so the
  // result is still well within reason for a mobile upload.
  const saved = await rendered.saveAsync({ base64: true, compress: 0.9, format: SaveFormat.JPEG });
  if (!saved.base64) throw new Error('Failed to encode image');
  return `data:image/jpeg;base64,${saved.base64}`;
}

export function ScanReceiptScreen({ navigation }: Props) {
  const { t } = useBento();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  // Camera torch (approved addition, 24 Nov 2026). Native only: the web build keeps today's camera.
  const [torch, setTorch] = useState(false);
  // Camera access denied for good (the OS will not ask again): the card offers Open Settings
  // instead (owner decision 24 Nov 2026). The web never reports this (canAskAgain is always true).
  const deniedForGood = Platform.OS !== 'web' && permission !== null && !permission.granted && !permission.canAskAgain;
  // Coming back from Settings: read the permission again so a newly granted camera opens.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);
  const [scanning, setScanning] = useState(false);
  // The photo being read, shown dimmed behind the "Reading your receipt…" sheet.
  const [preview, setPreview] = useState<string | null>(null);

  const processImage = async (imageUri: string | null, width: number, height: number) => {
    if (!imageUri) {
      showAlert('Couldn’t read that image', 'Please try again with a different photo.');
      return;
    }
    setPreview(imageUri);
    setScanning(true);
    try {
      const imageBase64 = await prepareForScan(imageUri, width, height);
      const result = await api.scanReceipt(imageBase64);
      if (result.isDuplicate) {
        showAlert('Already redeemed', result.reason);
        return;
      }
      if (result.invalid) {
        showAlert('This is not a valid slip', 'Please scan a valid slip.', [
          { text: 'Back', style: 'cancel', onPress: () => navigation.goBack() },
          { text: 'Try Again', style: 'default' },
        ]);
        return;
      }
      navigation.navigate('ReviewReceipt', { imageUri, imageBase64, scanResult: result });
    } catch (err) {
      showAlert('Couldn’t scan receipt', friendlyError(err, SCAN_FALLBACK));
    } finally {
      setScanning(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setCapturing(true);
    let photo: Awaited<ReturnType<CameraView['takePictureAsync']>> | undefined;
    try {
      photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
    } catch (err) {
      // Was silent (owner decision 24 Nov 2026: no silent failures).
      setCapturing(false);
      showAlert('Couldn’t scan receipt', friendlyError(err, SCAN_FALLBACK));
      return;
    }
    try {
      await processImage(photo?.uri ?? null, photo?.width ?? 0, photo?.height ?? 0);
    } finally {
      setCapturing(false);
    }
  };

  const handleUpload = async () => {
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
    } catch (err) {
      // Was silent (owner decision 24 Nov 2026: no silent failures).
      showAlert('Couldn’t scan receipt', friendlyError(err, SCAN_FALLBACK));
      return;
    }
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await processImage(asset.uri, asset.width, asset.height);
    }
  };

  const topBar = (withClose: boolean, right: React.ReactNode = null) => (
    <View style={[styles.topBar, { top: insets.top + 8 }]}>
      {withClose ? <DarkCircle icon="closeWide" label="Close" onPress={() => navigation.goBack()} /> : <View style={styles.spacer} />}
      <Text style={[bentoType.navTitle, { color: '#FFFFFF' }]} accessibilityRole="header">
        Scan Receipt
      </Text>
      {right ?? <View style={styles.spacer} />}
    </View>
  );

  // Reading: the photo dimmed behind a sheet while the receipt is scanned.
  if (scanning) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        {preview ? <Image source={{ uri: preview }} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} resizeMode="cover" blurRadius={12} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,10,8,0.45)' }]} />
        {topBar(false)}
        <View
          accessibilityLiveRegion="polite"
          style={[styles.readingSheet, { backgroundColor: t.tile, bottom: 12 + Math.max(0, insets.bottom - 12) }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <RingSpinner track={t.track} color={t.accent} />
            <Text style={[bentoType.number, { flex: 1, fontSize: 24, lineHeight: 28, color: t.ink }]}>Reading your receipt…</Text>
          </View>
          <Text style={[bentoType.body, { color: t.muted, marginTop: 12, marginBottom: 18 }]}>
            Extracting items, matching golf products and activities, and calculating your Flagrr Cash.
          </Text>
          <Shimmer width="88%" color={t.track} />
          <Shimmer width="64%" color={t.track} />
          <Shimmer width="76%" color={t.track} />
        </View>
      </View>
    );
  }

  if (!permission) return <View style={styles.screen} />;

  // Camera permission: a card over the dark camera ground.
  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        {topBar(true)}
        <View style={styles.permWrap}>
          <View style={[styles.permCard, { backgroundColor: t.tile }]}>
            <View style={[styles.permIcon, { backgroundColor: t.accentSoft }]}>
              <BentoIcon name="camera" size={34} color={t.accent} strokeWidth={1.7} />
            </View>
            <Text style={[bentoType.number, { fontSize: 26, lineHeight: 30, color: t.ink, marginTop: 16, textAlign: 'center' }]} accessibilityRole="header">
              Camera access needed
            </Text>
            <Text style={[bentoType.body, { color: t.muted, textAlign: 'center', marginTop: 8, marginBottom: 22 }]}>
              Flagrr needs camera access to scan your receipts and award Flagrr Cash.
            </Text>
            {deniedForGood ? (
              <BentoButton label="Open Settings" nub onPress={() => void Linking.openSettings()} />
            ) : (
              <BentoButton label="Continue" nub onPress={requestPermission} />
            )}
            <Pressable onPress={handleUpload} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6 }} style={styles.textButton}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: t.accent }}>Upload from gallery instead</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={Platform.OS !== 'web' && torch} />
      {topBar(
        true,
        Platform.OS === 'web' ? null : (
          <PressableScale
            onPress={() => setTorch((on) => !on)}
            accessibilityRole="togglebutton"
            accessibilityLabel="Torch"
            accessibilityState={{ checked: torch }}
            hitSlop={2}
            style={[styles.darkCircle, webBlur(20), torch ? styles.torchOn : null]}
          >
            <BentoIcon name="torch" size={20} color={torch ? bentoBrand.fairway : '#FFFFFF'} strokeWidth={1.8} />
          </PressableScale>
        ),
      )}
      <ScanFrame />
      {/* AppScan board: 44 pt above the bottom edge, clear of the home indicator. */}
      <View style={[styles.controls, { bottom: Math.max(44, insets.bottom + 10) }]}>
        <PressableScale onPress={handleUpload} accessibilityRole="button" accessibilityLabel="Upload from gallery" style={styles.galleryButton}>
          <View style={styles.galleryIcon}>
            <BentoIcon name="gallery" size={24} color="#FFFFFF" strokeWidth={1.7} />
          </View>
          <Text style={styles.galleryLabel}>Upload from gallery</Text>
        </PressableScale>
        <PressableScale
          onPress={handleCapture}
          disabled={capturing}
          pressedScale={0.92}
          accessibilityRole="button"
          accessibilityLabel="Scan receipt"
          accessibilityState={{ busy: capturing, disabled: capturing }}
          style={styles.shutter}
        >
          <View style={styles.shutterCore}>{capturing ? <ActivityIndicator color={bentoBrand.fairway} /> : null}</View>
        </PressableScale>
        <View style={{ width: 72 }} />
      </View>
    </View>
  );
}

// Dark frosted circle used on the camera (close).
function DarkCircle({ icon, label, onPress }: { icon: BentoIconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={2} style={[styles.darkCircle, webBlur(20)]}>
      <BentoIcon name={icon} size={20} color="#FFFFFF" strokeWidth={1.8} />
    </PressableScale>
  );
}

// Lime corner brackets, a sweeping scan line, and the alignment hint.
function ScanFrame() {
  const { width, height } = useWindowDimensions();
  // AppScan board at 390 x 844: frame 164 pt from the top and 432 tall, hint 22 below it.
  // Scaled with the window height so the frame and hint clear the controls on short phones.
  const frameTop = Math.round((height * 164) / 844);
  const frameH = Math.min(432, Math.round((height * 432) / 844));
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1600, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver }),
        Animated.timing(sweep, { toValue: 0, duration: 1600, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const travel = frameH / 2 - 24;
  return (
    <View pointerEvents="none" style={[styles.frameWrap, { top: frameTop }]}>
      <View aria-hidden style={{ width: width - 88, height: frameH }}>
        {(['tl', 'tr', 'br', 'bl'] as const).map((c, i) => (
          <View
            key={c}
            style={[
              styles.corner,
              c.includes('t') ? { top: 0 } : { bottom: 0 },
              c.includes('l') ? { left: 0 } : { right: 0 },
              { transform: [{ rotate: `${i * 90}deg` }] },
            ]}
          />
        ))}
        <Animated.View
          style={[
            styles.scanline,
            { transform: [{ translateY: prefersReducedMotion() ? 0 : sweep.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] }) }] },
          ]}
        />
      </View>
      <View style={[styles.hint, webBlur(16)]}>
        <Text style={{ fontSize: 14, color: '#FFFFFF' }}>Align receipt or QR code</Text>
      </View>
    </View>
  );
}

// The Reading sheet's 34 pt ring spinner (AppReading board): track ring, accent arc, 1 s a turn.
function RingSpinner({ track, color }: { track: string; color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <Animated.View
      aria-hidden
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 3,
        borderColor: track,
        borderTopColor: color,
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
}

// Placeholder line on the Reading sheet; pulses gently unless Reduce Motion.
function Shimmer({ width, color }: { width: `${number}%`; color: string }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.55, duration: 800, useNativeDriver }),
        Animated.timing(o, { toValue: 1, duration: 800, useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ height: 14, width, borderRadius: 7, backgroundColor: color, marginTop: 10, opacity: o }} />;
}

const CAMERA_GROUND = '#0B0F0D';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CAMERA_GROUND },
  topBar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  spacer: { width: 42 },
  darkCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10,24,17,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Torch on (kept board G-B-ScanTorch): lime circle, fairway icon.
  torchOn: { backgroundColor: bentoBrand.lime },
  frameWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 22 },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: bentoBrand.lime,
    borderTopLeftRadius: 14,
  },
  scanline: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '50%',
    height: 2,
    borderRadius: 2,
    backgroundColor: bentoBrand.lime,
    boxShadow: '0 0 0 4px rgba(205,222,92,0.18)',
  },
  hint: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(10,24,17,0.55)' },
  controls: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36 },
  galleryButton: { width: 72, alignItems: 'center', gap: 6 },
  galleryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryLabel: { fontSize: 11, lineHeight: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 64, height: 64, borderRadius: 32, backgroundColor: bentoBrand.lime, alignItems: 'center', justifyContent: 'center' },
  permWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  permCard: { borderRadius: 32, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'stretch', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' },
  permIcon: { width: 72, height: 72, borderRadius: 24, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  textButton: { alignSelf: 'center', padding: 8 },
  readingSheet: { position: 'absolute', left: 12, right: 12, borderRadius: 38, paddingTop: 26, paddingHorizontal: 24, paddingBottom: 28, boxShadow: '0 -10px 40px rgba(0,0,0,0.35)' },
});
