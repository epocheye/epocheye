package com.epocheye.ar

import android.content.Context
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import com.facebook.react.uimanager.ThemedReactContext
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Plane
import com.google.ar.core.Pose
import com.google.ar.core.TrackingState
import com.google.ar.core.Config
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation
import io.github.sceneview.node.ImageNode
import io.github.sceneview.node.ModelNode
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.atan2

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
class EpocheyeDetectARView(context: Context) : FrameLayout(context), LifecycleOwner {

    // SceneView is driven by a view-tied lifecycle: CREATED at construction (no
    // session/rendering yet), RESUMED only once attached to a window (so the
    // Display + GL surface exist), DESTROYED on detach. Hosting it off
    // ProcessLifecycleOwner started rendering before the surface was ready
    // ("OpenGL ES API with no current context" → black) and read the Display
    // before attach ("Display.getRotation() on null" → crash).
    private val lifecycleRegistry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry

    private var glbUri: String? = null
    private var modelScale: Float = 0.5f
    private var currentYawDeg: Float = 0f
    /** Grounded card JSON (display_name/period/.../identity_confidence). */
    private var cardData: String? = null

    var onARReady: (() -> Unit)? = null
    var onPlaneDetected: (() -> Unit)? = null
    var onTrackingState: ((String) -> Unit)? = null
    var onAnchorPlaced: ((String) -> Unit)? = null
    var onARError: ((String) -> Unit)? = null
    var onFrameCaptured: ((String) -> Unit)? = null

    private var arSceneView: ARSceneView? = null
    private var currentAnchorNode: AnchorNode? = null
    private var currentModelNode: ModelNode? = null
    // One or more world-anchored card placards. Grounded results use a single card
    // above the model; allowed-but-ungrounded statues use 1–3 spread placards.
    private val cardNodes = mutableListOf<ImageNode>()

    // Card-only layout: positions (relative to the anchor at the object's base) for
    // up to 3 placards — offset to the side so they don't overlap the statue, modest
    // height ("not too high"), spread in x/y/z. TUNABLE on-device.
    private val cardLayout = listOf(
        Position(0.5f, 0.5f, 0f),
        Position(0.5f, 0.15f, 0.1f),
        Position(-0.5f, 0.35f, 0f),
    )
    private val cardOnlyScale = 0.26f
    private var readyReported = false
    private var planeReported = false
    private var lightingApplied = false
    private var lastTrackingState: TrackingState? = null

    /**
     * A placement requested before the model and/or camera tracking were ready.
     * Whichever arrives last (glbUri via setGlbUri, or TRACKING via
     * onSessionUpdated) triggers the deferred placement — so JS can set the model
     * and ask to place it without racing the native prop/command ordering.
     */
    private sealed class Pending {
        /** Auto-place ~1.2 m in front of the camera (dev model-picker). */
        object Front : Pending()
        /** Place from a detector bbox base-center (IMAGE_NORMALIZED). */
        data class Detection(val nx: Float, val ny: Float) : Pending()
    }
    private var pending: Pending? = null

    init {
        // Do NOT build the ARSceneView here. SceneView's onLayout reads the
        // View's own Display rotation, which is null until the view is attached
        // to a window — building it at construction time crashes with
        // "Display.getRotation() on a null object reference". Construction is
        // deferred to onAttachedToWindow().
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
    }

    private fun setupAR() {
        try {
            // ARSceneView reads the Display rotation, so it MUST be built with a
            // display-associated context. The ThemedReactContext (a non-Activity
            // context) returns a null Display on API 30+, which crashes SceneView
            // with "Display.getRotation() on a null object reference". Use the
            // current Activity context instead.
            val hostContext: Context =
                (context as? ThemedReactContext)?.currentActivity ?: context
            val sceneView = ARSceneView(
                context = hostContext,
                sharedLifecycle = lifecycleRegistry,
            ).apply {
                layoutParams = LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )

                configureSession { _, config ->
                    config.geospatialMode = Config.GeospatialMode.DISABLED
                    config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                    config.depthMode = Config.DepthMode.DISABLED
                    // Light estimation DISABLED — on this device it produced no usable
                    // scene light (models stayed black). Instead we apply our own
                    // bright diffuse IndirectLight in ensureLighting(); because the
                    // model materials are forced dielectric (metallicFactor=0) at load,
                    // a diffuse-only IBL lights them reliably (a metal would still need
                    // reflections). Deterministic and independent of ARCore estimates.
                    config.lightEstimationMode = Config.LightEstimationMode.DISABLED
                    config.focusMode = Config.FocusMode.AUTO
                    config.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                }

                onSessionUpdated = { session, frame ->
                    if (!readyReported) {
                        readyReported = true
                        post { onARReady?.invoke() }
                    }
                    // Apply our explicit scene lighting once the session/scene is live
                    // (doing it at construction can touch Filament before the surface
                    // exists). Estimation is off, so this is the only light source.
                    if (!lightingApplied) {
                        lightingApplied = true
                        arSceneView?.let { ensureLighting(it) }
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
                    // Billboard the data panel to face the camera each frame.
                    // Best-effort: any SceneView API mismatch is swallowed so the
                    // panel (and the rest of the scene) never crash the session.
                    // Billboard the data placard to face the camera — Y-axis only,
                    // so it stays upright (never inverted) and +Z (the image face)
                    // points at the viewer.
                    if (cardNodes.isNotEmpty()) {
                        try {
                            val cam = frame.camera.pose
                            for (card in cardNodes) {
                                val p = card.worldPosition
                                val yaw = Math.toDegrees(
                                    atan2(
                                        (cam.tx() - p.x).toDouble(),
                                        (cam.tz() - p.z).toDouble(),
                                    ),
                                ).toFloat()
                                card.rotation = Rotation(0f, yaw, 0f)
                            }
                        } catch (_: Throwable) {
                        }
                    }
                    // Retry any deferred placement now that a fresh (possibly
                    // TRACKING) frame is available.
                    if (pending != null) tryPlacePending()
                }

                onTrackingFailureChanged = { reason ->
                    if (reason != null) {
                        post { onARError?.invoke(reason.name) }
                    }
                }
            }
            // Hide SceneView's built-in plane visualization (the dotted grid). Plane
            // DETECTION stays on (config.planeFindingMode above) so hit-testing still
            // works — only the on-screen technical overlay is suppressed.
            try {
                sceneView.planeRenderer.isEnabled = false
            } catch (_: Throwable) {
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

    /**
     * Explicit, asset-free scene lighting (AR light estimation is disabled). A
     * bright flat-ambient [IndirectLight] (1-band SH irradiance) lights every
     * dielectric surface uniformly — combined with the forced metallicFactor=0 at
     * load, this reliably lights the heritage models — and the main directional
     * light is boosted for some shading/relief. Best-effort and guarded so a
     * Filament hiccup never blocks the camera.
     */
    private fun ensureLighting(sceneView: ARSceneView) {
        try {
            val ibl = com.google.android.filament.IndirectLight.Builder()
                .irradiance(1, floatArrayOf(1.0f, 1.0f, 1.0f))
                .intensity(80_000f)
                .build(sceneView.engine)
            sceneView.indirectLight = ibl
        } catch (t: Throwable) {
            Log.w(TAG, "ensureLighting: indirect light failed", t)
        }
        try {
            sceneView.mainLightNode?.let { ln ->
                ln.lightManager.setIntensity(ln.lightInstance, 120_000f)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "ensureLighting: main light boost failed", t)
        }
    }

    fun setGlbUri(uri: String?) {
        val next = uri?.takeIf { it.isNotBlank() }
        if (next == glbUri) return
        glbUri = next

        // No anchor yet → the model just became available; if a placement was
        // waiting on it, run it now. Otherwise the URI is used at placement time.
        if (currentAnchorNode == null) {
            tryPlacePending()
            return
        }

        // Already anchored → progressive swap: reload the new GLB into the SAME
        // anchor so the upgrade is seamless and keeps pose + yaw.
        val node = currentAnchorNode ?: return
        val sceneView = arSceneView ?: return
        val uriStr = glbUri ?: return
        try {
            currentModelNode?.let { node.removeChildNode(it) }
        } catch (t: Throwable) {
            Log.w(TAG, "swap: remove old model failed", t)
        }
        currentModelNode = null
        attachModel(sceneView, node, uriStr)
    }

    fun setModelScale(scale: Float) {
        if (scale > 0f) modelScale = scale
    }

    /**
     * Set the grounded data-card JSON to render as a world-anchored 3D panel
     * beside the placed model. If an anchor already exists the panel is
     * (re)attached immediately; otherwise it's attached at placement time.
     * Passing null/blank removes any existing panel.
     */
    /**
     * Set the grounded card JSON to render as a world-anchored placard floating
     * above the model. (Re)attaches now if an anchor exists; else at placement
     * time. Null/blank removes the placard.
     */
    fun setCardData(json: String?) {
        cardData = json?.takeIf { it.isNotBlank() }
        val sceneView = arSceneView ?: return
        val anchorNode = currentAnchorNode ?: return
        val data = cardData
        if (data == null) {
            removeCardNodes(anchorNode)
            return
        }
        attachCard(sceneView, anchorNode, data)
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
     * coords (0..1 in the ARCore camera image). Deferred via [tryPlacePending] so
     * it works whether the model (glbUri) or camera TRACKING arrives first.
     */
    fun placeFromDetection(imgNormX: Float, imgNormY: Float) {
        pending = Pending.Detection(imgNormX, imgNormY)
        tryPlacePending()
    }

    /** Auto-place the model ~1.2 m in front of the camera (dev model-picker). */
    fun placeInFront() {
        pending = Pending.Front
        tryPlacePending()
    }

    /**
     * Run a deferred placement once BOTH the model (glbUri) and camera TRACKING
     * are ready. Invoked from placeInFront/placeFromDetection, setGlbUri, and each
     * frame — whichever satisfies the preconditions last actually places, so JS
     * never has to sequence the model prop against the place command.
     */
    private fun tryPlacePending() {
        val p = pending ?: return
        val sceneView = arSceneView ?: return
        val frame = try {
            sceneView.frame
        } catch (t: Throwable) {
            null
        } ?: return
        if (glbUri.isNullOrBlank()) return
        if (frame.camera.trackingState != TrackingState.TRACKING) return

        when (p) {
            is Pending.Front -> {
                pending = null
                doPlaceInFront(sceneView, frame)
            }
            is Pending.Detection -> {
                // IMAGE_NORMALIZED → VIEW pixels (rotation/crop-safe), then hit-test.
                val input = floatArrayOf(p.nx, p.ny)
                val output = FloatArray(2)
                try {
                    frame.transformCoordinates2d(
                        Coordinates2d.IMAGE_NORMALIZED, input, Coordinates2d.VIEW, output,
                    )
                } catch (t: Throwable) {
                    pending = null
                    Log.w(TAG, "transformCoordinates2d failed", t)
                    post { onARError?.invoke("coordinate transform failed") }
                    return
                }
                pending = null
                doPlace(sceneView, frame, output[0], output[1])
            }
        }
    }

    /**
     * Anchor at a fixed point ~1.2 m ahead of the camera (plane-independent —
     * always succeeds while TRACKING) and attach the model. Powers the dev
     * picker's "auto-place in front" so a model appears without aiming at a plane.
     */
    private fun doPlaceInFront(sceneView: ARSceneView, frame: com.google.ar.core.Frame) {
        val uri = glbUri ?: return
        val session = sceneView.session ?: run {
            post { onARError?.invoke("AR session not ready") }
            return
        }
        val target = frame.camera.pose.compose(Pose.makeTranslation(0f, 0f, -1.2f))
        // Anchor at the target translation with identity rotation (model upright).
        val placePose = Pose.makeTranslation(target.tx(), target.ty(), target.tz())
        val anchor = try {
            session.createAnchor(placePose)
        } catch (t: Throwable) {
            Log.w(TAG, "createAnchor (front) failed", t)
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

    /**
     * Card-only placement: anchor at the detection point and float 1–3 card placards
     * BESIDE the object (offset, eye-level-ish, not overlapping) — for allowed-but-
     * ungrounded statues that have no 3D model. cardsJson is a JSON array of card
     * objects (first full; the rest carry "continuation": true for long text).
     */
    fun placeCardsOnly(imgNormX: Float, imgNormY: Float, cardsJson: String) {
        val sceneView = arSceneView ?: return
        val frame = try {
            sceneView.frame
        } catch (t: Throwable) {
            null
        } ?: return
        if (frame.camera.trackingState != TrackingState.TRACKING) {
            post { onARError?.invoke("move phone to scan — not tracking yet") }
            return
        }
        val input = floatArrayOf(imgNormX, imgNormY)
        val output = FloatArray(2)
        try {
            frame.transformCoordinates2d(
                Coordinates2d.IMAGE_NORMALIZED, input, Coordinates2d.VIEW, output,
            )
        } catch (t: Throwable) {
            Log.w(TAG, "placeCardsOnly transform failed", t)
            post { onARError?.invoke("coordinate transform failed") }
            return
        }
        doPlaceCards(sceneView, frame, output[0], output[1], cardsJson)
    }

    private fun doPlaceCards(
        sceneView: ARSceneView,
        frame: com.google.ar.core.Frame,
        viewX: Float,
        viewY: Float,
        cardsJson: String,
    ) {
        val session = sceneView.session ?: return
        // Prefer a plane hit at the aimed point; fall back to ~1.5 m ahead so the
        // cards still appear when no plane is directly under the cursor.
        val hit = try {
            frame.hitTest(viewX, viewY).firstOrNull { r ->
                val tr = r.trackable
                tr is Plane && tr.trackingState == TrackingState.TRACKING &&
                    tr.isPoseInPolygon(r.hitPose)
            }
        } catch (t: Throwable) {
            null
        }
        val anchor = try {
            if (hit != null) {
                hit.createAnchor()
            } else {
                val target = frame.camera.pose.compose(Pose.makeTranslation(0f, 0f, -1.5f))
                session.createAnchor(Pose.makeTranslation(target.tx(), target.ty(), target.tz()))
            }
        } catch (t: Throwable) {
            Log.w(TAG, "doPlaceCards anchor failed", t)
            post { onARError?.invoke("anchor creation failed") }
            return
        }

        clearCurrentAnchor()
        val anchorNode = try {
            AnchorNode(sceneView.engine, anchor).also { sceneView.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "card anchor node create failed", t)
            post { onARError?.invoke("anchor node create failed") }
            return
        }
        currentAnchorNode = anchorNode

        val cards = try {
            JSONArray(cardsJson)
        } catch (t: Throwable) {
            JSONArray()
        }
        val n = minOf(cards.length(), cardLayout.size)
        for (i in 0 until n) {
            val json = cards.optJSONObject(i)?.toString() ?: continue
            addCardNode(sceneView, anchorNode, json, cardLayout[i], cardOnlyScale)
        }
        if (cardNodes.isEmpty()) {
            post { onARError?.invoke("could not render the card") }
            return
        }
        setPlaneFinding(false)
        post { onAnchorPlaced?.invoke("cards_only") }
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
        // Re-scan: detection is needed again to hit-test the next placement.
        setPlaneFinding(true)
    }

    /**
     * Toggle continuous plane finding on the live session. We keep it ON while
     * the user is aiming/placing, then turn it OFF once a model is anchored — the
     * model is world-locked via its anchor (which survives mode changes), so the
     * heavy per-frame plane detection is pure wasted CPU/heat after placement.
     */
    private fun setPlaneFinding(enabled: Boolean) {
        val session = arSceneView?.session ?: return
        try {
            val config = session.config
            config.planeFindingMode =
                if (enabled) Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                else Config.PlaneFindingMode.DISABLED
            session.configure(config)
        } catch (t: Throwable) {
            Log.w(TAG, "setPlaneFinding($enabled) failed", t)
        }
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
        cardNodes.clear()
        currentYawDeg = 0f
        pending = null
    }

    /** Detach + forget all card placards (best-effort). */
    private fun removeCardNodes(anchorNode: AnchorNode) {
        for (node in cardNodes) {
            try {
                anchorNode.removeChildNode(node)
            } catch (_: Throwable) {
            }
        }
        cardNodes.clear()
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
                // Fix-ups for the recompressed heritage GLBs:
                //  1) They are stone sculpture but mis-authored as fully metallic
                //     (metallicFactor=1). A metal has no diffuse term, so under indoor
                //     AR light estimation it renders near-black — force dielectric so
                //     the diffuse path (estimated SH + main light) lights it.
                //  2) gltfpack's meshopt/quantization left the winding reversed, so
                //     back-face culling hid the camera-facing surfaces — the model
                //     showed as a black shell with the floor visible through it.
                //     setDoubleSided(true) renders both faces AND flips normals for the
                //     back side so the lighting is correct (plus cull NONE as backstop).
                // Per-material, each call guarded (setParameter throws on a missing param).
                try {
                    modelInstance.materialInstances.forEach { mi ->
                        try { mi.setParameter("metallicFactor", 0.0f) } catch (_: Throwable) {}
                        try { mi.setParameter("roughnessFactor", 0.85f) } catch (_: Throwable) {}
                        try { mi.isDoubleSided = true } catch (_: Throwable) {}
                        try {
                            mi.cullingMode = com.google.android.filament.Material.CullingMode.NONE
                        } catch (_: Throwable) {}
                    }
                } catch (t: Throwable) {
                    Log.w(TAG, "material fix-up skipped", t)
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
                    // Model is now world-locked via its anchor — stop continuous
                    // plane finding to cut sustained CPU load / heat. Re-enabled on
                    // clearAnchor() for a re-scan.
                    setPlaneFinding(false)
                    post { onAnchorPlaced?.invoke("detect_place") }
                    // Float the data placard above the model, if a card is set.
                    cardData?.let { attachCard(sceneView, anchorNode, it) }
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
     * Render the grounded card to a bitmap and attach it as a small world-anchored
     * [ImageNode] placard FLOATING ABOVE the model (so it never occludes the
     * statue), kept upright + facing the camera by the Y-axis billboard in
     * onSessionUpdated. Guarded — if it fails the RN overlay card still shows the
     * data and placement is unaffected.
     */
    private fun attachCard(sceneView: ARSceneView, anchorNode: AnchorNode, json: String) {
        removeCardNodes(anchorNode)
        addCardNode(sceneView, anchorNode, json, Position(0f, 0.55f, 0f), 0.28f)
    }

    /** Render one card JSON to a bitmap and add it as a billboarded ImageNode. */
    private fun addCardNode(
        sceneView: ARSceneView,
        anchorNode: AnchorNode,
        json: String,
        position: Position,
        scale: Float,
    ) {
        try {
            val bitmap = EpocheyeArCardRenderer.render(json) ?: return
            val node = ImageNode(sceneView.materialLoader, bitmap).apply {
                this.position = position
                setScale(scale)
            }
            anchorNode.addChildNode(node)
            cardNodes.add(node)
        } catch (t: Throwable) {
            Log.w(TAG, "addCardNode failed — placard skipped (RN card still shows data)", t)
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
        lightingApplied = false
        lastTrackingState = null
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        // Now attached: build the ARSceneView (its child View attaches immediately,
        // so getDisplay() is non-null and onLayout won't NPE), THEN resume — the
        // window/display + render surface exist, so the GL context is ready before
        // SceneView starts the session and renders.
        if (arSceneView == null) setupAR()
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED
    }

    /**
     * Re-run a real measure + layout pass on this view and its children.
     *
     * React Native drives layout from its shadow tree and swallows requestLayout()
     * on the native view hierarchy. The ARSceneView is a SurfaceView added natively
     * (outside RN's shadow tree): when its surface is (re)created it calls
     * requestLayout() so SurfaceView.updateSurface() can size/position the surface.
     * RN drops that request, so the surface is never presented and the camera
     * renders to nothing → BLACK SCREEN. Forcing this pass applies the geometry.
     */
    private val measureAndLayout = Runnable {
        measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
        )
        layout(left, top, right, bottom)
    }

    override fun requestLayout() {
        super.requestLayout()
        // Bridge RN's swallowed requestLayout → a real Android layout pass so the
        // embedded SurfaceView actually presents (see measureAndLayout above).
        post(measureAndLayout)
    }

    override fun onDetachedFromWindow() {
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        super.onDetachedFromWindow()
        cleanup()
    }

    companion object {
        private const val TAG = "EpocheyeDetectARView"
    }
}
