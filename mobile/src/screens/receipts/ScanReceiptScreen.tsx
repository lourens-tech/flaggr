import React, { useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { PillButton } from '../../components/common/PillButton';
import { api, ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReceipt'>;

export function ScanReceiptScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [scanning, setScanning] = useState(false);

  const processImage = async (imageUri: string | null, base64: string | null | undefined) => {
    if (!base64) {
      showAlert('Couldn’t read that image', 'Please try again with a different photo.');
      return;
    }
    const imageBase64 = `data:image/jpeg;base64,${base64}`;
    setScanning(true);
    try {
      const result = await api.scanReceipt(imageBase64);
      if (result.isDuplicate) {
        showAlert('Already redeemed', result.reason);
        return;
      }
      navigation.navigate('ReviewReceipt', { imageUri, imageBase64, scanResult: result });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong scanning that receipt.';
      showAlert('Couldn’t scan receipt', message);
    } finally {
      setScanning(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      await processImage(photo?.uri ?? null, photo?.base64);
    } finally {
      setCapturing(false);
    }
  };

  const handleUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri, result.assets[0].base64);
    }
  };

  if (scanning) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.processingContainer}>
          <ActivityIndicator size="large" color={colors.lime} />
          <Text style={styles.processingTitle}>Reading your receipt…</Text>
          <Text style={styles.processingBody}>
            Extracting items, matching golf products and activities, and calculating your Flagrr Bucks.
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={48} color={colors.white} />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Flaggr needs camera access to scan your receipts and award Flagrr Bucks.
          </Text>
          <View style={{ height: spacing.lg }} />
          <PillButton label="Allow Camera Access" onPress={requestPermission} />
          <TouchableOpacity style={{ marginTop: spacing.md }} onPress={handleUpload}>
            <Text style={styles.uploadLink}>Upload from gallery instead</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Receipt</Text>
          <Ionicons name="flash-off-outline" size={22} color={colors.white} />
        </View>
      </SafeAreaView>

      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <View style={styles.alignBadge}>
            <Text style={styles.alignBadgeText}>Align receipt or QR code</Text>
          </View>
          <View style={styles.frame} />
        </View>
      </CameraView>

      <View style={styles.footer}>
        <PillButton label="Scan Receipt" icon="scan-outline" onPress={handleCapture} loading={capturing} />
        <TouchableOpacity style={styles.uploadRow} onPress={handleUpload}>
          <Ionicons name="image-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.uploadRowText}>Upload from gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.darkGreen },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
  },
  headerTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
  camera: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  alignBadge: {
    position: 'absolute',
    top: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  alignBadgeText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.white },
  frame: {
    width: '80%',
    height: '55%',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.lime,
    borderStyle: 'dashed',
  },
  footer: { backgroundColor: colors.white, padding: screenPadding, alignItems: 'center', gap: spacing.md },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  uploadRowText: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenPadding },
  permissionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white, marginTop: spacing.md },
  permissionBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  uploadLink: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.lime },
  processingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenPadding },
  processingTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.title,
    color: colors.white,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  processingBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
