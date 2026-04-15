package com.epocheye.ar

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.lifecycle.ProcessLifecycleOwner
import com.google.ar.core.Config
import com.google.ar.core.TrackingState
import io.github.sceneview.ar.ARSceneView

/**
 * Live ARCore camera scene with an overlaid heritage info card.
 *
 * Uses SceneView's `ARSceneView` to drive the ARCore session (camera
 * feed + pose tracking). The Gemini identification is shown as a 2D
 * overlay rather than a 3D-anchored node — keeps the implementation
 * robust across SceneView minor versions and avoids the engine /
 * material / ViewNode plumbing which has churned between 2.x releases.
 *
 * All SceneView interactions are wrapped in try/catch. On any failure
 * we invoke [onARError] so the React Native side falls back to the 2D
 * IdentificationCard — the rest of the Lens flow keeps working.
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

    private var arSceneView: ARSceneView? = null
    private var overlayCard: LinearLayout? = null
    private var readyReported = false
    private var errorReported = false

    init {
        setupAR()
    }

    private fun setupAR() {
        try {
            val sceneView = ARSceneView(context).apply {
                layoutParams = LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                // Tie ARSceneView lifecycle to the app's process lifecycle
                // so pause/resume propagate automatically.
                sharedLifecycle = ProcessLifecycleOwner.get().lifecycle

                configureSession { _, config ->
                    config.depthMode = Config.DepthMode.DISABLED
                    config.instantPlacementMode = Config.InstantPlacementMode.LOCAL_Y_UP
                    config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
                    config.focusMode = Config.FocusMode.AUTO
                }

                onSessionUpdated = { _, frame ->
                    if (!readyReported && frame.camera.trackingState == TrackingState.TRACKING) {
                        readyReported = true
                        post { onARReady?.invoke() }
                    }
                }

                onTrackingFailureChanged = { reason ->
                    if (reason != null && !errorReported) {
                        errorReported = true
                        post { onARError?.invoke(reason.name) }
                    }
                }
            }

            addView(sceneView)
            arSceneView = sceneView

            addOverlayCard()
        } catch (e: Throwable) {
            Log.e(TAG, "AR setup failed", e)
            post { onARError?.invoke(e.message ?: "AR setup failed") }
        }
    }

    @SuppressLint("SetTextI18n")
    private fun addOverlayCard() {
        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(16))

            background = GradientDrawable().apply {
                cornerRadius = dp(20).toFloat()
                setColor(Color.argb(235, 20, 20, 20))
                setStroke(dp(1), Color.argb(110, 201, 168, 76))
            }

            val lp = LayoutParams(dp(280), ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
                bottomMargin = dp(40)
            }
            layoutParams = lp
            isClickable = true
            setOnClickListener { onCardTapped?.invoke() }

            addView(TextView(context).apply {
                text = "AR Preview".uppercase()
                setTextColor(Color.parseColor("#C9A84C"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                letterSpacing = 0.12f
            })

            identificationName?.takeIf { it.isNotBlank() }?.let {
                addView(TextView(context).apply {
                    text = it
                    setTextColor(Color.parseColor("#F5F0E8"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
                    setPadding(0, dp(4), 0, 0)
                })
            }

            identificationPeriod?.takeIf { it.isNotBlank() }?.let {
                addView(TextView(context).apply {
                    text = it
                    setTextColor(Color.parseColor("#B8AF9E"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                })
            }

            identificationFact?.takeIf { it.isNotBlank() }?.let {
                addView(TextView(context).apply {
                    text = it
                    setTextColor(Color.parseColor("#D4C5A0"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    setPadding(0, dp(8), 0, 0)
                    maxLines = 4
                })
            }
        }

        overlayCard = card
        addView(card)
    }

    fun updateIdentification() {
        overlayCard?.let { removeView(it) }
        overlayCard = null
        addOverlayCard()
    }

    fun setArEnabled(enabled: Boolean) {
        arSceneView?.visibility = if (enabled) VISIBLE else GONE
    }

    fun cleanup() {
        try {
            arSceneView?.destroy()
        } catch (t: Throwable) {
            Log.w(TAG, "destroy failed", t)
        }
        arSceneView = null
        overlayCard = null
    }

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cleanup()
    }

    companion object {
        private const val TAG = "EpocheyeARView"
    }
}
