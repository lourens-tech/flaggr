import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AvatarPermissionError } from './pickAvatar';

// Wide enough that every number on a scorecard stays readable, small enough
// to stay under the API's 2 MB data-URI limit (photos are stored inline).
const MAX_WIDTH = 1800;
const JPEG_QUALITY = 0.8;

/** Lets a GM choose one or more scorecard photos (on a phone the picker also
 * offers the camera) and returns each as a resized JPEG data URI. */
export async function pickScorecardPhotos(limit: number): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AvatarPermissionError('Photo library access is needed to choose your scorecard photos.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: limit > 1,
    selectionLimit: Math.max(1, limit),
  });
  if (result.canceled) return [];
  const out: string[] = [];
  for (const asset of result.assets.slice(0, limit)) {
    let ctx = ImageManipulator.manipulate(asset.uri);
    // Never upscale a small photo.
    if (!asset.width || asset.width > MAX_WIDTH) ctx = ctx.resize({ width: MAX_WIDTH });
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ base64: true, compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    if (saved.base64) out.push(`data:image/jpeg;base64,${saved.base64}`);
  }
  return out;
}
