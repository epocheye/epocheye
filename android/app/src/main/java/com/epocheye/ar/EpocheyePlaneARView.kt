package com.epocheye.ar

import android.content.Context
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
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
import java.io.ByteArrayOutputStream
import java.io.File

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
    // Museum mode: a captured camera frame (file:// uri) for Gemini identify.
    var onFrameCaptured: ((String) -> Unit)? = null
    // Museum mode: the current anchor's projected screen position (dp) each frame.
    var onAnchorScreenPos: ((Float, Float, Boolean) -> Unit)? = null

    private var arSceneView: ARSceneView? = null
    private var currentAnchorNode: AnchorNode? = null
    private var readyReported = false
    private var planeReported = false
    // Throttle the per-frame screen-position emit so we don't flood the bridge.
    private var frameTick = 0

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

                onSessionUpdated = { session, frame ->
                    if (!readyReported) {
                        readyReported = true
                        post { onARReady?.invoke() }
                    }
                    if (!planeReported && hasTrackedPlane(session)) {
                        planeReported = true
                        post { onPlaneDetected?.invoke() }
                    }
                    // Museum mode: project the placed anchor to screen so the RN
                    // card can follow it. Throttled to every 3rd frame.
                    if (onAnchorScreenPos != null && currentAnchorNode != null) {
                        frameTick += 1
                        if (frameTick % 3 == 0) {
                            emitAnchorScreenPos(frame)
                        }
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

    /**
     * Museum mode: anchor a tracking point at the tapped screen location WITHOUT
     * loading any model. Prefers a plane hit but falls back to any hit (feature
     * point / depth) so it still works pointing at a statue or wall where ARCore
     * hasn't fitted a plane. The RN card then follows [onAnchorScreenPos].
     */
    fun placeAnchor(screenX: Float, screenY: Float) {
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
        val planeHit = hits?.firstOrNull { result ->
            val tr = result.trackable
            tr is Plane &&
                tr.trackingState == TrackingState.TRACKING &&
                tr.isPoseInPolygon(result.hitPose)
        }
        // Fall back to any hit so museum objects without a fitted plane still anchor.
        val hit = planeHit ?: hits?.firstOrNull()
        if (hit == null) {
            post { onARError?.invoke("couldn't lock on — move slightly and tap again") }
            return
        }

        val anchor = try {
            hit.createAnchor()
        } catch (t: Throwable) {
            Log.w(TAG, "createAnchor failed", t)
            post { onARError?.invoke("anchor creation failed") }
            return
        }

        clearCurrentAnchor()
        val anchorNode = try {
            AnchorNode(sceneView.engine, anchor).also { sceneView.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "anchor node create failed", t)
            post { onARError?.invoke("anchor node create failed") }
            return
        }
        currentAnchorNode = anchorNode
        frameTick = 0
        post { onAnchorPlaced?.invoke("museum_anchor") }
        // Emit one position immediately so the card appears without waiting a frame.
        try {
            sceneView.frame?.let { emitAnchorScreenPos(it) }
        } catch (_: Throwable) {
        }
    }

    /**
     * Museum mode: grab the current ARCore camera image, JPEG-encode it, write to
     * cache, and hand the file:// uri to RN (for the Gemini identify call). This
     * replaces vision-camera's takePhoto() on AR devices, since ARCore owns the
     * camera here.
     *
     * NOTE: the image is in the sensor's native (usually landscape) orientation —
     * no rotation is applied. Gemini object identification is robust to rotation;
     * if labels suffer on portrait holds, rotate by display orientation here.
     */
    fun captureFrame() {
        val frame = try {
            arSceneView?.frame
        } catch (t: Throwable) {
            null
        }
        if (frame == null) {
            post { onARError?.invoke("AR session not ready") }
            return
        }
        var image: android.media.Image? = null
        try {
            image = frame.acquireCameraImage()
            if (image.format != ImageFormat.YUV_420_888) {
                post { onARError?.invoke("unexpected camera image format") }
                return
            }
            val w = image.width
            val h = image.height
            val nv21 = yuv420ToNv21(image)
            val yuv = YuvImage(nv21, ImageFormat.NV21, w, h, null)
            val out = ByteArrayOutputStream()
            yuv.compressToJpeg(Rect(0, 0, w, h), 85, out)
            val file = File(context.cacheDir, "museum_frame_${System.currentTimeMillis()}.jpg")
            file.writeBytes(out.toByteArray())
            val uri = Uri.fromFile(file).toString()
            post { onFrameCaptured?.invoke(uri) }
        } catch (t: Throwable) {
            Log.w(TAG, "captureFrame failed", t)
            post { onARError?.invoke("frame capture failed") }
        } finally {
            try {
                image?.close()
            } catch (_: Throwable) {
            }
        }
    }

    /** Project the current anchor's world pose to screen (dp) and emit it. */
    private fun emitAnchorScreenPos(frame: com.google.ar.core.Frame) {
        val node = currentAnchorNode ?: return
        val anchor = try {
            node.anchor
        } catch (t: Throwable) {
            return
        }
        val camera = frame.camera
        if (camera.trackingState != TrackingState.TRACKING) {
            post { onAnchorScreenPos?.invoke(0f, 0f, false) }
            return
        }
        val vw = width
        val vh = height
        if (vw <= 0 || vh <= 0) return

        val viewMat = FloatArray(16)
        val projMat = FloatArray(16)
        try {
            camera.getViewMatrix(viewMat, 0)
            camera.getProjectionMatrix(projMat, 0, 0.1f, 100f)
        } catch (t: Throwable) {
            return
        }

        val pose = anchor.pose
        val world = floatArrayOf(pose.tx(), pose.ty(), pose.tz(), 1f)
        val eye = multiplyMatVec(viewMat, world)
        val clip = multiplyMatVec(projMat, eye)
        val w = clip[3]
        if (w <= 0f) {
            // Behind the camera.
            post { onAnchorScreenPos?.invoke(0f, 0f, false) }
            return
        }
        val ndcX = clip[0] / w
        val ndcY = clip[1] / w
        val density = resources.displayMetrics.density.takeIf { it > 0f } ?: 1f
        val xDp = ((ndcX * 0.5f + 0.5f) * vw) / density
        val yDp = ((1f - (ndcY * 0.5f + 0.5f)) * vh) / density
        val onScreen = ndcX in -1.2f..1.2f && ndcY in -1.2f..1.2f
        post { onAnchorScreenPos?.invoke(xDp, yDp, onScreen) }
    }

    /** Column-major (OpenGL/ARCore) 4x4 * vec4. element(row,col) = m[col*4+row]. */
    private fun multiplyMatVec(m: FloatArray, v: FloatArray): FloatArray {
        val r = FloatArray(4)
        for (row in 0 until 4) {
            r[row] =
                m[row] * v[0] +
                m[4 + row] * v[1] +
                m[8 + row] * v[2] +
                m[12 + row] * v[3]
        }
        return r
    }

    private fun yuv420ToNv21(image: android.media.Image): ByteArray {
        val width = image.width
        val height = image.height
        val ySize = width * height
        val nv21 = ByteArray(ySize + ySize / 2)

        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

        // Y plane → copy row by row, honoring rowStride padding.
        val yBuffer = yPlane.buffer.duplicate()
        val yRowStride = yPlane.rowStride
        var pos = 0
        val rowBuf = ByteArray(yRowStride)
        for (row in 0 until height) {
            yBuffer.position(row * yRowStride)
            val toRead = minOf(yRowStride, yBuffer.remaining())
            yBuffer.get(rowBuf, 0, toRead)
            System.arraycopy(rowBuf, 0, nv21, pos, width)
            pos += width
        }

        // Chroma → NV21 expects interleaved V,U starting after Y.
        val uBuffer = uPlane.buffer.duplicate()
        val vBuffer = vPlane.buffer.duplicate()
        val uvRowStride = uPlane.rowStride
        val uvPixelStride = uPlane.pixelStride
        val chromaHeight = height / 2
        val chromaWidth = width / 2
        var offset = ySize
        for (row in 0 until chromaHeight) {
            for (col in 0 until chromaWidth) {
                val uvIndex = row * uvRowStride + col * uvPixelStride
                nv21[offset++] =
                    if (uvIndex < vBuffer.limit()) vBuffer.get(uvIndex) else 0
                nv21[offset++] =
                    if (uvIndex < uBuffer.limit()) uBuffer.get(uvIndex) else 0
            }
        }
        return nv21
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
