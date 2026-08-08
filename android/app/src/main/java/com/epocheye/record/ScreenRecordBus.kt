package com.epocheye.record

import android.os.Handler
import android.os.Looper
import java.io.File

/**
 * State handoff between [ScreenRecordModule] (which owns the JS bridge) and
 * [ScreenRecordService] (which owns the projection).
 *
 * A plain object is legitimate here because the service declares no
 * `android:process`, so both live in the same process. That avoids a Binder
 * interface or the deprecated LocalBroadcastManager for what is genuinely just
 * a shared variable plus a callback.
 */
sealed class RecState {
    object Idle : RecState()
    object Preparing : RecState()
    data class Recording(val startedAtMs: Long, val hasAudio: Boolean) : RecState()
    data class Finalizing(
        val file: File,
        val durationMs: Long,
        val hasAudio: Boolean,
        /** Set when the clip is usable but something went wrong on the way. */
        val degraded: String? = null,
    ) : RecState()

    data class Failed(
        val code: String,
        val message: String?,
        /** A partial but valid MP4, when one survived. */
        val partial: File?,
    ) : RecState()
}

object ScreenRecordBus {
    private val main = Handler(Looper.getMainLooper())

    @Volatile
    var state: RecState = RecState.Idle
        private set

    /** Set by the module; MUST be nulled in its invalidate() (it holds a context). */
    @Volatile
    var listener: ((RecState) -> Unit)? = null

    fun post(next: RecState) {
        state = next
        val l = listener ?: return
        main.post { l(next) }
    }

    fun reset() {
        state = RecState.Idle
    }
}
