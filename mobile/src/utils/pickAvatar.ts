import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_WIDTH = 480;
const JPEG_QUALITY = 0.7;

export class AvatarPermissionError extends Error {}

// Resizes down to MAX_WIDTH before returning as a data URI — the API stores
// avatars inline in Postgres (no blob storage configured), so keeping the
// payload small matters. Circular cropping is handled visually at display
// time rather than here, since allowsEditing crop UI isn't supported on web.
export async function pickAndResizeAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AvatarPermissionError('Photo library access is needed to choose a profile picture.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  const rendered = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: MAX_WIDTH })
    .renderAsync();
  const saved = await rendered.saveAsync({ base64: true, compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  if (!saved.base64) return null;
  return `data:image/jpeg;base64,${saved.base64}`;
}
