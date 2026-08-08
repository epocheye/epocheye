package com.epocheye.record

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.media.MediaMetadataRetriever
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.StatFs
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.util.concurrent.Executors

/**
 * JS-facing API for recording the AR screen.
 *
 * A NativeModule, not a ViewManager command: recording is screen-scoped rather
 * than view-scoped, it needs onActivityResult for the system consent dialog, and
 * promises give typed failures where a fire-and-forget command gives silence.
 *
 * This class deliberately NEVER touches MediaProjection — see ScreenRecordService.
 */
class ScreenRecordModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener, LifecycleEventListener {

    companion object {
        private const val TAG = "EpocheyeRecord"
        private const val REQ = 0xEC01
        private const val EVENT = "EpocheyeRecording"
        /** Beyond this the consent token is treated as stale and re-requested. */
        private const val CONSENT_TTL_MS = 30_000L
        private const val MIN_SDK = Build.VERSION_CODES.Q
        private const val DEFAULT_MAX_MS = 30_000
        private const val HARD_MAX_MS = 60_000
    }

    private val io = Executors.newSingleThreadExecutor()

    private var consentPromise: Promise? = null
    private var startPromise: Promise? = null
    private var stopPromise: Promise? = null

    private var resultCode = 0
    private var resultData: Intent? = null
    private var consentAtMs = 0L
    private var geometry: CaptureGeometry? = null
    private var pendingPath: File? = null
    private var pendingHint: String? = null
    private var saveToGallery = true
    private var orientationLocked = false

    init {
        reactContext.addActivityEventListener(this)
        reactContext.addLifecycleEventListener(this)
        ScreenRecordBus.listener = ::onBusState
    }

    override fun getName() = "EpocheyeScreenRecorder"

    // ── JS API ──────────────────────────────────────────────────────────────

    @ReactMethod
    fun isSupported(promise: Promise) {
        val map = Arguments.createMap().apply {
            putBoolean("supported", Build.VERSION.SDK_INT >= MIN_SDK)
            putInt("sdkInt", Build.VERSION.SDK_INT)
        }
        promise.resolve(map)
    }

    /**
     * Ask the system for screen-capture consent. Everything that could refuse
     * the recording is checked BEFORE the dialog, so we never show a consent
     * prompt we cannot honour.
     */
    @ReactMethod
    fun requestConsent(options: ReadableMap?, promise: Promise) {
        if (Build.VERSION.SDK_INT < MIN_SDK) {
            promise.reject("unsupported_os", "Screen recording needs Android 10 or newer")
            return
        }
        if (ScreenRecordBus.state is RecState.Recording) {
            promise.reject("already_recording", "A recording is already running")
            return
        }
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("no_activity", "No foreground activity")
            return
        }
        val maxMs = (options?.takeIf { it.hasKey("maxDurationMs") }
            ?.getInt("maxDurationMs") ?: DEFAULT_MAX_MS).coerceIn(1_000, HARD_MAX_MS)
        pendingHint = options?.takeIf { it.hasKey("fileNameHint") }?.getString("fileNameHint")
        saveToGallery =
            options?.takeIf { it.hasKey("saveToGallery") }?.getBoolean("saveToGallery") ?: true

        val geo = try {
            ScreenRecordConfig.compute(activity)
        } catch (t: Throwable) {
            promise.reject("encoder_failed", t.message)
            return
        }
        geometry = geo

        // 2x for the MediaStore copy, 1.3x headroom.
        val needBytes = (geo.bitRate / 8L) * (maxMs / 1000L) * 26 / 10
        if (freeBytes(reactContext.cacheDir) < needBytes) {
            promise.reject(
                "disk_full",
                "Needs about ${needBytes / (1024 * 1024)} MB free",
            )
            return
        }

        consentPromise = promise
        lockOrientation(activity)
        try {
            val mpm = reactContext.getSystemService(MediaProjectionManager::class.java)
            reactContext.startActivityForResult(mpm.createScreenCaptureIntent(), REQ, null)
        } catch (t: Throwable) {
            consentPromise = null
            releaseOrientation()
            promise.reject("service_start_failed", t.message)
        }
    }

    @ReactMethod
    fun start(options: ReadableMap?, promise: Promise) {
        val data = resultData
        if (data == null || SystemClock.elapsedRealtime() - consentAtMs > CONSENT_TTL_MS) {
            promise.reject("consent_stale", "Screen-capture consent expired")
            return
        }
        val geo = geometry
        if (geo == null) {
            promise.reject("encoder_failed", "No capture geometry")
            return
        }
        val maxMs = (options?.takeIf { it.hasKey("maxDurationMs") }
            ?.getInt("maxDurationMs") ?: DEFAULT_MAX_MS).coerceIn(1_000, HARD_MAX_MS)
        val audio = options?.takeIf { it.hasKey("audio") }?.getBoolean("audio") ?: true

        val file = ScreenRecordStore.newCacheFile(reactContext, pendingHint)
        pendingPath = file
        startPromise = promise
        emit("preparing", null)

        val intent = Intent(reactContext, ScreenRecordService::class.java).apply {
            action = ScreenRecordService.ACTION_START
            putExtra(ScreenRecordService.EXTRA_RESULT_CODE, resultCode)
            putExtra(ScreenRecordService.EXTRA_RESULT_DATA, data)
            putExtra(ScreenRecordService.EXTRA_WIDTH, geo.width)
            putExtra(ScreenRecordService.EXTRA_HEIGHT, geo.height)
            putExtra(ScreenRecordService.EXTRA_DPI, geo.densityDpi)
            putExtra(ScreenRecordService.EXTRA_BITRATE, geo.bitRate)
            putExtra(ScreenRecordService.EXTRA_FPS, geo.fps)
            putExtra(ScreenRecordService.EXTRA_AUDIO, audio)
            putExtra(ScreenRecordService.EXTRA_MAX_MS, maxMs)
            putExtra(ScreenRecordService.EXTRA_PATH, file.absolutePath)
        }
        try {
            ContextCompat.startForegroundService(reactContext, intent)
        } catch (t: Throwable) {
            startPromise = null
            releaseOrientation()
            promise.reject("service_start_failed", t.message)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        if (ScreenRecordBus.state !is RecState.Recording) {
            promise.reject("already_recording", "Not recording")
            return
        }
        stopPromise = promise
        send(ScreenRecordService.ACTION_STOP)
    }

    @ReactMethod
    fun cancel(promise: Promise) {
        send(ScreenRecordService.ACTION_CANCEL)
        releaseOrientation()
        promise.resolve(null)
    }

    @ReactMethod
    fun share(params: ReadableMap, promise: Promise) {
        val uriStr = params.takeIf { it.hasKey("uri") }?.getString("uri")
        if (uriStr.isNullOrBlank()) {
            promise.reject("save_failed", "No clip to share")
            return
        }
        val text = params.takeIf { it.hasKey("text") }?.getString("text")
        try {
            val uri = if (uriStr.startsWith("content://")) {
                Uri.parse(uriStr)
            } else {
                ScreenRecordStore.contentUriFor(
                    reactContext,
                    File(Uri.parse(uriStr).path ?: uriStr),
                )
            }
            val chooser = ScreenRecordStore.buildShareIntent(uri, text)
            val activity = reactContext.currentActivity
            if (activity != null) {
                activity.startActivity(chooser)
            } else {
                reactContext.startActivity(chooser)
            }
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("save_failed", t.message)
        }
    }

    // Required no-ops so a JS NativeEventEmitter over this module doesn't warn.
    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    // ── Bus / lifecycle ─────────────────────────────────────────────────────

    private fun onBusState(state: RecState) {
        when (state) {
            is RecState.Recording -> {
                emit("recording", Arguments.createMap().apply {
                    putDouble("elapsedMs", 0.0)
                    putBoolean("hasAudio", state.hasAudio)
                })
                startPromise?.resolve(null)
                startPromise = null
            }
            is RecState.Finalizing -> {
                emit("finalizing", null)
                io.execute { publish(state) }
            }
            is RecState.Failed -> {
                releaseOrientation()
                emit("error", Arguments.createMap().apply {
                    putString("code", state.code)
                    state.message?.let { putString("message", it) }
                })
                // A revoked projection or a filled disk can still leave a valid
                // partial clip. Publish it rather than throwing away footage.
                val partial = state.partial
                if (partial != null && partial.exists() && partial.length() > 0) {
                    io.execute {
                        publish(
                            RecState.Finalizing(partial, 0L, false, degraded = state.code),
                        )
                    }
                } else {
                    startPromise?.reject(state.code, state.message)
                    stopPromise?.reject(state.code, state.message)
                    startPromise = null
                    stopPromise = null
                }
                ScreenRecordBus.reset()
            }
            else -> Unit
        }
    }

    /** Off the main thread: metadata probe + the gallery copy. */
    private fun publish(state: RecState.Finalizing) {
        val file = state.file
        var durationMs = state.durationMs
        var width = geometry?.width ?: 0
        var height = geometry?.height ?: 0
        try {
            MediaMetadataRetriever().use { mmr ->
                mmr.setDataSource(file.absolutePath)
                mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    ?.toLongOrNull()?.let { durationMs = it }
                mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                    ?.toIntOrNull()?.let { width = it }
                mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                    ?.toIntOrNull()?.let { height = it }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "metadata probe failed", t)
        }

        val galleryUri = if (saveToGallery) {
            ScreenRecordStore.saveToGallery(reactContext, file, file.name)
        } else {
            null
        }

        val result: WritableMap = Arguments.createMap().apply {
            putString("uri", Uri.fromFile(file).toString())
            galleryUri?.let { putString("galleryUri", it) }
            putInt("width", width)
            putInt("height", height)
            putDouble("durationMs", durationMs.toDouble())
            putDouble("sizeBytes", file.length().toDouble())
            putBoolean("hasAudio", state.hasAudio)
            val degraded = state.degraded ?: if (saveToGallery && galleryUri == null) {
                "save_failed"
            } else {
                null
            }
            degraded?.let { putString("degraded", it) }
        }

        releaseOrientation()
        emit("saved", null)
        stopPromise?.resolve(result)
        startPromise?.resolve(result)
        stopPromise = null
        startPromise = null
        ScreenRecordBus.reset()
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        code: Int,
        data: Intent?,
    ) {
        if (requestCode != REQ) return
        val promise = consentPromise
        consentPromise = null
        if (code != Activity.RESULT_OK || data == null) {
            releaseOrientation()
            // A denial is a decision, not an error — no toast, no noise.
            promise?.reject("consent_denied", "Screen capture was not allowed")
            return
        }
        resultCode = code
        resultData = data
        consentAtMs = SystemClock.elapsedRealtime()
        promise?.resolve(null)
    }

    override fun onNewIntent(intent: Intent) {}

    override fun onHostResume() {}

    /**
     * Backgrounding stops the recording immediately. The FGS would happily keep
     * the projection alive and capture the user's home screen and whatever app
     * they switched to — a privacy hazard, and never what anyone wanted.
     */
    override fun onHostPause() {
        if (ScreenRecordBus.state is RecState.Recording) {
            send(ScreenRecordService.ACTION_STOP)
        }
    }

    override fun onHostDestroy() {
        send(ScreenRecordService.ACTION_STOP)
        releaseOrientation()
    }

    override fun invalidate() {
        send(ScreenRecordService.ACTION_STOP)
        ScreenRecordBus.listener = null
        reactContext.removeActivityEventListener(this)
        reactContext.removeLifecycleEventListener(this)
        releaseOrientation()
        io.shutdown()
        super.invalidate()
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private fun send(action: String) {
        try {
            reactContext.startService(
                Intent(reactContext, ScreenRecordService::class.java).setAction(action),
            )
        } catch (_: Throwable) {
        }
    }

    private fun emit(state: String, extra: WritableMap?) {
        val map = Arguments.createMap().apply {
            putString("state", state)
            extra?.let { merge(it) }
        }
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT, map)
        } catch (_: Throwable) {
        }
    }

    /** A VirtualDisplay has a fixed size; rotating mid-record distorts the clip. */
    private fun lockOrientation(activity: Activity) {
        try {
            activity.runOnUiThread {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LOCKED
            }
            orientationLocked = true
        } catch (_: Throwable) {
        }
    }

    private fun releaseOrientation() {
        if (!orientationLocked) return
        orientationLocked = false
        val activity = reactContext.currentActivity ?: return
        try {
            activity.runOnUiThread {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        } catch (_: Throwable) {
        }
    }

    private fun freeBytes(dir: File): Long = try {
        val fs = StatFs(dir.absolutePath)
        fs.availableBlocksLong * fs.blockSizeLong
    } catch (_: Throwable) {
        Long.MAX_VALUE
    }
}

private fun WritableMap.merge(other: WritableMap) {
    val it = other.keySetIterator()
    while (it.hasNextKey()) {
        val key = it.nextKey()
        when (other.getType(key)) {
            com.facebook.react.bridge.ReadableType.Boolean ->
                putBoolean(key, other.getBoolean(key))
            com.facebook.react.bridge.ReadableType.Number ->
                putDouble(key, other.getDouble(key))
            com.facebook.react.bridge.ReadableType.String ->
                putString(key, other.getString(key))
            else -> Unit
        }
    }
}
