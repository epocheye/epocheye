/**
 * Composites the restoration before/after into a single shareable image.
 *
 * Exports exactly what the visitor was looking at: the captured photo on the
 * left of the handle, the restoration on the right, split at the position they
 * dragged to — plus the caption burned in below.
 *
 * The caption is not decoration on the export. The image is the thing that gets
 * shared, and a reconstruction travelling without its "this part is not
 * recorded" is precisely the failure the caption exists to prevent.
 *
 * Skia + react-native-fs, following the same pipeline as
 * `src/shared/utils/cropAroundTap.ts`: decode → offscreen surface → snapshot →
 * base64 → temp file. Returns a `file://` URI ready for CameraRoll.
 */

import {
  ClipOp,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { Image } from 'react-native';
import {
  CachesDirectoryPath,
  exists,
  mkdir,
  readFile,
  writeFile,
} from '@dr.pogodin/react-native-fs';

import { wipeSplitX } from '../utils/audioGuide';

const OUT_DIR = `${CachesDirectoryPath}/restoration_exports`;
const JPEG_QUALITY = 92;

/**
 * Footer geometry, as fractions of image width so the band scales with whatever
 * the camera produced rather than being sized for one device.
 */
const PAD = 0.026;
const WORDMARK_SIZE = 0.038;
const SITE_SIZE = 0.034;
const CAPTION_SIZE = 0.024;
const LOGO_SIZE = 0.055;

export interface ComposeArgs {
  /** Captured photo — a file:// URI from vision-camera. */
  beforeUri: string;
  /** Restoration — a remote https URL or a local URI. */
  afterUri: string;
  /** Handle position, 0..1 across the frame. */
  splitFraction: number;
  /** Authored provenance line. Omitted when the clip has none. */
  caption?: string;
  /** Site name, so a shared image says which monument it is. */
  siteName?: string;
}

/** Decodes any URI Skia can reach into an SkImage, or null. */
async function loadImage(uri: string): Promise<SkImage | null> {
  // Remote assets go through Skia's own fetch; local files are read as base64
  // because Skia.Data.fromURI does not reliably handle file:// on Android.
  if (/^https?:\/\//i.test(uri)) {
    const data = await Skia.Data.fromURI(uri);
    return data ? Skia.Image.MakeImageFromEncoded(data) : null;
  }
  const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
  const b64 = await readFile(path, 'base64');
  const data = Skia.Data.fromBase64(b64);
  return data ? Skia.Image.MakeImageFromEncoded(data) : null;
}

/**
 * A system typeface at the given size. Two traps here, both hit on device:
 *   * `Skia.Font(undefined, size)` throws at the JSI boundary — an explicitly
 *     passed undefined is still an argument the binding tries to coerce into a
 *     typeface ("Value is undefined, expected an Object").
 *   * `Skia.Font()` with no args succeeds but carries NO glyphs, so drawText
 *     renders nothing and the band comes out silently empty.
 * A system face also matters for Devanagari and Bengali captions, which the
 * app's bundled Latin faces would drop.
 */
function systemFont(size: number) {
  return Skia.Font(
    Skia.FontMgr.System().matchFamilyStyle('', {
      weight: 400,
      width: 5,
      slant: 0,
    }),
    size,
  );
}

/** The bundled wordmark, or null if it cannot be decoded (branding is best-effort). */
async function loadLogo(): Promise<SkImage | null> {
  try {
    const asset = Image.resolveAssetSource(
      require('../../assets/images/logo-white.png'),
    );
    return asset?.uri ? await loadImage(asset.uri) : null;
  } catch {
    return null;
  }
}

/**
 * Wraps text to a pixel width using the font's own measurement, so the caption
 * cannot run off the edge of the exported image in any language.
 */
function wrapLines(
  text: string,
  font: ReturnType<typeof Skia.Font>,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Builds the composite and returns a `file://` URI.
 * Throws if either image cannot be decoded — the caller surfaces a toast; a
 * half-composited export would be worse than none.
 */
export async function composeBeforeAfter({
  beforeUri,
  afterUri,
  splitFraction,
  caption,
  siteName,
}: ComposeArgs): Promise<string> {
  const [before, after] = await Promise.all([
    loadImage(beforeUri),
    loadImage(afterUri),
  ]);
  if (!before || !after) {
    throw new Error('restoration composite: could not decode source images');
  }

  // The photo sets the output geometry; the restoration is scaled to match so
  // the two halves line up regardless of the asset's native size.
  const w = before.width();
  const h = before.height();

  // Footer is measured, not guessed: wrap the caption first so the band is
  // exactly tall enough. A fixed fraction either clipped long captions or left
  // dead space under short ones.
  const pad = Math.round(w * PAD);
  const captionSize = Math.round(w * CAPTION_SIZE);
  const captionFont = systemFont(captionSize);
  const captionLines = caption?.trim()
    ? wrapLines(caption.trim(), captionFont, w - pad * 2)
    : [];
  const footer =
    Math.round(w * LOGO_SIZE) + // wordmark row
    (siteName ? Math.round(w * SITE_SIZE * 1.5) : 0) +
    captionLines.length * Math.round(captionSize * 1.35) +
    pad * 2;

  const surface = Skia.Surface.MakeOffscreen(w, h + footer);
  if (!surface) {
    throw new Error('restoration composite: could not allocate surface');
  }
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  canvas.drawColor(Skia.Color('#0A0A0A'));

  const full = Skia.XYWHRect(0, 0, w, h);
  canvas.drawImageRectOptions(
    before,
    Skia.XYWHRect(0, 0, before.width(), before.height()),
    full,
    FilterMode.Linear,
    MipmapMode.None,
    paint,
  );

  // Restoration clipped to the right of the split — same geometry helper the
  // on-screen wipe uses, so the export matches what was on screen.
  const splitX = wipeSplitX(splitFraction, w);
  canvas.save();
  canvas.clipRect(
    Skia.XYWHRect(splitX, 0, w - splitX, h),
    ClipOp.Intersect,
    true,
  );
  canvas.drawImageRectOptions(
    after,
    Skia.XYWHRect(0, 0, after.width(), after.height()),
    full,
    FilterMode.Linear,
    MipmapMode.None,
    paint,
  );
  canvas.restore();

  // The seam, so the image reads as a comparison rather than a bad stitch.
  const seam = Skia.Paint();
  seam.setColor(Skia.Color('#FFFFFF'));
  canvas.drawRect(Skia.XYWHRect(Math.max(0, splitX - 2), 0, 4, h), seam);

  /* ── Branded footer ──────────────────────────────────────────────────────
   * The shared image has to identify itself. Attribution sits in the SAME band
   * as the provenance caption on purpose: cropping the branding out also crops
   * out "this part is not recorded", so the picture cannot circulate as a
   * confident claim with the honesty trimmed off.
   */
  let y = h + pad;

  // Wordmark row: the bundled logo, then EPOCHEYE in brand gold.
  const logoPx = Math.round(w * LOGO_SIZE);
  const logo = await loadLogo();
  let textX = pad;
  if (logo) {
    canvas.drawImageRectOptions(
      logo,
      Skia.XYWHRect(0, 0, logo.width(), logo.height()),
      Skia.XYWHRect(pad, y, logoPx, logoPx),
      FilterMode.Linear,
      MipmapMode.None,
      paint,
    );
    textX = pad + logoPx + Math.round(pad * 0.6);
  }
  const markFont = systemFont(Math.round(w * WORDMARK_SIZE));
  const markPaint = Skia.Paint();
  markPaint.setColor(Skia.Color('#CBA862'));
  canvas.drawText(
    'EPOCHEYE',
    textX,
    y + logoPx * 0.68,
    markPaint,
    markFont,
  );
  y += logoPx + Math.round(pad * 0.5);

  if (siteName) {
    const siteFont = systemFont(Math.round(w * SITE_SIZE));
    const sitePaint = Skia.Paint();
    sitePaint.setColor(Skia.Color('#F4EFE7'));
    y += Math.round(w * SITE_SIZE);
    canvas.drawText(siteName, pad, y, sitePaint, siteFont);
    y += Math.round(w * SITE_SIZE * 0.5);
  }

  if (captionLines.length > 0) {
    const capPaint = Skia.Paint();
    capPaint.setColor(Skia.Color('#B8AF9E'));
    const lh = Math.round(captionSize * 1.35);
    y += captionSize;
    for (const line of captionLines) {
      canvas.drawText(line, pad, y, capPaint, captionFont);
      y += lh;
    }
  }

  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const b64 = snapshot.encodeToBase64(ImageFormat.JPEG, JPEG_QUALITY);
  if (!b64) {
    throw new Error('restoration composite: encode failed');
  }

  if (!(await exists(OUT_DIR))) {
    await mkdir(OUT_DIR);
  }
  // Timestamped so repeated saves do not overwrite one another in the gallery.
  const path = `${OUT_DIR}/restoration_${Date.now()}.jpg`;
  await writeFile(path, b64, 'base64');
  return `file://${path}`;
}
