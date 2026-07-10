package com.epocheye.ota

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

/**
 * Native bridge for the self-hosted OTA system. JS (src/services/otaService.ts)
 * downloads + verifies a bundle into the OTA dir, then drives this module.
 *
 * Registered as a classic module via [OtaPackage] in MainApplication (New-Arch
 * bridge interop, same as ARCorePackage).
 */
class OtaModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /**
     * OTA state the JS layer needs before deciding to download:
     *   - runtimeVersion: must match the manifest's runtime_version
     *   - otaDir: absolute dir the downloader writes bundles into
     *   - currentBundleVersion: what's installed now (sent as current_version)
     */
    @ReactMethod
    fun getInfo(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val map: WritableMap = Arguments.createMap().apply {
                putString("runtimeVersion", OtaBundle.runtimeVersion)
                putString("otaDir", OtaBundle.otaDirPath(ctx))
                putInt("currentBundleVersion", OtaBundle.currentBundleVersion(ctx))
            }
            promise.resolve(map)
        } catch (t: Throwable) {
            promise.reject("ota_info_failed", t)
        }
    }

    /**
     * Promote the pending bundle to confirmed. JS calls this once the app has
     * booted healthily (navigation ready), arming the crash-rollback guard.
     */
    @ReactMethod
    fun markBootSuccess(promise: Promise) {
        try {
            OtaBundle.markBootSuccess(reactApplicationContext)
            promise.resolve(true)
        } catch (t: Throwable) {
            promise.reject("ota_confirm_failed", t)
        }
    }

    /**
     * Stage the downloaded bundle as pending, then relaunch the app so
     * MainApplication rebuilds ReactHost from the new bundle path. The verified
     * absolute file path + its bundle_version are passed from JS.
     */
    @ReactMethod
    fun applyAndRestart(info: ReadableMap, promise: Promise) {
        try {
            val path = info.getString("path")
            val bundleVersion = if (info.hasKey("bundleVersion")) info.getInt("bundleVersion") else 0
            if (path.isNullOrBlank()) {
                promise.reject("ota_apply_failed", "missing bundle path")
                return
            }
            val ctx = reactApplicationContext
            OtaBundle.stagePending(ctx, path, bundleVersion)
            promise.resolve(true)

            // Relaunch on a fresh task, then kill this process so the lazy
            // ReactHost is rebuilt with the staged bundle path.
            val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                ctx.startActivity(launch)
            }
            // Give the resolve() callback a moment to flush before exiting.
            android.os.Handler(ctx.mainLooper).postDelayed({
                Runtime.getRuntime().exit(0)
            }, 300)
        } catch (t: Throwable) {
            promise.reject("ota_apply_failed", t)
        }
    }

    companion object {
        const val NAME = "OtaModule"
    }
}
