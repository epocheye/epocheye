package com.epocheye

import android.content.Context
import android.content.res.Resources
import com.facebook.react.uimanager.DisplayMetricsHolder
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Tablet UI scaling.
 *
 * The app's UI is designed at a phone width with absolute sizes everywhere
 * (hardcoded NativeWind px, inline styles, fonts). On a tablet the screen reports
 * far more logical dp than a phone, so that phone layout stays small and leaves big
 * empty gaps. There is no shared sizing layer to scale per-value.
 *
 * The uniform fix is to override the display DENSITY on tablets so React Native
 * perceives a phone-like dp width: RN converts dp↔px via displayMetrics.density,
 * so raising density makes the same pixel screen report ~[BASE_WIDTH_DP] dp wide
 * and the phone layout renders scaled-up to fill the screen. This affects every
 * dp-based size at once (NativeWind, inline styles, fonts, JS Dimensions) with no
 * component changes.
 *
 * Phones are left untouched (gated at [TABLET_MIN_SW_DP]); only tablets scale.
 */
object ScreenScaling {

    /** Design base width the phone UI targets (≈ a typical phone's smallest width). */
    private const val BASE_WIDTH_DP = 411f

    /** Only scale screens at least this wide (dp). Phones stay native. */
    private const val TABLET_MIN_SW_DP = 600

    /** Clamp so very large tablets don't enlarge the UI absurdly. */
    private const val MAX_FACTOR = 1.6f

    // The device's TRUE density, captured once before any override so repeated
    // applies never compound. 0 = not captured yet.
    @Volatile
    private var nativeDensity = 0f

    @Volatile
    private var nativeSwDp = 0

    private fun captureNativeMetricsIfNeeded(res: Resources) {
        if (nativeDensity > 0f) return
        val m = res.displayMetrics
        nativeDensity = m.density
        // smallestScreenWidthDp from config is the orientation-stable width in dp.
        val swDp = res.configuration.smallestScreenWidthDp
        nativeSwDp = if (swDp > 0) {
            swDp
        } else {
            (min(m.widthPixels, m.heightPixels) / m.density).roundToInt()
        }
    }

    /** Scale factor for this device, or 1f for phones / when no scaling applies. */
    private fun factor(): Float {
        if (nativeSwDp < TABLET_MIN_SW_DP) return 1f
        val f = nativeSwDp / BASE_WIDTH_DP
        return f.coerceIn(1f, MAX_FACTOR)
    }

    /**
     * Apply the tablet density override to [res] (idempotent — always sets absolute
     * values derived from the cached native density, never multiplies cumulatively).
     */
    fun apply(res: Resources) {
        captureNativeMetricsIfNeeded(res)
        val f = factor()
        if (f == 1f) return

        val target = nativeDensity * f
        val metrics = res.displayMetrics
        metrics.density = target
        @Suppress("DEPRECATION")
        run { metrics.scaledDensity = target }
        metrics.densityDpi = (160f * target).roundToInt()
        res.configuration.densityDpi = metrics.densityDpi
    }

    /**
     * Apply to the context's resources AND publish the scaled metrics to React
     * Native's [DisplayMetricsHolder] so JS Dimensions/layout use the phone-like dp.
     * Call before React initializes and again on configuration changes.
     */
    fun applyAndSyncReactNative(context: Context) {
        val res = context.resources
        apply(res)
        if (factor() == 1f) return
        try {
            DisplayMetricsHolder.setWindowDisplayMetrics(res.displayMetrics)
            DisplayMetricsHolder.setScreenDisplayMetrics(res.displayMetrics)
        } catch (_: Throwable) {
            // RN not present / signature mismatch — the resources override still
            // scales native views; degrade gracefully.
        }
    }
}
