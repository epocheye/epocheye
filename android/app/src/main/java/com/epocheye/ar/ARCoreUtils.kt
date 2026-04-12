package com.epocheye.ar

import android.content.Context
import com.google.ar.core.ArCoreApk

/**
 * Utility for checking ARCore availability at runtime.
 * Uses `android:value="optional"` in the manifest, so devices
 * without ARCore can still install the app and fall back to 2D.
 */
object ARCoreUtils {

    fun isAvailable(context: Context): Boolean {
        return try {
            val availability = ArCoreApk.getInstance().checkAvailability(context)
            availability.isSupported
        } catch (_: Exception) {
            false
        }
    }

    fun isInstalled(context: Context): Boolean {
        return try {
            val availability = ArCoreApk.getInstance().checkAvailability(context)
            availability == ArCoreApk.Availability.SUPPORTED_INSTALLED
        } catch (_: Exception) {
            false
        }
    }
}
