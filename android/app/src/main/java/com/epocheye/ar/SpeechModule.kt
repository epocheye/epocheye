package com.epocheye.ar

import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

/**
 * Gives the figures in the magic window a voice, using Android's OWN
 * TextToSpeech engine.
 *
 * WHY THIS RATHER THAN A LIBRARY. The obvious route is an npm TTS package, but
 * that means a new native dependency, a gradle change and an autolinking pass on
 * a build that currently works — and `android.speech.tts.TextToSpeech` has been
 * in the platform since API 4. This is about seventy lines and adds nothing to
 * the dependency graph.
 *
 * WHY NOT PRE-RENDERED AUDIO FILES. Because the words are still moving. Every
 * line a figure speaks carries an evidence tier and a source, and those lines get
 * corrected as the research does — Tipu's third line exists only because the
 * record showed he was NOT at Bangalore when it fell. Recorded audio would have
 * to be re-cut on every such correction, and the version on the CDN would quietly
 * drift out of step with the version in the code. Synthesis reads whatever the
 * evidence currently says.
 *
 * Language defaults to en-IN. The subject is Indian, the audience is in
 * Bengaluru, and en-US mispronounces nearly every name in the script.
 */
class SpeechModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val EVENT = "EpocheyeSpeech"
    }

    private var tts: TextToSpeech? = null

    @Volatile
    private var ready = false

    override fun getName() = "EpocheyeSpeech"

    private fun emit(state: String, id: String?) {
        val map = Arguments.createMap().apply {
            putString("state", state)
            putString("utteranceId", id)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT, map)
    }

    /**
     * Prepare the engine. Resolves with whether a usable voice exists, so the
     * screen can hide its speaker control rather than offer a button that will
     * silently do nothing — some devices ship with no TTS data installed at all.
     */
    @ReactMethod
    fun prepare(promise: Promise) {
        if (ready) {
            promise.resolve(true)
            return
        }
        try {
            tts = TextToSpeech(reactContext.applicationContext) { status ->
                val ok = status == TextToSpeech.SUCCESS
                if (ok) {
                    val engine = tts
                    // en-IN first; fall back rather than fail, since a wrong
                    // accent is far better than silence.
                    val langs = listOf(
                        Locale("en", "IN"), Locale.UK, Locale.US, Locale.ENGLISH,
                    )
                    var applied = false
                    for (l in langs) {
                        val r = engine?.setLanguage(l)
                        if (r != TextToSpeech.LANG_MISSING_DATA &&
                            r != TextToSpeech.LANG_NOT_SUPPORTED
                        ) {
                            applied = true
                            break
                        }
                    }
                    // A measured pace: this is a guide speaking, not a
                    // notification being read out.
                    engine?.setSpeechRate(0.92f)
                    engine?.setPitch(0.96f)
                    engine?.setOnUtteranceProgressListener(
                        object : UtteranceProgressListener() {
                            override fun onStart(utteranceId: String?) =
                                emit("start", utteranceId)

                            override fun onDone(utteranceId: String?) =
                                emit("done", utteranceId)

                            @Deprecated("required by the base class")
                            override fun onError(utteranceId: String?) =
                                emit("error", utteranceId)
                        },
                    )
                    ready = applied
                    promise.resolve(applied)
                } else {
                    ready = false
                    promise.resolve(false)
                }
            }
        } catch (t: Throwable) {
            ready = false
            promise.resolve(false)
        }
    }

    /** Speak `text`, interrupting anything already being said. */
    @ReactMethod
    fun speak(text: String?, options: ReadableMap?) {
        val engine = tts ?: return
        if (!ready || text.isNullOrBlank()) return
        val id = options?.let {
            if (it.hasKey("utteranceId")) it.getString("utteranceId") else null
        } ?: "mw"
        try {
            // QUEUE_FLUSH: tapping the next line should cut the current one off,
            // not stack behind it.
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
        } catch (_: Throwable) {
        }
    }

    @ReactMethod
    fun stop() {
        try {
            tts?.stop()
        } catch (_: Throwable) {
        }
    }

    // Required no-ops so a NativeEventEmitter over this module does not warn.
    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    override fun invalidate() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Throwable) {
        }
        tts = null
        ready = false
        super.invalidate()
    }
}
