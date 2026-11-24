import { beforeEach, describe, expect, test, vi } from 'vitest';
// vi.mock calls below are hoisted above this import.
import { assetToDataUrl, exportFilename, MAX_DATA_URL_BYTES, pickImage, saveExport, takePhoto } from '../src/helpers.js';

const files = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    constructor(dir: { uri: string }, name: string) { this.uri = dir.uri + name; }
    get exists() { return files.has(this.uri); }
    delete() { files.delete(this.uri); }
    create() { files.set(this.uri, new Uint8Array()); }
    async write(bytes: Uint8Array) { files.set(this.uri, bytes); }
  },
}));
const picker = vi.hoisted(() => ({
  launchImageLibraryAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
}));
vi.mock('expo-image-picker', () => picker);


function editor() {
  return { loadImage: vi.fn(async () => undefined), addImage: vi.fn(async () => undefined) } as never as {
    loadImage: ReturnType<typeof vi.fn>; addImage: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  files.clear();
  vi.clearAllMocks();
});

describe('assetToDataUrl', () => {
  test('builds a data URL, defaulting the mime', () => {
    expect(assetToDataUrl({ base64: 'AAAA', mimeType: 'image/png' })).toBe('data:image/png;base64,AAAA');
    expect(assetToDataUrl({ base64: 'AAAA' })).toBe('data:image/jpeg;base64,AAAA');
  });
  test('rejects missing data and oversized images', () => {
    expect(() => assetToDataUrl({ base64: null })).toThrow(/no base64/);
    expect(() => assetToDataUrl({ base64: 'A'.repeat(MAX_DATA_URL_BYTES) })).toThrow(expect.objectContaining({ code: 'too_large' }));
  });
});

describe('pickImage / takePhoto', () => {
  test('loads the picked photo (or adds it as a layer) and asks for base64 images', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ base64: 'QQ==', mimeType: 'image/heic' }] });
    const e = editor();
    await expect(pickImage(e as never)).resolves.toBe(true);
    expect(e.loadImage).toHaveBeenCalledWith('data:image/heic;base64,QQ==');
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], base64: true }));
    await pickImage(e as never, { asLayer: true });
    expect(e.addImage).toHaveBeenCalledOnce();
  });
  test('cancel and denied camera permission resolve false without touching the editor', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    const e = editor();
    await expect(pickImage(e as never)).resolves.toBe(false);
    await expect(takePhoto(e as never)).resolves.toBe(false);
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(e.loadImage).not.toHaveBeenCalled();
  });
});

test('saveExport writes the decoded bytes to the cache and returns the uri; overwrites', async () => {
  const blob = { dataUrl: 'data:image/png;base64,iVBORw==', mime: 'image/png', bytes: 4 };
  const uri = await saveExport({ blob }, 'out.png');
  expect(uri).toBe('file:///cache/out.png');
  expect([...files.get(uri)!]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  await saveExport({ blob: { ...blob, dataUrl: 'data:image/png;base64,AA==' } }, 'out.png');
  expect([...files.get(uri)!]).toEqual([0]);
  expect(exportFilename(blob, new Date('2026-11-23T10:20:30.400Z'))).toBe('snapnedit-2026-11-23T10-20-30-400Z.png');
});
