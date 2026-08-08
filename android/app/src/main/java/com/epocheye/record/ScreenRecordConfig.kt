package com.epocheye.record

import android.app.Activity
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log

/**
 * Capture geometry for the virtual display.
 *
 * Two things here are not optional and are easy to get wrong:
 *
 *  1. H.264 requires EVEN dimensions, and encoders advertise their own width and
 *     height alignment. Handing MediaRecorder a size the device's encoder does
 *     not support fails at prepare() with an opaque IllegalStateException, so we
 *     probe the encoder instead of hoping.
 *  2. The aspect ratio must match the real screen, or AUTO_MIRROR letterboxes
 *     the capture and the watermark ends up floating in a black band.
 */
data class CaptureGeometry(
    val width: Int,
    val height: Int,
    val densityDpi: Int,
    val bitRate: Int,
    val fps: Int,
)

object ScreenRecordConfig {
    private const val TAG = "EpocheyeRecord"

    /** Long edge cap. 1600 is sharp on a phone and keeps a 30 s clip ~30 MB. */
    private const val MAX_LONG_EDGE = 1600
    private const val FPS = 30

    fun compute(activity: Activity): CaptureGeometry {
        val metrics = DisplayMetrics()
        var w: Int
        var h: Int
        val density: Int
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = activity.windowManager.currentWindowMetrics.bounds
            w = bounds.width()
            h = bounds.height()
            density = activity.resources.configuration.densityDpi
        } else {
            @Suppress("DEPRECATION")
            activity.windowManager.defaultDisplay.getRealMetrics(metrics)
            w = metrics.widthPixels
            h = metrics.heightPixels
            density = metrics.densityDpi
        }

        val longEdge = maxOf(w, h)
        if (longEdge > MAX_LONG_EDGE) {
            val scale = MAX_LONG_EDGE.toFloat() / longEdge
            w = (w * scale).toInt()
            h = (h * scale).toInt()
        }
        w = w and 1.inv()
        h = h and 1.inv()

        val fitted = fitToEncoder(w, h)
        val bitRate =
            (fitted.first.toLong() * fitted.second * FPS * 0.10)
                .toInt()
                .coerceIn(4_000_000, 12_000_000)

        Log.i(TAG, "capture geometry ${fitted.first}x${fitted.second} @${bitRate}bps dpi=$density")
        return CaptureGeometry(fitted.first, fitted.second, density, bitRate, FPS)
    }

    /** Snap to the AVC encoder's alignment, and verify it will accept the size. */
    private fun fitToEncoder(width: Int, height: Int): Pair<Int, Int> {
        return try {
            val caps = avcVideoCaps() ?: return width to height
            val wAlign = caps.widthAlignment.coerceAtLeast(2)
            val hAlign = caps.heightAlignment.coerceAtLeast(2)
            var w = (width / wAlign) * wAlign
            var h = (height / hAlign) * hAlign
            if (!caps.isSizeSupported(w, h)) {
                // Fall back to the largest supported size with the same aspect.
                val ratio = height.toDouble() / width
                w = caps.supportedWidths.clamp(w)
                w = (w / wAlign) * wAlign
                h = ((w * ratio).toInt() / hAlign) * hAlign
                h = caps.getSupportedHeightsFor(w).clamp(h)
                h = (h / hAlign) * hAlign
            }
            if (w <= 0 || h <= 0) width to height else w to h
        } catch (t: Throwable) {
            Log.w(TAG, "encoder probe failed; using raw size", t)
            width to height
        }
    }

    private fun avcVideoCaps(): MediaCodecInfo.VideoCapabilities? {
        val list = MediaCodecList(MediaCodecList.REGULAR_CODECS)
        for (info in list.codecInfos) {
            if (!info.isEncoder) continue
            if (info.supportedTypes.none { it.equals(MediaFormat.MIMETYPE_VIDEO_AVC, true) }) {
                continue
            }
            return info.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC)
                .videoCapabilities
        }
        return null
    }

    private fun android.util.Range<Int>.clamp(value: Int): Int =
        value.coerceIn(lower, upper)
}
