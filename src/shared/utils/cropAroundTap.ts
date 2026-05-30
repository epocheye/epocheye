/**
 * Crop a JPEG to a square region centred on a tapped point.
 *
 * Museum mode taps an object; sending the whole scene to the identify call
 * makes the result less specific and less cache-stable (neighbouring objects
 * drift in and change the label). Cropping to ~45% of the shorter edge around
 * the tap isolates the intended object → more specific + more consistent
 * labels + a smaller, faster upload.
 *
 * Reuses the same Skia decode → offscreen draw → re-encode path as
 * `geminiVisionService.prepareImageForGemini` (no new dependency). The tap is
 * given as a 0..1 fraction of the preview; because the preview is full-screen
 * "cover", the mapping is approximate, so the 45% window is generous enough to
 * keep the object in frame despite the imprecision.
 *
 * Always degrades gracefully: any failure returns the original uri so the full
 * frame is sent rather than nothing.
 */

import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
} from '@shopify/react-native-skia';
import {
  DocumentDirectoryPath,
  exists as fileExists,
  mkdir,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { fileToBase64 } from '../../services/geminiVisionService';

const CROP_FRACTION = 0.45; // square side as a fraction of the shorter edge
const JPEG_QUALITY = 85;
const CROP_DIR = `${DocumentDirectoryPath}/museum_crops`;

/**
 * @param srcUri  file:// uri (or path) of the captured JPEG
 * @param xFrac   tap X as a 0..1 fraction of the preview width
 * @param yFrac   tap Y as a 0..1 fraction of the preview height
 * @returns a file:// uri of the cropped JPEG, or `srcUri` on any failure
 */
export async function cropAroundTap(
  srcUri: string,
  xFrac: number,
  yFrac: number,
): Promise<string> {
  try {
    const raw = await fileToBase64(srcUri);
    const data = Skia.Data.fromBase64(raw);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return srcUri;

    const w = image.width();
    const h = image.height();
    if (w <= 0 || h <= 0) return srcUri;

    const shorter = Math.min(w, h);
    const side = Math.max(1, Math.round(shorter * CROP_FRACTION));
    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(Math.max(v, lo), hi);

    const cx = clamp(xFrac, 0, 1) * w;
    const cy = clamp(yFrac, 0, 1) * h;
    const left = clamp(Math.round(cx - side / 2), 0, w - side);
    const top = clamp(Math.round(cy - side / 2), 0, h - side);

    const surface = Skia.Surface.MakeOffscreen(side, side);
    if (!surface) return srcUri;
    const canvas = surface.getCanvas();
    canvas.drawImageRectOptions(
      image,
      Skia.XYWHRect(left, top, side, side),
      Skia.XYWHRect(0, 0, side, side),
      FilterMode.Linear,
      MipmapMode.None,
      Skia.Paint(),
    );
    surface.flush();

    const snapshot = surface.makeImageSnapshot();
    const b64 = snapshot.encodeToBase64(ImageFormat.JPEG, JPEG_QUALITY);
    if (!b64) return srcUri;

    if (!(await fileExists(CROP_DIR))) {
      await mkdir(CROP_DIR);
    }
    const path = `${CROP_DIR}/crop_${Date.now()}.jpg`;
    await writeFile(path, b64, 'base64');
    return `file://${path}`;
  } catch (err) {
    if (__DEV__) {
      console.warn('[cropAroundTap] failed — sending full frame', err);
    }
    return srcUri;
  }
}
