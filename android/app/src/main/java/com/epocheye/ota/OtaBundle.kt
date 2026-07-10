package com.epocheye.ota

import android.content.Context
import android.util.Log
import com.epocheye.BuildConfig
import java.io.File
import org.json.JSONObject

/**
 * Self-hosted OTA bundle resolver + marker store.
 *
 * Two on-disk markers under `filesDir/ota/`:
 *   - `confirmed.json` — the last bundle that booted successfully (or absent =
 *     use the packaged bundle baked into the APK).
 *   - `active.json` — a *candidate* bundle being tried (`state = "pending"`),
 *     written by [OtaModule.applyAndRestart].
 *
 * Marker JSON shape:
 *   { "path": "<abs>", "runtimeVersion": "1.4", "bundleVersion": 2,
 *     "state": "pending"|"confirmed", "bootAttempts": 0 }
 *
 * Crash-safety: a pending bundle is attempted at most ONCE. If it boots and JS
 * calls [markBootSuccess] it is promoted to `confirmed`; if it crashes before
 * that, the next boot sees `bootAttempts >= 1`, discards it, and falls back to
 * the previous confirmed bundle (or the packaged one) — so a bad OTA can never
 * brick the app.
 *
 * runtime_version guard: any marker whose runtimeVersion != the binary's
 * [BuildConfig.OTA_RUNTIME_VERSION] is stale (a native/store build shipped since
 * it was written) and is ignored + cleared, so an OTA can never run on an
 * incompatible native binary.
 */
object OtaBundle {
    private const val TAG = "OtaBundle"
    private const val DIR = "ota"
    private const val ACTIVE = "active.json"
    private const val CONFIRMED = "confirmed.json"

    private const val STATE_PENDING = "pending"
    private const val STATE_CONFIRMED = "confirmed"

    /** The app's OTA runtime version, compiled into the binary. */
    val runtimeVersion: String
        get() = BuildConfig.OTA_RUNTIME_VERSION

    private fun otaDir(ctx: Context): File = File(ctx.filesDir, DIR).apply { mkdirs() }

    private fun read(ctx: Context, name: String): JSONObject? {
        val f = File(otaDir(ctx), name)
        if (!f.exists()) return null
        return try {
            JSONObject(f.readText())
        } catch (t: Throwable) {
            Log.e(TAG, "corrupt marker $name, dropping", t)
            f.delete()
            null
        }
    }

    private fun write(ctx: Context, name: String, obj: JSONObject) {
        try {
            File(otaDir(ctx), name).writeText(obj.toString())
        } catch (t: Throwable) {
            Log.e(TAG, "failed writing marker $name", t)
        }
    }

    private fun deleteMarker(ctx: Context, name: String) {
        try {
            File(otaDir(ctx), name).delete()
        } catch (_: Throwable) {}
    }

    private fun deleteBundleFile(path: String?) {
        if (path.isNullOrBlank()) return
        try {
            File(path).parentFile?.deleteRecursively()
        } catch (_: Throwable) {}
    }

    /** A marker is usable only if it's for THIS runtime and its file exists. */
    private fun usablePath(marker: JSONObject?): String? {
        val m = marker ?: return null
        if (m.optString("runtimeVersion") != runtimeVersion) return null
        val path = m.optString("path")
        if (path.isBlank() || !File(path).exists()) return null
        return path
    }

    /**
     * Called by MainApplication at ReactHost creation. Returns the absolute path
     * to the OTA bundle ReactHost should load, or null to use the packaged bundle.
     * Applies the crash-rollback guard for pending bundles.
     */
    fun resolveBundlePath(ctx: Context): String? {
        // 1. A pending candidate takes priority — attempt it at most once.
        val active = read(ctx, ACTIVE)
        if (active != null && active.optString("state") == STATE_PENDING) {
            val attempts = active.optInt("bootAttempts", 0)
            val path = usablePath(active)
            if (path == null) {
                // Stale runtime or missing file → discard.
                deleteBundleFile(active.optString("path"))
                deleteMarker(ctx, ACTIVE)
            } else if (attempts >= 1) {
                // We already tried this once and JS never confirmed it → bad bundle.
                Log.w(TAG, "pending OTA bundle failed to confirm, rolling back")
                deleteBundleFile(path)
                deleteMarker(ctx, ACTIVE)
            } else {
                // First attempt: record it, then load it.
                active.put("bootAttempts", attempts + 1)
                write(ctx, ACTIVE, active)
                Log.i(TAG, "loading pending OTA bundle v${active.optInt("bundleVersion")}")
                return path
            }
        }

        // 2. Otherwise the last known-good confirmed bundle.
        val confirmed = read(ctx, CONFIRMED)
        val confirmedPath = usablePath(confirmed)
        if (confirmed != null && confirmedPath == null) {
            // Stale/broken confirmed marker → drop so we cleanly use packaged.
            deleteBundleFile(confirmed.optString("path"))
            deleteMarker(ctx, CONFIRMED)
        }
        if (confirmedPath != null) {
            Log.i(TAG, "loading confirmed OTA bundle v${confirmed?.optInt("bundleVersion")}")
        }
        return confirmedPath
    }

    /**
     * Stage a downloaded bundle as the pending candidate (called just before an
     * app restart). Overwrites any prior pending marker.
     */
    fun stagePending(ctx: Context, path: String, bundleVersion: Int) {
        val obj = JSONObject()
            .put("path", path)
            .put("runtimeVersion", runtimeVersion)
            .put("bundleVersion", bundleVersion)
            .put("state", STATE_PENDING)
            .put("bootAttempts", 0)
        write(ctx, ACTIVE, obj)
    }

    /**
     * Promote the current pending bundle to confirmed (called by JS once the app
     * has booted healthily). Cleans up the previous confirmed bundle's files.
     */
    fun markBootSuccess(ctx: Context) {
        val active = read(ctx, ACTIVE) ?: return
        if (active.optString("state") != STATE_PENDING) return
        val path = usablePath(active) ?: return

        // Remove the old confirmed bundle files (if different) to reclaim space.
        val oldConfirmed = read(ctx, CONFIRMED)
        val oldPath = oldConfirmed?.optString("path")
        if (!oldPath.isNullOrBlank() && oldPath != path) {
            deleteBundleFile(oldPath)
        }

        val confirmed = JSONObject()
            .put("path", path)
            .put("runtimeVersion", runtimeVersion)
            .put("bundleVersion", active.optInt("bundleVersion"))
            .put("state", STATE_CONFIRMED)
        write(ctx, CONFIRMED, confirmed)
        deleteMarker(ctx, ACTIVE)
        Log.i(TAG, "confirmed OTA bundle v${active.optInt("bundleVersion")}")
    }

    /** The bundle_version currently in effect (confirmed, else pending, else 0). */
    fun currentBundleVersion(ctx: Context): Int {
        usablePath(read(ctx, CONFIRMED))?.let {
            return read(ctx, CONFIRMED)?.optInt("bundleVersion", 0) ?: 0
        }
        val active = read(ctx, ACTIVE)
        if (active != null && usablePath(active) != null) return active.optInt("bundleVersion", 0)
        return 0
    }

    /** Absolute path of the OTA working directory, for the JS downloader. */
    fun otaDirPath(ctx: Context): String = otaDir(ctx).absolutePath
}
