package com.epocheye.ar

import android.content.Context
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.filament.Engine
import com.google.ar.core.Anchor
import com.google.ar.core.Config
import com.google.ar.core.Earth
import com.google.ar.core.Frame
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.loaders.ModelLoader
import io.github.sceneview.node.ModelNode
import io.github.sceneview.node.Node as SvNode
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberModelLoader
import org.json.JSONArray

/**
 * Geospatial AR scene that places curated GLB models at known geo positions.
 *
 * v1 scaffold — needs on-site field testing. Hot paths are defensively wrapped in
 * try/catch and emit `onARError` on failure rather than crashing the host activity.
 * Anchor placement is per-object: a single failed model download/parse won't kill
 * the whole site bundle.
 *
 * SceneView 4.18.0's AR surface is the Jetpack Compose `ARSceneView`; it is hosted
 * in a [ComposeView] and driven imperatively (a captured root node holds the placed
 * anchor nodes + captured Engine / ModelLoader / Session / Frame). The RN bridge
 * (props, commands, events) is unchanged.
 *
 * Activation requires Google Cloud "ARCore API" enabled on the Maps API key
 * already declared in AndroidManifest.xml. Coverage is uneven across heritage
 * sites — when [Earth.getEarthState] never reaches ENABLED, the caller is expected
 * to swap to the 2D compass-relative fallback flow.
 *
 * Anchor input is a JSON string set via [setAnchorsJson]. Each entry must include:
 *   - label:       display key (used to dedupe placement calls)
 *   - glb_uri:     file:// URI (pre-cached on-device GLB) or https:// fallback
 *   - lat, lng:    decimal degrees
 *   - altitude:    meters above WGS-84 ellipsoid; if null we use the camera's
 *                  current geospatial altitude (object floats with viewer)
 *   - heading_deg: yaw rotation, 0 = north, clockwise
 */
class EpocheyeGeospatialARView(context: Context) : FrameLayout(context) {

    private var anchorsJson: String? = null
    var onARReady: (() -> Unit)? = null
    var onAnchorPlaced: ((String) -> Unit)? = null
    var onARError: ((String) -> Unit)? = null
    var onEarthState: ((String) -> Unit)? = null
    /**
     * Fires when the JS side requests the current geospatial pose via the
     * `requestPoseSnapshot` view command. Args: lat, lng, altitude, headingDeg.
     */
    var onGeospatialPose: ((Double, Double, Double, Double) -> Unit)? = null

    /**
     * Fires when JS dispatches `performHitTest`. `ok=true` carries a real
     * plane-intersection pose; `ok=false` means no plane was detected and the
     * caller should fall through to pose_fallback.
     */
    var onHitTestResult: ((Boolean, Double, Double, Double, Double) -> Unit)? = null

    // ── Compose-hosted scene ─────────────────────────────────────────────────
    // A root node captured from the ARSceneView content DSL; placed anchor nodes
    // are attached as its children (see EpocheyeDetectARView for the rationale).
    @Volatile private var sceneRoot: SvNode? = null
    private var composeView: ComposeView? = null
    @Volatile private var engine: Engine? = null
    @Volatile private var modelLoader: ModelLoader? = null
    @Volatile private var arSession: Session? = null
    @Volatile private var arFrame: Frame? = null

    private val placedLabels = mutableSetOf<String>()
    private var earthReady = false
    private var readyReported = false

    // ARSceneView (composable) is created in onAttachedToWindow, not here: the
    // ComposeView needs a ViewTreeLifecycleOwner (resolved once attached to the
    // Activity window) to drive the AR session lifecycle.

    private fun setupAR() {
        try {
            val hostContext: Context =
                (context as? ThemedReactContext)?.currentActivity ?: context

            val view = ComposeView(hostContext).apply {
                layoutParams = LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                setViewCompositionStrategy(
                    ViewCompositionStrategy.DisposeOnDetachedFromWindow,
                )
                setContent {
                    val eng = rememberEngine()
                    val ml = rememberModelLoader(eng)
                    SideEffect {
                        engine = eng
                        modelLoader = ml
                    }
                    io.github.sceneview.ar.ARSceneView(
                        modifier = Modifier.fillMaxSize(),
                        engine = eng,
                        modelLoader = ml,
                        // Hide SceneView's dotted plane-visualization grid.
                        planeRenderer = false,
                        sessionConfiguration = { _, config ->
                            // Geospatial mode requires Google Cloud "ARCore API"
                            // enabled for the project that owns the Maps API key.
                            config.geospatialMode = Config.GeospatialMode.ENABLED
                            config.depthMode = Config.DepthMode.DISABLED
                            config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
                            config.focusMode = Config.FocusMode.AUTO
                        },
                        onSessionCreated = { session ->
                            arSession = session
                        },
                        onSessionUpdated = { session, frame ->
                            arSession = session
                            arFrame = frame
                            handleSessionUpdate(session.earth)
                        },
                        onTrackingFailureChanged = { reason ->
                            if (reason != null) {
                                post { onARError?.invoke(reason.name) }
                            }
                        },
                    ) {
                        // Scene-attached root; placed anchor nodes hang off it.
                        Node(apply = { sceneRoot = this })
                    }
                }
            }
            addView(view)
            composeView = view
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
            arSession?.earth?.let { placePendingAnchors(it) }
        }
    }

    /**
     * Snapshot the current ARCore Geospatial pose and emit it via
     * onGeospatialPose. No-ops silently when Earth tracking isn't ready (caller
     * must check onEarthState first).
     */
    fun requestPoseSnapshot() {
        val earth = arSession?.earth ?: return
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
     * Performs an ARCore plane HitTest at the given screen coordinates and
     * resolves the hit's world pose into a Geospatial pose (lat/lng/alt +
     * heading). Emits onHitTestResult with `ok=false` if no plane was hit
     * (caller should fall back to pose_fallback).
     */
    fun performHitTest(screenX: Float, screenY: Float) {
        val session = arSession
        val frame = arFrame
        val earth = session?.earth
        if (frame == null || earth == null || earth.trackingState != TrackingState.TRACKING) {
            post { onHitTestResult?.invoke(false, 0.0, 0.0, 0.0, 0.0) }
            return
        }

        val hits = try {
            frame.hitTest(screenX, screenY)
        } catch (t: Throwable) {
            Log.w(TAG, "hitTest failed: ${t.message}")
            null
        }
        val hit = hits?.firstOrNull()
        if (hit == null) {
            post { onHitTestResult?.invoke(false, 0.0, 0.0, 0.0, 0.0) }
            return
        }

        val pose = try {
            earth.getGeospatialPose(hit.hitPose)
        } catch (t: Throwable) {
            Log.w(TAG, "getGeospatialPose failed: ${t.message}")
            null
        }
        if (pose == null) {
            post { onHitTestResult?.invoke(false, 0.0, 0.0, 0.0, 0.0) }
            return
        }

        post {
            onHitTestResult?.invoke(
                true,
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
            arSession?.earth?.let { placePendingAnchors(it) }
        }
    }

    private fun placePendingAnchors(earth: Earth) {
        val json = anchorsJson ?: return
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val entry = arr.optJSONObject(i) ?: continue
                val label = entry.optString("label")
                if (label.isBlank() || label in placedLabels) continue
                val glbUri = entry.optString("glb_uri")
                if (glbUri.isBlank()) continue

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
                attachModel(anchor, glbUri, label)
            }
        } catch (e: Throwable) {
            Log.e(TAG, "placePendingAnchors failed", e)
            post { onARError?.invoke(e.message ?: "anchor placement failed") }
        }
    }

    private fun attachModel(anchor: Anchor, glbUri: String, label: String) {
        val eng = engine ?: return
        val loader = modelLoader ?: return
        val anchorNode = try {
            AnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "anchor node create failed for $label", t)
            return
        }

        try {
            loader.loadModelInstanceAsync(
                Uri.parse(glbUri).toString(),
                { it },
            ) { modelInstance ->
                if (modelInstance == null) {
                    post { onARError?.invoke("model load failed: $label") }
                    return@loadModelInstanceAsync
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
            Log.e(TAG, "model load dispatch failed for $label", t)
            post { onARError?.invoke("model load dispatch failed: $label") }
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
        composeView?.let { removeView(it) }
        composeView = null
        engine = null
        modelLoader = null
        arSession = null
        arFrame = null
        placedLabels.clear()
        earthReady = false
        readyReported = false
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (composeView == null) setupAR()
    }

    // React Native swallows requestLayout() on the native view tree, so the
    // embedded AR SurfaceView never re-runs updateSurface() when its surface is
    // created → it renders to an unpresented surface → black screen. Force a real
    // measure + layout pass to apply the SurfaceView's geometry.
    private val measureAndLayout = Runnable {
        measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
        )
        layout(left, top, right, bottom)
    }

    override fun requestLayout() {
        super.requestLayout()
        post(measureAndLayout)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cleanup()
    }

    companion object {
        private const val TAG = "EpocheyeGeoARView"
    }
}
