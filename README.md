# @snapnedit/expo

The [snapnedit](https://snapnedit.com) AI photo editor for Expo apps. It is
[`@snapnedit/react-native`](https://github.com/Snap-N-Edit/canvas-react-native)
— the `<SnapneditEditor>` component and its typed client — plus the three
things every Expo integration writes next:

- `pickImage(editor)` — photo library → editor
- `takePhoto(editor)` — camera → editor
- `saveExport(result)` — an export → a `file://` in the cache, ready for
  `expo-sharing`, `expo-media-library` or an upload

No config plugin and no native code of its own: everything it uses ships in
Expo Go, so it runs there as-is.

## Install

```sh
npx expo install @snapnedit/expo react-native-webview expo-image-picker expo-file-system
```

## A photo studio screen

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { SnapneditEditor, pickImage, saveExport, type SnapneditClient } from '@snapnedit/expo';

export default function Studio() {
  const editor = useRef<SnapneditClient>(null);
  return (
    <View style={{ flex: 1 }}>
      <SnapneditEditor ref={editor} publishableKey="pk_live_…" appId="com.acme.photos" style={{ flex: 1 }} />
      <Button title="Choose photo" onPress={() => editor.current && pickImage(editor.current)} />
      <Button title="Cut out" onPress={() => editor.current?.run('remove-background')} />
      <Button
        title="Share"
        onPress={async () => {
          const png = await editor.current!.export('png');
          await Sharing.shareAsync(await saveExport(png));
        }}
      />
    </View>
  );
}
```

`appId` is your app's bundle identifier / package name. Add it to your
publishable key's **Allowed origins** in the
[dashboard](https://snapnedit.com/dashboard) as `native:com.acme.photos`.
For per-user credit caps, mint short-lived tokens on your backend and pass
`token` + `getToken` instead of the key — see the
[`@snapnedit/react-native` README](https://github.com/Snap-N-Edit/canvas-react-native#credentials).

## Helpers

| | |
| --- | --- |
| `pickImage(editor, { asLayer?, quality?, allowsEditing? })` | Opens the library and calls `loadImage` (or `addImage` with `asLayer`). Resolves `false` if cancelled. Photos are re-encoded at `quality` (default 0.85) so they stay small enough to cross the webview bridge. |
| `takePhoto(editor, options?)` | Requests camera permission, then the same. Resolves `false` if denied or cancelled. |
| `saveExport(result, filename?)` | Writes `editor.export()`'s result (or an `onExport` event) to `Paths.cache` and returns the uri. |
| `assetToDataUrl(asset)`, `exportFilename(blob)` | The pure pieces, if you want your own picker. |

Everything from `@snapnedit/react-native` is re-exported: `SnapneditEditor`,
`SnapneditClient`, `SnapneditError`, `buildEmbedUrl`, `decodeDataUrl` and the
types. For very large exports, `editor.exportTo({ url })` uploads straight
from the webview to a presigned URL and skips the bridge entirely.

Mirrored from the snapnedit monorepo; changes land there.

## License

MIT
