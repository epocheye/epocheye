package com.epocheye.ar

import android.content.Context
import android.widget.FrameLayout
import com.google.ar.core.Config
import com.google.ar.core.Plane
import com.google.ar.core.TrackingState
import io.github.sceneview.ar.ArSceneView

/**
 * Custom FrameLayout wrapping an ArSceneView.
 *
 * Manages the ARCore session lifecycle, plane detection, and placement
 * of InfoCardNode instances. Exposed to React Native via EpocheyeARViewManager.
 */
class EpocheyeARView(context: Context) : FrameLayout(context) {

    private var arSceneView: ArSceneView? = null
    private var currentCard: InfoCardNode? = null
    private var arEnabled = false

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
        setupArSceneView()
    }

    private fun setupArSceneView() {
        if (!ARCoreUtils.isAvailable(context)) {
            onARError?.invoke("ARCore not available on this device")
            return
        }

        try {
            val sceneView = ArSceneView(context).apply {
                // Configure ARCore session
                configureSession { _, config ->
                    config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                    config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
                    config.depthMode = Config.DepthMode.DISABLED
                    config.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                }

                // Listen for session updates to detect planes
                onSessionUpdated = { _, frame ->
                    val planes = frame.getUpdatedTrackables(Plane::class.java)
                    for (plane in planes) {
                        if (plane.trackingState == TrackingState.TRACKING) {
                            tryPlaceCard(plane)
                        }
                    }
                }
            }

            arSceneView = sceneView
            addView(sceneView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

            onARReady?.invoke()
        } catch (e: Exception) {
            onARError?.invoke("Failed to initialize ARCore: ${e.message}")
        }
    }

    /**
     * Place or update the info card on the first suitable detected plane.
     * Only places once per identification result.
     */
    private fun tryPlaceCard(plane: Plane) {
        if (currentCard != null) return
        val name = identificationName ?: return
        if (name.isEmpty()) return

        val sceneView = arSceneView ?: return

        try {
            // Create an anchor at the center of the detected plane
            val pose = plane.centerPose
            val session = sceneView.session ?: return
            val anchor = session.createAnchor(pose)

            val card = InfoCardNode(
                context = context,
                anchor = anchor,
                name = name,
                period = identificationPeriod ?: "",
                significance = identificationSignificance ?: "",
                fact = identificationFact ?: "",
                onTap = { onCardTapped?.invoke() },
                autoDismissMs = 8000L,
            )

            sceneView.addChildNode(card)
            currentCard = card
        } catch (e: Exception) {
            onARError?.invoke("Failed to place AR card: ${e.message}")
        }
    }

    /**
     * Called when identification data changes from React Native props.
     * Clears the existing card so a new one can be placed.
     */
    fun updateIdentification() {
        currentCard?.dismiss()
        currentCard = null
    }

    fun setArEnabled(enabled: Boolean) {
        arEnabled = enabled
        if (enabled) {
            arSceneView?.resume()
        } else {
            arSceneView?.pause()
        }
    }

    fun cleanup() {
        currentCard?.dismiss()
        currentCard = null
        arSceneView?.destroy()
        arSceneView = null
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cleanup()
    }
}
