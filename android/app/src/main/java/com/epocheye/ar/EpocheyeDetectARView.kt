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
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Plane
import com.google.ar.core.TrackingState
import com.google.ar.core.Config
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.math.Rotation
import io.github.sceneview.node.ModelNode
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Detector-driven plane AR view (the W2/W3 "fresh ARCore" stack).
 *
 * Distinct from [EpocheyePlaneARView] (museum/geo flows) — this one is built for
 * the detect→place pipeline:
 *   - reports continuous camera TRACKING state (so JS can gate placement)
 *   - places the GLB from an arbitrary screen point (a TAP in W2, the detector
 *     bbox base-center in W3) via the SAME hit-test path
 *   - exposes a yaw nudge for manual alignment
 *   - can hand a JPEG of the ARCore camera frame back to JS for the detector
 *     (ARCore owns the camera, so vision-camera can't run alongside it)
 *
 * The GLB is parented to an [AnchorNode], so it stays world-locked as the device
 * moves (it does NOT drift with the camera).
 */
class EpocheyeDetectARView(context: Context) : FrameLayout(context) {

    private var glbUri: String? = null
    private var modelScale: Float = 0.5f
    private var currentYawDeg: Float = 0f

    var onARReady: (() -> Unit)? = null
    var onPlaneDetected: (() -> Unit)? = null
    var onTrackingState: ((String) -> Unit)? = null
    var onAnchorPlaced: ((String) -> Unit)? = null
    var onARError: ((String) -> Unit)? = null
    var onFrameCaptured: ((String) -> Unit)? = null

    private var arSceneView: ARSceneView? = null
    private var currentAnchorNode: AnchorNode? = null
    private var currentModelNode: ModelNode? = null
    private var readyReported = false
    private var planeReported = false
    private var lastTrackingState: TrackingState? = null

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
                    // Emit camera tracking state transitions so JS can gate placement.
                    val ts = try {
                        frame.camera.trackingState
                    } catch (_: Throwable) {
                        null
                    }
                    if (ts != null && ts != lastTrackingState) {
                        lastTrackingState = ts
                        post { onTrackingState?.invoke(ts.name) }
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
            Log.e(TAG, "detect AR setup failed", e)
            post { onARError?.invoke(e.message ?: "detect AR setup failed") }
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
    }

    fun setModelScale(scale: Float) {
        if (scale > 0f) modelScale = scale
    }

    /**
     * Place the GLB at an arbitrary VIEW point (display pixels). A TAP feeds
     * this directly in W2. Only anchors on a TRACKING plane whose polygon
     * contains the hit pose.
     */
    fun placeAtScreenPoint(screenX: Float, screenY: Float) {
        val sceneView = arSceneView
        val frame = try {
            sceneView?.frame
        } catch (t: Throwable) {
            null
        }
        if (!preflight(sceneView, frame)) return
        doPlace(sceneView!!, frame!!, screenX, screenY)
    }

    /**
     * Place the GLB from a detector bbox base-center given in IMAGE_NORMALIZED
     * coords (0..1 in the ARCore camera image — the same framing the detector
     * ran on). ARCore's [com.google.ar.core.Frame.transformCoordinates2d] maps
     * that to VIEW pixels, correctly accounting for display rotation and the
     * aspect-ratio crop between the camera image and the view — so we never do
     * fragile rotation math in JS. Then it hit-tests exactly like a tap.
     */
    fun placeFromDetection(imgNormX: Float, imgNormY: Float) {
        val sceneView = arSceneView
        val frame = try {
            sceneView?.frame
        } catch (t: Throwable) {
            null
        }
        if (!preflight(sceneView, frame)) return

        val input = floatArrayOf(imgNormX, imgNormY)
        val output = FloatArray(2)
        try {
            frame!!.transformCoordinates2d(
                Coordinates2d.IMAGE_NORMALIZED,
                input,
                Coordinates2d.VIEW,
                output,
            )
        } catch (t: Throwable) {
            Log.w(TAG, "transformCoordinates2d failed", t)
            post { onARError?.invoke("coordinate transform failed") }
            return
        }
        doPlace(sceneView!!, frame, output[0], output[1])
    }

    /** Shared guard: glbUri set, session live, camera TRACKING. */
    private fun preflight(
        sceneView: ARSceneView?,
        frame: com.google.ar.core.Frame?,
    ): Boolean {
        if (glbUri.isNullOrBlank()) {
            post { onARError?.invoke("glbUri not set") }
            return false
        }
        if (sceneView == null || frame == null) {
            post { onARError?.invoke("AR session not ready") }
            return false
        }
        if (frame.camera.trackingState != TrackingState.TRACKING) {
            post { onARError?.invoke("move phone to scan — not tracking yet") }
            return false
        }
        return true
    }

    /** Shared hit-test → anchor → model at a VIEW (display-pixel) point. */
    private fun doPlace(
        sceneView: ARSceneView,
        frame: com.google.ar.core.Frame,
        viewX: Float,
        viewY: Float,
    ) {
        val uri = glbUri ?: return
        val hits = try {
            frame.hitTest(viewX, viewY)
        } catch (t: Throwable) {
            Log.w(TAG, "hitTest failed: ${t.message}")
            null
        }
        val hit = hits?.firstOrNull { result ->
            val tr = result.trackable
            tr is Plane &&
                tr.trackingState == TrackingState.TRACKING &&
                tr.isPoseInPolygon(result.hitPose)
        }
        if (hit == null) {
            post { onARError?.invoke("no floor at that point — aim at a flat surface") }
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
        attachModel(sceneView, anchorNode, uri)
    }

    /** One-tap yaw alignment nudge (degrees) applied to the placed model. */
    fun nudgeYaw(deltaDeg: Float) {
        val node = currentModelNode ?: return
        currentYawDeg = (currentYawDeg + deltaDeg) % 360f
        try {
            node.rotation = Rotation(0f, currentYawDeg, 0f)
        } catch (t: Throwable) {
            Log.w(TAG, "yaw nudge failed", t)
        }
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
        currentModelNode = null
        currentYawDeg = 0f
    }

    private fun attachModel(
        sceneView: ARSceneView,
        anchorNode: AnchorNode,
        glbUri: String,
    ) {
        try {
            sceneView.modelLoader.loadModelInstanceAsync(
                Uri.parse(glbUri).toString(),
                { it },
            ) { modelInstance ->
                if (modelInstance == null) {
                    post { onARError?.invoke("model load failed") }
                    return@loadModelInstanceAsync
                }
                try {
                    val modelNode = ModelNode(
                        modelInstance = modelInstance,
                        scaleToUnits = modelScale,
                    )
                    try {
                        modelNode.rotation = Rotation(0f, currentYawDeg, 0f)
                    } catch (_: Throwable) {
                    }
                    anchorNode.addChildNode(modelNode)
                    currentModelNode = modelNode
                    post { onAnchorPlaced?.invoke("detect_place") }
                } catch (t: Throwable) {
                    Log.e(TAG, "model node attach failed", t)
                    post { onARError?.invoke("model attach failed") }
                }
            }
        } catch (t: Throwable) {
            Log.e(TAG, "model load dispatch failed", t)
            post { onARError?.invoke("model load dispatch failed") }
        }
    }

    /**
     * Grab the current ARCore camera image, JPEG-encode it, write to cache, and
     * hand the file:// uri to JS (for the Roboflow detect call in W3). The image
     * is in the sensor's native (landscape) orientation — W3 accounts for that
     * when mapping detector coords back to a screen hit-test point.
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
            val file = File(context.cacheDir, "detect_frame_${System.currentTimeMillis()}.jpg")
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

    private fun yuv420ToNv21(image: android.media.Image): ByteArray {
        val width = image.width
        val height = image.height
        val ySize = width * height
        val nv21 = ByteArray(ySize + ySize / 2)

        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

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
        lastTrackingState = null
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cleanup()
    }

    companion object {
        private const val TAG = "EpocheyeDetectARView"
    }
}
