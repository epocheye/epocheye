package com.epocheye.ar

import android.content.Context
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.lifecycle.ProcessLifecycleOwner
import com.google.ar.core.Anchor
import com.google.ar.core.Config
import com.google.ar.core.Plane
import com.google.ar.core.TrackingState
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.node.ModelNode

/**
 * Plane-detection AR view for lab/indoor testing.
 *
 * Companion to [EpocheyeGeospatialARView] — the same SceneView base, but
 * with Geospatial DISABLED and plane finding enabled. Workflow:
 *
 *   1. Mount the view with a `glbUri` prop.
 *   2. Wait for [onPlaneDetected] — at that point the user can tap.
 *   3. JS dispatches the `performHitTest` view command with screen
 *      coordinates of the tap. We ray-cast onto detected planes.
 *   4. On a successful hit, we anchor a [ModelNode] holding the GLB at
 *      the hit pose and emit [onAnchorPlaced]. Any previous anchor is
 *      removed so subsequent taps re-place the model.
 *
 * No Geospatial / Earth involvement. Works indoors. Same defensive
 * try/catch wrapping the SceneView 2.x hot paths as
 * [EpocheyeGeospatialARView] — SceneView's API has churn between minor
 * versions and we want any failure to surface as `onARError` rather
 * than killing the host activity.
 */
class EpocheyePlaneARView(context: Context) : FrameLayout(context) {

    // Set via React Native prop. Changing it after a model is placed
    // re-loads the new model in the same anchor.
    private var glbUri: String? = null

    var onARReady: (() -> Unit)? = null
    var onPlaneDetected: (() -> Unit)? = null
    var onAnchorPlaced: ((String) -> Unit)? = null
    var onARError: ((String) -> Unit)? = null

    private var arSceneView: ARSceneView? = null
    private var currentAnchorNode: AnchorNode? = null
    private var readyReported = false
    private var planeReported = false

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
                    // Plane-detection only. No Geospatial, so this works
                    // indoors with zero VPS coverage.
                    config.geospatialMode = Config.GeospatialMode.DISABLED
                    config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                    config.depthMode = Config.DepthMode.DISABLED
                    config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
                    config.focusMode = Config.FocusMode.AUTO
                    config.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                }

                onSessionUpdated = { session, _ ->
                    if (!readyReported) {
                        readyReported = true
                        post { onARReady?.invoke() }
                    }
                    if (!planeReported && hasTrackedPlane(session)) {
                        planeReported = true
                        post { onPlaneDetected?.invoke() }
                    }
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
            Log.e(TAG, "plane AR setup failed", e)
            post { onARError?.invoke(e.message ?: "plane AR setup failed") }
        }
    }

    private fun hasTrackedPlane(session: com.google.ar.core.Session): Boolean {
        return try {
            session.getAllTrackables(Plane::class.java).any {
                it.trackingState == TrackingState.TRACKING
            }
        } catch (_: Throwable) {
            false
        }
    }

    fun setGlbUri(uri: String?) {
        glbUri = uri?.takeIf { it.isNotBlank() }
        // If a model is already anchored and the URI changes, reload
        // into the same pose.
        currentAnchorNode?.let { node ->
            val sceneView = arSceneView ?: return
            val uriStr = glbUri ?: return
            // Drop existing child nodes (the old model).
            try {
                val children = node.childNodes.toList()
                for (child in children) {
                    node.removeChildNode(child)
                }
            } catch (t: Throwable) {
                Log.w(TAG, "removeChildNode failed", t)
            }
            attachModel(sceneView, node, uriStr, label = "plane_test")
        }
    }

    /**
     * Ray-cast at screen coordinates. On a successful plane hit, anchor
     * the GLB at the hit pose; any previously placed model is removed
     * first so the latest tap wins.
     *
     * No-ops with an `onARError` event when the URI is missing, when
     * the session isn't ready yet, or when no plane was hit.
     */
    fun performHitTest(screenX: Float, screenY: Float) {
        val uri = glbUri
        if (uri.isNullOrBlank()) {
            post { onARError?.invoke("glbUri not set") }
            return
        }
        val sceneView = arSceneView
        val frame = try {
            sceneView?.frame
        } catch (t: Throwable) {
            null
        }
        if (sceneView == null || frame == null) {
            post { onARError?.invoke("AR session not ready") }
            return
        }

        val hits = try {
            frame.hitTest(screenX, screenY)
        } catch (t: Throwable) {
            Log.w(TAG, "hitTest failed: ${t.message}")
            null
        }
        // Prefer the first hit whose trackable is a Plane and whose hit
        // pose lies inside the plane polygon — that's the canonical
        // "user tapped a real surface" predicate.
        val hit = hits?.firstOrNull { result ->
            val tr = result.trackable
            tr is Plane &&
                tr.trackingState == TrackingState.TRACKING &&
                tr.isPoseInPolygon(result.hitPose)
        }
        if (hit == null) {
            post { onARError?.invoke("no plane at tap — point at a flat surface") }
            return
        }

        val anchor = try {
            hit.createAnchor()
        } catch (t: Throwable) {
            Log.w(TAG, "createAnchor failed", t)
            post { onARError?.invoke("anchor creation failed") }
            return
        }

        // Replace any existing anchor.
        clearCurrentAnchor()

        val anchorNode = try {
            AnchorNode(sceneView.engine, anchor).also { sceneView.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "anchor node create failed", t)
            post { onARError?.invoke("anchor node create failed") }
            return
        }
        currentAnchorNode = anchorNode
        attachModel(sceneView, anchorNode, uri, label = "plane_test")
    }

    fun clearAnchor() {
        clearCurrentAnchor()
    }

    private fun clearCurrentAnchor() {
        val sceneView = arSceneView ?: return
        val node = currentAnchorNode ?: return
        try {
            sceneView.removeChildNode(node)
        } catch (t: Throwable) {
            Log.w(TAG, "removeChildNode failed", t)
        }
        try {
            node.anchor.detach()
        } catch (t: Throwable) {
            Log.w(TAG, "anchor.detach failed", t)
        }
        currentAnchorNode = null
    }

    private fun attachModel(
        sceneView: ARSceneView,
        anchorNode: AnchorNode,
        glbUri: String,
        label: String,
    ) {
        try {
            sceneView.modelLoader.loadModelInstanceAsync(
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
                        // 0.5 is a sensible default for "place a model on the floor"
                        // since the Khronos Duck and most heritage GLBs ship at
                        // unit scale. Once we author Konark this becomes per-model.
                        scaleToUnits = 0.5f,
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

    fun cleanup() {
        clearCurrentAnchor()
        try {
            arSceneView?.destroy()
        } catch (t: Throwable) {
            Log.w(TAG, "destroy failed", t)
        }
        arSceneView = null
        readyReported = false
        planeReported = false
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cleanup()
    }

    companion object {
        private const val TAG = "EpocheyePlaneARView"
    }
}
