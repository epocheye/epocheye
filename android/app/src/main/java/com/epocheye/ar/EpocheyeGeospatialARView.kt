package com.epocheye.ar

import android.content.Context
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.lifecycle.ProcessLifecycleOwner
import com.google.ar.core.Anchor
import com.google.ar.core.Config
import com.google.ar.core.Earth
import com.google.ar.core.TrackingState
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.node.ModelNode
import org.json.JSONArray

/**
 * Geospatial AR scene that places curated GLB models at known geo positions.
 *
 * v1 scaffold — needs on-site field testing. SceneView 2.x has had API churn
 * around ModelLoader / ModelNode signatures, so the hot paths here are
 * defensively wrapped in try/catch and emit `onARError` on failure rather
 * than crashing the host activity. Anchor placement is per-object: a
 * single failed model download/parse won't kill the whole site bundle.
 *
 * Activation requires Google Cloud "ARCore API" enabled on the Maps API
 * key already declared in AndroidManifest.xml. Coverage is uneven across
 * heritage sites — when [Earth.getEarthState] never reaches ENABLED, the
 * caller is expected to swap to the 2D compass-relative fallback flow.
 *
 * Anchor input is a JSON string set via [setAnchorsJson] from the React
 * Native side. Each entry must include:
 *   - label:       display key (used to dedupe placement calls)
 *   - glb_uri:     file:// URI (pre-cached on-device GLB) or https:// fallback
 *   - lat, lng:    decimal degrees
 *   - altitude:    meters above WGS-84 ellipsoid; if null we use the camera's
 *                  current geospatial altitude (object floats with viewer)
 *   - heading_deg: yaw rotation, 0 = north, clockwise
 */
class EpocheyeGeospatialARView(context: Context) : FrameLayout(context) {

    var anchorsJson: String? = null
    var onARReady: (() -> Unit)? = null
    var onAnchorPlaced: ((String) -> Unit)? = null
    var onARError: ((String) -> Unit)? = null
    var onEarthState: ((String) -> Unit)? = null
    /**
     * Fires when the JS side requests the current geospatial pose via the
     * `requestPoseSnapshot` view command. Args: lat, lng, altitude, headingDeg.
     * Used to attach a hit_test_pose to /api/v1/ar/recognize so backend can
     * persist a runtime anchor at the user's current location.
     */
    var onGeospatialPose: ((Double, Double, Double, Double) -> Unit)? = null

    private var arSceneView: ARSceneView? = null
    private val placedLabels = mutableSetOf<String>()
    private var earthReady = false
    private var readyReported = false

    init {
        setupAR()
    }

    private fun setupAR() {
        try {
            val sceneView = ARSceneView(
                context = context,
                sharedLifecycle = ProcessLifecycleOwner.get().lifecycle,
            ).apply {
                layoutParams = LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )

                configureSession { _, config ->
                    // Geospatial mode requires Google Cloud "ARCore API" enabled
                    // for the project that owns the Maps API key.
                    config.geospatialMode = Config.GeospatialMode.ENABLED
                    config.depthMode = Config.DepthMode.DISABLED
                    config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
                    config.focusMode = Config.FocusMode.AUTO
                }

                onSessionUpdated = { session, _ ->
                    handleSessionUpdate(session.earth)
                }

                onTrackingFailureChanged = { reason ->
                    if (reason != null) {
                        post { onARError?.invoke(reason.name) }
                    }
                }
            }
            addView(sceneView)
            arSceneView = sceneView
        } catch (e: Throwable) {
            Log.e(TAG, "geospatial setup failed", e)
            post { onARError?.invoke(e.message ?: "geospatial setup failed") }
        }
    }

    private fun handleSessionUpdate(earth: Earth?) {
        if (earth == null) {
            return
        }
        val state = try {
            earth.earthState?.name ?: "UNKNOWN"
        } catch (t: Throwable) {
            "ERROR"
        }

        val tracking = try {
            earth.trackingState == TrackingState.TRACKING
        } catch (t: Throwable) {
            false
        }

        if (!tracking) {
            if (earthReady) {
                earthReady = false
                post { onEarthState?.invoke("LOST:$state") }
            }
            return
        }

        if (!earthReady) {
            earthReady = true
            post { onEarthState?.invoke("TRACKING") }
        }

        if (!readyReported) {
            readyReported = true
            post { onARReady?.invoke() }
        }

        placePendingAnchors(earth)
    }

    fun setAnchorsJson(json: String?) {
        anchorsJson = json
        // Clear placement bookkeeping so updated anchors get re-placed even
        // if their label matches an earlier anchor.
        placedLabels.clear()
        if (earthReady) {
            arSceneView?.session?.earth?.let { placePendingAnchors(it) }
        }
    }

    /**
     * Snapshot the current ARCore Geospatial pose and emit it via
     * onGeospatialPose. Used as a stand-in for a true raycast HitTest in v1
     * — mobile attaches the result to /api/v1/ar/recognize as `hit_test_pose`
     * so the backend can persist a runtime anchor at the user's location.
     *
     * No-ops silently when Earth tracking isn't ready (caller must check
     * onEarthState first).
     */
    fun requestPoseSnapshot() {
        val earth = arSceneView?.session?.earth ?: return
        if (earth.trackingState != TrackingState.TRACKING) return
        val pose = try {
            earth.cameraGeospatialPose
        } catch (t: Throwable) {
            Log.w(TAG, "pose snapshot failed: ${t.message}")
            return
        }
        post {
            onGeospatialPose?.invoke(
                pose.latitude,
                pose.longitude,
                pose.altitude,
                pose.heading,
            )
        }
    }

    /**
     * Append a single runtime anchor (used by the place_strategy='pose_fallback'
     * branch on the JS side). Same shape as setAnchorsJson entries; placed
     * immediately if Earth is tracking, otherwise queued via the standard
     * pending-anchors loop.
     */
    fun addRuntimeAnchor(jsonEntry: String?) {
        if (jsonEntry.isNullOrBlank()) return
        val merged = JSONArray()
        try {
            anchorsJson?.let { existing ->
                val existingArr = JSONArray(existing)
                for (i in 0 until existingArr.length()) {
                    merged.put(existingArr.get(i))
                }
            }
            merged.put(org.json.JSONObject(jsonEntry))
        } catch (t: Throwable) {
            post { onARError?.invoke("addRuntimeAnchor: ${t.message}") }
            return
        }
        anchorsJson = merged.toString()
        if (earthReady) {
            arSceneView?.session?.earth?.let { placePendingAnchors(it) }
        }
    }

    private fun placePendingAnchors(earth: Earth) {
        val json = anchorsJson ?: return
        val sceneView = arSceneView ?: return
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val entry = arr.optJSONObject(i) ?: continue
                val label = entry.optString("label").ifBlank { continue }
                if (label in placedLabels) continue
                val glbUri = entry.optString("glb_uri").ifBlank { continue }

                val lat = entry.optDouble("lat", Double.NaN)
                val lng = entry.optDouble("lng", Double.NaN)
                if (lat.isNaN() || lng.isNaN()) continue

                val altitudeOpt = entry.optDouble("altitude", Double.NaN)
                val altitude = if (altitudeOpt.isNaN()) {
                    try {
                        earth.cameraGeospatialPose.altitude
                    } catch (t: Throwable) {
                        0.0
                    }
                } else {
                    altitudeOpt
                }
                val heading = entry.optDouble("heading_deg", 0.0)
                val q = headingToQuaternion(heading)

                val anchor = try {
                    earth.createAnchor(lat, lng, altitude, q[0], q[1], q[2], q[3])
                } catch (t: Throwable) {
                    Log.w(TAG, "createAnchor failed for $label", t)
                    continue
                }

                placedLabels += label
                attachModel(sceneView, anchor, glbUri, label)
            }
        } catch (e: Throwable) {
            Log.e(TAG, "placePendingAnchors failed", e)
            post { onARError?.invoke(e.message ?: "anchor placement failed") }
        }
    }

    private fun attachModel(
        sceneView: ARSceneView,
        anchor: Anchor,
        glbUri: String,
        label: String,
    ) {
        val anchorNode = try {
            AnchorNode(sceneView.engine, anchor).also { sceneView.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "anchor node create failed for $label", t)
            return
        }

        // Async model load. SceneView's modelLoader exposes both a coroutine
        // and a callback API across 2.x; we use the suspended one indirectly
        // via launchScope to avoid hard-coding either signature.
        try {
            sceneView.lifecycleScope.launchWhenCreated {
                val modelInstance = try {
                    sceneView.modelLoader.loadModelInstance(Uri.parse(glbUri).toString())
                } catch (t: Throwable) {
                    Log.e(TAG, "loadModelInstance failed for $label", t)
                    null
                }
                if (modelInstance == null) {
                    post { onARError?.invoke("model load failed: $label") }
                    return@launchWhenCreated
                }
                try {
                    val modelNode = ModelNode(
                        modelInstance = modelInstance,
                        scaleToUnits = 1f,
                    )
                    anchorNode.addChildNode(modelNode)
                    post { onAnchorPlaced?.invoke(label) }
                } catch (t: Throwable) {
                    Log.e(TAG, "model node attach failed for $label", t)
                    post { onARError?.invoke("model attach failed: $label") }
                }
            }
        } catch (t: Throwable) {
            Log.e(TAG, "lifecycle launch failed for $label", t)
        }
    }

    private fun headingToQuaternion(headingDeg: Double): FloatArray {
        val rad = Math.toRadians(headingDeg)
        val half = rad / 2.0
        val s = Math.sin(half).toFloat()
        val c = Math.cos(half).toFloat()
        // Yaw about the +Y (up) axis: q = (0, sin(θ/2), 0, cos(θ/2))
        return floatArrayOf(0f, s, 0f, c)
    }

    fun cleanup() {
        try {
            arSceneView?.destroy()
        } catch (t: Throwable) {
            Log.w(TAG, "destroy failed", t)
        }
        arSceneView = null
        placedLabels.clear()
        earthReady = false
        readyReported = false
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cleanup()
    }

    companion object {
        private const val TAG = "EpocheyeGeoARView"
    }
}
