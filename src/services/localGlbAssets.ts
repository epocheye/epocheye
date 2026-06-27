/**
 * Resolve GLBs bundled inside the app to a real `file://` path.
 *
 * SceneView's Filament model loader loads `https://` and `file://` reliably, but
 * not Metro/`require()` asset URIs. So for a bundled GLB we copy the bytes out
 * of the APK assets into the cache dir once and hand back a stable `file://`.
 *
 * Android: the GLB ships in `android/app/src/main/assets/models/<id>.glb` and is
 * read via `copyFileAssets`. iOS: the detect→place AR path is Android-only
 * (ARCore), so iOS resolution returns null rather than wiring the Xcode bundle.
 *
 * Empty-safe: only models present in BUNDLED_GLBS resolve; everything else
 * returns null so callers fall through to the remote/CDN path.
 */
import { Platform } from 'react-native';
import {
  CachesDirectoryPath,
  copyFileAssets,
  exists as fileExists,
  existsAssets,
  mkdir,
} from '@dr.pogodin/react-native-fs';

/** modelId → path of the GLB inside the platform asset bundle.
 *  Intentionally empty: no GLBs are bundled in-app anymore — every model streams
 *  from CloudFront (GLB_BASE_URL) to keep the APK small. isGlbBundled() returns
 *  false and getBundledGlbUri() returns null, so callers always use the CDN path. */
const BUNDLED_GLBS: Record<string, string> = {};

const OUT_DIR = `${CachesDirectoryPath}/bundled_glb`;
const memo = new Map<string, string>();

/** True if this model id is bundled in-app. */
export function isGlbBundled(modelId: string): boolean {
  return modelId in BUNDLED_GLBS;
}

/**
 * Returns a `file://` URI for the bundled GLB, copying it out of app assets on
 * first use. Returns null if the model isn't bundled or on any copy failure
 * (caller should then try the remote path).
 */
export async function getBundledGlbUri(modelId: string): Promise<string | null> {
  const assetPath = BUNDLED_GLBS[modelId];
  if (!assetPath) return null;

  const cached = memo.get(modelId);
  if (cached) return cached;

  // Only Android ships these in assets/ today.
  if (Platform.OS !== 'android') return null;

  const dest = `${OUT_DIR}/${modelId}.glb`;
  try {
    if (await fileExists(dest)) {
      const uri = `file://${dest}`;
      memo.set(modelId, uri);
      return uri;
    }

    const present = await existsAssets(assetPath);
    if (!present) {
      if (__DEV__) console.warn('[localGlbAssets] asset missing:', assetPath);
      return null;
    }

    if (!(await fileExists(OUT_DIR))) {
      await mkdir(OUT_DIR);
    }
    await copyFileAssets(assetPath, dest);
    const uri = `file://${dest}`;
    memo.set(modelId, uri);
    return uri;
  } catch (err) {
    if (__DEV__) console.warn('[localGlbAssets] copy failed for', modelId, err);
    return null;
  }
}
