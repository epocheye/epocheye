package com.epocheye.ar

import android.content.Context
import android.widget.FrameLayout

/**
 * Custom FrameLayout wrapping AR functionality.
 *
 * AR scene rendering is currently disabled while the SceneView
 * integration is being updated. The React Native JS side falls back
 * to the 2D IdentificationCard when AR is unavailable.
 */
class EpocheyeARView(context: Context) : FrameLayout(context) {

    // Identification data (set via React Native props)
    var identificationName: String? = null
    var identificationPeriod: String? = null
    var identificationSignificance: String? = null
    var identificationFact: String? = null

    // Callbacks
    var onARReady: (() -> Unit)? = null
    var onCardTapped: (() -> Unit)? = null
    var onARError: ((String) -> Unit)? = null

    init {
        // AR scene is not initialised — signal error so JS falls back to 2D card
        post { onARError?.invoke("AR view is not yet available") }
    }

    fun updateIdentification() {
        // No-op while AR is disabled
    }

    fun setArEnabled(enabled: Boolean) {
        // No-op while AR is disabled
    }

    fun cleanup() {
        // Nothing to clean up
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cleanup()
    }
}
