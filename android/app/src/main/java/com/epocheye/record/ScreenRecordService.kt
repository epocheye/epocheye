package com.epocheye.record

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Log
import android.view.Display
import androidx.core.app.NotificationCompat
import com.epocheye.R
import java.io.File

/**
 * Owns the MediaProjection for the lifetime of one recording.
 *
 * THE REASON THIS IS A SERVICE AT ALL: from API 34, calling
 * MediaProjectionManager.getMediaProjection() throws SecurityException unless a
 * foreground service of type `mediaProjection` is ALREADY running. Rather than
 * remember that ordering rule at a call site, the projection is created only
 * inside this class and only after startForeground() has returned — so there is
 * no code path in which a projection exists without a live FGS.
 *
 * Everything touching MediaProjection / VirtualDisplay / MediaRecorder runs on
 * one HandlerThread; nothing recorder-related touches the main thread.
 *
 * START_NOT_STICKY, and no android:process: the projection token is single-use
 * and process-local, so a system restart of this service could only ever
 * resurrect it holding a dead token. It must never be restarted.
 */
class ScreenRecordService : Service() {

    companion object {
        private const val TAG = "EpocheyeRecord"
        private const val CHANNEL = "epocheye-recording"
        private const val NOTIF_ID = 4711

        const val ACTION_START = "com.epocheye.record.START"
        const val ACTION_STOP = "com.epocheye.record.STOP"
        const val ACTION_CANCEL = "com.epocheye.record.CANCEL"

        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_RESULT_DATA = "resultData"
        const val EXTRA_WIDTH = "width"
        const val EXTRA_HEIGHT = "height"
        const val EXTRA_DPI = "dpi"
        const val EXTRA_BITRATE = "bitRate"
        const val EXTRA_FPS = "fps"
        const val EXTRA_AUDIO = "audio"
        const val EXTRA_MAX_MS = "maxDurationMs"
        const val EXTRA_PATH = "path"

        private const val MAX_FILE_BYTES = 200L * 1024 * 1024
        private const val WATCHDOG_SLACK_MS = 5_000L
    }

    private lateinit var thread: HandlerThread
    private lateinit var handler: Handler

    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var recorder: MediaRecorder? = null
    private var outFile: File? = null
    private var startedAtMs = 0L
    private var hasAudio = false
    private var startRotation = -1
    private var displayListener: DisplayManager.DisplayListener? = null
    private var watchdog: Runnable? = null
    private var stopping = false

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            // The user hit "Stop sharing" in the system chip. Save what exists.
            Log.i(TAG, "projection revoked by user")
            finish(discard = false, failCode = "projection_revoked")
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        thread = HandlerThread("epocheye-recorder").also { it.start() }
        handler = Handler(thread.looper)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                // MUST be the first thing that happens. The 5-second
                // startForegroundService deadline and the API 34 ordering rule
                // are both satisfied here and nowhere else.
                startForegroundCompat()
                handler.post { startRecording(intent) }
            }
            ACTION_STOP -> handler.post { finish(discard = false, failCode = null) }
            ACTION_CANCEL -> handler.post { finish(discard = true, failCode = null) }
            else -> stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL) != null) return
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL,
                getString(R.string.clip_recording_channel),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                setSound(null, null)
                enableVibration(false)
            },
        )
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_epocheye)
            .setContentTitle(getString(R.string.clip_recording_title))
            .setContentText(getString(R.string.clip_recording_text))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun startForegroundCompat() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIF_ID,
                    buildNotification(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
                )
            } else {
                startForeground(NOTIF_ID, buildNotification())
            }
        } catch (t: Throwable) {
            Log.e(TAG, "startForeground failed", t)
            ScreenRecordBus.post(RecState.Failed("service_start_failed", t.message, null))
            stopSelf()
        }
    }

    private fun startRecording(intent: Intent) {
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        val resultData: Intent? =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(EXTRA_RESULT_DATA)
            }
        if (resultData == null) {
            fail("projection_failed", "no consent data")
            return
        }
        val path = intent.getStringExtra(EXTRA_PATH)
        if (path.isNullOrBlank()) {
            fail("projection_failed", "no output path")
            return
        }
        val file = File(path)
        outFile = file

        val mpm =
            getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val proj = try {
            mpm.getMediaProjection(resultCode, resultData)
        } catch (t: Throwable) {
            Log.e(TAG, "getMediaProjection threw", t)
            null
        }
        if (proj == null) {
            fail("projection_failed", "projection unavailable")
            return
        }
        projection = proj
        // API 34 requires a callback registered BEFORE createVirtualDisplay.
        proj.registerCallback(projectionCallback, handler)

        val width = intent.getIntExtra(EXTRA_WIDTH, 720)
        val height = intent.getIntExtra(EXTRA_HEIGHT, 1280)
        val dpi = intent.getIntExtra(EXTRA_DPI, 320)
        val bitRate = intent.getIntExtra(EXTRA_BITRATE, 6_000_000)
        val fps = intent.getIntExtra(EXTRA_FPS, 30)
        val wantAudio = intent.getBooleanExtra(EXTRA_AUDIO, true)
        val maxMs = intent.getIntExtra(EXTRA_MAX_MS, 30_000)

        // Try with audio, and fall back to silent ONCE. The mic is commonly held
        // by another component, and a clip without sound beats no clip at all.
        if (!attempt(file, width, height, dpi, bitRate, fps, wantAudio, maxMs)) {
            releaseRecorderOnly()
            if (wantAudio && !attempt(file, width, height, dpi, bitRate, fps, false, maxMs)) {
                fail("encoder_failed", "recorder could not start")
                return
            } else if (!wantAudio) {
                fail("encoder_failed", "recorder could not start")
                return
            }
        }

        startedAtMs = System.currentTimeMillis()
        watchAsRotation()
        watchdog = Runnable {
            Log.w(TAG, "watchdog fired — force stop")
            finish(discard = false, failCode = null)
        }.also { handler.postDelayed(it, maxMs.toLong() + WATCHDOG_SLACK_MS) }

        ScreenRecordBus.post(RecState.Recording(startedAtMs, hasAudio))
    }

    private fun attempt(
        file: File,
        width: Int,
        height: Int,
        dpi: Int,
        bitRate: Int,
        fps: Int,
        audio: Boolean,
        maxMs: Int,
    ): Boolean {
        return try {
            val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            // Call order below is mandated by MediaRecorder's state machine.
            if (audio) rec.setAudioSource(MediaRecorder.AudioSource.MIC)
            rec.setVideoSource(MediaRecorder.VideoSource.SURFACE)
            rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            rec.setOutputFile(file.absolutePath)
            rec.setVideoEncoder(MediaRecorder.VideoEncoder.H264)
            rec.setVideoSize(width, height)
            rec.setVideoFrameRate(fps)
            rec.setVideoEncodingBitRate(bitRate)
            if (audio) {
                rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                rec.setAudioEncodingBitRate(128_000)
                rec.setAudioSamplingRate(44_100)
            }
            rec.setMaxDuration(maxMs)
            rec.setMaxFileSize(MAX_FILE_BYTES)
            rec.setOnInfoListener { _, what, _ ->
                when (what) {
                    MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED ->
                        handler.post { finish(discard = false, failCode = null) }
                    MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED ->
                        handler.post { finish(discard = false, failCode = "disk_full") }
                }
            }
            rec.setOnErrorListener { _, _, _ ->
                handler.post { finish(discard = false, failCode = "encoder_failed") }
            }
            rec.prepare()
            recorder = rec

            virtualDisplay = projection?.createVirtualDisplay(
                "EpocheyeCapture",
                width,
                height,
                dpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                rec.surface,
                null,
                handler,
            )
            rec.start()
            hasAudio = audio
            true
        } catch (t: Throwable) {
            Log.w(TAG, "recorder attempt failed (audio=$audio)", t)
            false
        }
    }

    /** Backstop behind the module's orientation lock. */
    private fun watchAsRotation() {
        val dm = getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager ?: return
        startRotation = dm.getDisplay(Display.DEFAULT_DISPLAY)?.rotation ?: -1
        val l = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) {}
            override fun onDisplayRemoved(displayId: Int) {}
            override fun onDisplayChanged(displayId: Int) {
                if (displayId != Display.DEFAULT_DISPLAY) return
                val now = dm.getDisplay(Display.DEFAULT_DISPLAY)?.rotation ?: return
                if (startRotation >= 0 && now != startRotation) {
                    handler.post {
                        finish(discard = false, failCode = "interrupted_rotation")
                    }
                }
            }
        }
        displayListener = l
        dm.registerDisplayListener(l, handler)
    }

    private fun releaseRecorderOnly() {
        try {
            virtualDisplay?.release()
        } catch (_: Throwable) {
        }
        virtualDisplay = null
        try {
            recorder?.reset()
            recorder?.release()
        } catch (_: Throwable) {
        }
        recorder = null
    }

    /**
     * The single terminal path. Order matters: stop frames arriving before
     * stopping the muxer, or the MP4 can end up unplayable.
     */
    private fun finish(discard: Boolean, failCode: String?) {
        if (stopping) return
        stopping = true

        watchdog?.let { handler.removeCallbacks(it) }
        watchdog = null

        try {
            displayListener?.let {
                (getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager)
                    ?.unregisterDisplayListener(it)
            }
        } catch (_: Throwable) {
        }
        displayListener = null

        try {
            virtualDisplay?.release()
        } catch (_: Throwable) {
        }
        virtualDisplay = null

        var tooShort = false
        try {
            recorder?.stop()
        } catch (t: Throwable) {
            // stop() throws when fewer than ~1 s of frames reached the encoder.
            Log.w(TAG, "recorder.stop threw — clip too short", t)
            tooShort = true
        }
        try {
            recorder?.reset()
            recorder?.release()
        } catch (_: Throwable) {
        }
        recorder = null

        try {
            projection?.unregisterCallback(projectionCallback)
            projection?.stop()
        } catch (_: Throwable) {
        }
        projection = null

        val file = outFile
        val duration = if (startedAtMs > 0) System.currentTimeMillis() - startedAtMs else 0L

        if (discard || tooShort) {
            try {
                file?.delete()
            } catch (_: Throwable) {
            }
            ScreenRecordBus.post(
                if (tooShort) {
                    RecState.Failed("too_short", null, null)
                } else {
                    RecState.Idle
                },
            )
        } else if (failCode != null) {
            ScreenRecordBus.post(RecState.Failed(failCode, null, file))
        } else if (file != null && file.exists() && file.length() > 0) {
            ScreenRecordBus.post(RecState.Finalizing(file, duration, hasAudio))
        } else {
            ScreenRecordBus.post(RecState.Failed("encoder_failed", "empty output", null))
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (_: Throwable) {
        }
        stopSelf()
    }

    private fun fail(code: String, message: String?) {
        ScreenRecordBus.post(RecState.Failed(code, message, null))
        finish(discard = true, failCode = null)
    }

    override fun onDestroy() {
        // Idempotent: guarantees no dangling projection even on a system kill.
        if (!stopping) {
            try {
                releaseRecorderOnly()
                projection?.unregisterCallback(projectionCallback)
                projection?.stop()
            } catch (_: Throwable) {
            }
            projection = null
        }
        try {
            thread.quitSafely()
        } catch (_: Throwable) {
        }
        super.onDestroy()
    }
}
