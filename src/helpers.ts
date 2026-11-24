import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { decodeDataUrl, SnapneditError, type EncodedBlob, type ExportResult, type SnapneditClient } from '@snapnedit/react-native/client';

/** Above this a `data:` URL is too big to hand across the webview bridge comfortably; upload and pass an https URL instead. */
export const MAX_DATA_URL_BYTES = 12 * 1024 * 1024;

export interface PickOptions {
  /** `addImage` (a new layer) instead of `loadImage` (replace the document). */
  asLayer?: boolean;
  /** JPEG quality the picker re-encodes at, 0-1. Default 0.85 keeps phone photos well under the bridge limit. */
  quality?: number;
  /** Let the user crop in the system UI first. */
  allowsEditing?: boolean;
}

/** Pure: an image-picker asset as a `data:` URL, or a `too_large` error. */
export function assetToDataUrl(asset: { base64?: string | null; mimeType?: string | null }): string {
  if (!asset.base64) throw new SnapneditError('invalid_input', 'the picked image has no base64 data');
  const url = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  if (url.length > MAX_DATA_URL_BYTES) {
    throw new SnapneditError('too_large', 'image too large to pass inline; lower `quality` or upload it and call loadImage with an https URL');
  }
  return url;
}

async function pickInto(editor: SnapneditClient, result: ImagePicker.ImagePickerResult, options: PickOptions): Promise<boolean> {
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return false;
  const url = assetToDataUrl(asset);
  await (options.asLayer ? editor.addImage(url) : editor.loadImage(url));
  return true;
}

function pickerOptions(options: PickOptions): ImagePicker.ImagePickerOptions {
  return { mediaTypes: ['images'], base64: true, quality: options.quality ?? 0.85, allowsEditing: options.allowsEditing ?? false, exif: false };
}

/** Opens the photo library and loads the chosen photo into the editor. Resolves `false` if the user cancels. */
export async function pickImage(editor: SnapneditClient, options: PickOptions = {}): Promise<boolean> {
  return pickInto(editor, await ImagePicker.launchImageLibraryAsync(pickerOptions(options)), options);
}

/** Asks for camera permission, takes a photo and loads it. Resolves `false` if denied or cancelled. */
export async function takePhoto(editor: SnapneditClient, options: PickOptions = {}): Promise<boolean> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return false;
  return pickInto(editor, await ImagePicker.launchCameraAsync(pickerOptions(options)), options);
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif',
  'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'image/gif': 'gif',
};

/** Pure: `snapnedit-<time>.<ext>` for an exported blob. */
export function exportFilename(blob: EncodedBlob, now: Date = new Date()): string {
  return `snapnedit-${now.toISOString().replace(/[:.]/g, '-')}.${EXTENSIONS[blob.mime] ?? 'bin'}`;
}

/**
 * Writes an export (from `editor.export()` or the `onExport` event) to the app's
 * cache directory and returns its `file://` uri — hand it to expo-sharing,
 * expo-media-library or an upload.
 */
export async function saveExport(result: Pick<ExportResult, 'blob'>, filename: string = exportFilename(result.blob)): Promise<string> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(decodeDataUrl(result.blob.dataUrl));
  return file.uri;
}
