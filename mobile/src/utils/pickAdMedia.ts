import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { AdMediaType } from '../data/types';

const AD_IMAGE_MAX_WIDTH = 960;
const JPEG_QUALITY = 0.7;
// A short, heavily-compressed clip only — same base64-length ceiling the
// backend enforces (api/admin/index.ts MAX_GIF_BASE64_LENGTH/MAX_VIDEO_BASE64_LENGTH),
// checked here too so an oversized pick fails instantly instead of after a
// multi-MB round trip to the server.
const MAX_GIF_BASE64_LENGTH = 3_000_000;
const MAX_VIDEO_BASE64_LENGTH = 4_000_000;
const MAX_VIDEO_DURATION_SECONDS = 12;

export class AdMediaPermissionError extends Error {}
export class AdMediaTypeError extends Error {}
export class AdMediaTooLargeError extends Error {}

export interface PickedAdMedia {
  mediaType: AdMediaType;
  dataUri: string;
}

async function requestLibraryPermission(): Promise<void> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AdMediaPermissionError('Photo library access is needed to choose media.');
  }
}

// Reads the raw bytes of a picked asset as base64 without any recompression
// (needed to preserve gif animation and to get video bytes at all — native's
// base64 picker option only works for images, and even then it always
// re-encodes to JPEG). On web the picker's own FileReader-based base64 is
// already the untouched file, so no expo-file-system read is needed there —
// its File class isn't implemented for web anyway.
async function readAssetAsBase64(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    if (!asset.base64) throw new Error('Could not read the selected file.');
    return asset.base64;
  }
  return new File(asset.uri).base64();
}

export async function pickAdImage(): Promise<PickedAdMedia | null> {
  await requestLibraryPermission();
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets[0]) return null;

  const rendered = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: AD_IMAGE_MAX_WIDTH })
    .renderAsync();
  const saved = await rendered.saveAsync({ base64: true, compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  if (!saved.base64) return null;
  return { mediaType: 'image', dataUri: `data:image/jpeg;base64,${saved.base64}` };
}

export async function pickAdGif(): Promise<PickedAdMedia | null> {
  await requestLibraryPermission();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: Platform.OS === 'web',
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  const looksLikeGif = (asset.mimeType ?? '').includes('gif') || asset.uri.toLowerCase().endsWith('.gif');
  if (!looksLikeGif) {
    throw new AdMediaTypeError('Please choose a .gif file.');
  }

  const base64 = await readAssetAsBase64(asset);
  if (base64.length > MAX_GIF_BASE64_LENGTH) {
    throw new AdMediaTooLargeError('That GIF is too large — please choose one under ~2MB.');
  }
  return { mediaType: 'gif', dataUri: `data:image/gif;base64,${base64}` };
}

export async function pickAdVideo(): Promise<PickedAdMedia | null> {
  await requestLibraryPermission();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
    base64: Platform.OS === 'web',
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  if (asset.duration != null && asset.duration > MAX_VIDEO_DURATION_SECONDS * 1000 + 1000) {
    throw new AdMediaTooLargeError(`Please choose a clip under ${MAX_VIDEO_DURATION_SECONDS} seconds.`);
  }

  const base64 = await readAssetAsBase64(asset);
  if (base64.length > MAX_VIDEO_BASE64_LENGTH) {
    throw new AdMediaTooLargeError(
      `That video is too large even after compression — keep clips short (~${MAX_VIDEO_DURATION_SECONDS}s) and lower resolution.`,
    );
  }
  const mimeType = asset.mimeType || 'video/mp4';
  return { mediaType: 'video', dataUri: `data:${mimeType};base64,${base64}` };
}

export async function pickAdMedia(mediaType: AdMediaType): Promise<PickedAdMedia | null> {
  if (mediaType === 'gif') return pickAdGif();
  if (mediaType === 'video') return pickAdVideo();
  return pickAdImage();
}
