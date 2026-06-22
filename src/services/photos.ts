import * as ImagePicker from 'expo-image-picker';
// SDK 56 moved the classic file API (documentDirectory, copyAsync, ...) to the
// `/legacy` entry point; the default export is now the new File/Directory API.
import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';

const PHOTO_DIR = `${FileSystem.documentDirectory}qc-photos/`;

async function ensurePhotoDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

/**
 * Copies a picker/camera result (which lives in a volatile cache directory)
 * into the app's persistent document directory and returns the stable URI.
 */
async function persist(tempUri: string): Promise<string> {
  await ensurePhotoDir();
  const dest = `${PHOTO_DIR}${uuidv4()}.jpg`;
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

export type PhotoResult =
  | { status: 'ok'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

/**
 * Launches the device camera and returns a persisted local URI for the photo.
 * Handles permission denial and user cancellation explicitly so callers can
 * give precise feedback.
 */
export async function capturePhoto(): Promise<PhotoResult> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { status: 'denied' };

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      exif: false,
    });

    if (result.canceled) return { status: 'cancelled' };
    const uri = result.assets[0]?.uri;
    if (!uri) return { status: 'error', message: 'No image returned' };

    return { status: 'ok', uri: await persist(uri) };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Camera failed',
    };
  }
}

/**
 * Opens the photo library and returns a persisted local URI for the selection.
 */
export async function pickPhoto(): Promise<PhotoResult> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { status: 'denied' };

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      exif: false,
    });

    if (result.canceled) return { status: 'cancelled' };
    const uri = result.assets[0]?.uri;
    if (!uri) return { status: 'error', message: 'No image returned' };

    return { status: 'ok', uri: await persist(uri) };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Gallery failed',
    };
  }
}
