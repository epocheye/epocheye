package com.epocheye.ar

import android.content.Context
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.filament.Engine
import com.google.android.filament.IndirectLight
import com.google.ar.core.Anchor
import com.google.ar.core.Config
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Earth // ADMIN-HARNESS (REMOVE AFTER KONARK)
import com.google.ar.core.Frame
import com.google.ar.core.GeospatialPose // ADMIN-HARNESS (REMOVE AFTER KONARK)
import com.google.ar.core.HostCloudAnchorFuture
import com.google.ar.core.Plane
import com.google.ar.core.Pose
import com.google.ar.core.ResolveCloudAnchorFuture
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.VpsAvailability
import io.github.sceneview.ar.camera.ARCameraStream // ADMIN-HARNESS (REMOVE AFTER KONARK)
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.environment.Environment
import io.github.sceneview.loaders.MaterialLoader
import io.github.sceneview.loaders.ModelLoader
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation
import io.github.sceneview.node.ImageNode
import io.github.sceneview.node.ModelNode
import io.github.sceneview.node.Node as SvNode
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberMainLightNode
import io.github.sceneview.rememberMaterialLoader
import io.github.sceneview.rememberModelLoader
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.atan2

/**
 * Detector-driven plane AR view (the W2/W3 "fresh ARCore" stack).
 *
 * The single AR surface, built for the detect→place pipeline:
 *   - reports continuous camera TRACKING state (so JS can gate placement)
 *   - places the GLB from an arbitrary screen point (a TAP in W2, the detector
 *     bbox base-center in W3) via the SAME hit-test path
 *   - exposes a yaw nudge for manual alignment
 *   - can hand a JPEG of the ARCore camera frame back to JS for the detector
 *     (ARCore owns the camera, so vision-camera can't run alongside it)
 *
 * The GLB is parented to an [AnchorNode], so it stays world-locked as the device
 * moves (it does NOT drift with the camera).
 *
 * SceneView 4.18.0 removed the View-based `ARSceneView`; the AR surface is now the
 * Jetpack Compose `ARSceneView { }` composable. We host it in a [ComposeView] and
 * drive it imperatively: the scene graph hangs off a captured root node,
 * and Engine / loaders / Session / Frame are captured from the composable's
 * remember-factories and session callbacks so the placement/capture methods below
 * keep their original imperative shape. The React Native bridge (props, commands,
 * events) is unchanged.
 */
class EpocheyeDetectARView(context: Context) : FrameLayout(context) {

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
    /** Dev harness: Cloud Anchor host/resolve lifecycle (phase, state, id?, quality?, message?). */
    var onCloudAnchorEvent: ((
        phase: String,
        state: String,
        cloudAnchorId: String?,
        quality: String?,
        message: String?,
    ) -> Unit)? = null

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    // On-screen readouts so the harness is usable on an UNTETHERED release build
    // (no adb): the VPS result and the geospatial state/accuracies are pushed to JS
    // and rendered in the admin overlay, in addition to the VPS/GEO logcat lines.
    /** VPS probe result — a VpsAvailability enum name, or an error token. */
    var onVpsResult: ((result: String, message: String?) -> Unit)? = null
    /** Geospatial readout: Earth/tracking state + camera pose accuracies (pose null until TRACKING). */
    var onGeospatialState: ((
        earthState: String,
        trackingState: String,
        latitude: Double?,
        longitude: Double?,
        horizontalAccuracy: Double?,
        altitude: Double?,
        verticalAccuracy: Double?,
        orientationYawAccuracy: Double?,
    ) -> Unit)? = null

    // ── Compose-hosted scene ─────────────────────────────────────────────────
    // A single root node is created inside the ARSceneView content DSL and captured
    // here; imperative placement attaches/detaches the world-anchored nodes as its
    // children (SceneView 4.x has no public "adopt an existing node" list on the AR
    // composable, so this root bridges our imperative graph into the Compose scene).
    @Volatile private var sceneRoot: SvNode? = null
    private var composeView: ComposeView? = null

    // Captured from the composable so the imperative methods can build nodes and
    // read the live ARCore state without a View-based ARSceneView.
    @Volatile private var engine: Engine? = null
    @Volatile private var modelLoader: ModelLoader? = null
    @Volatile private var materialLoader: MaterialLoader? = null
    @Volatile private var arSession: Session? = null
    @Volatile private var arFrame: Frame? = null

    // Cloud Anchors stay DISABLED unless the dev harness flips this prop; the
    // production scan flow never sets it, so release sessions are unchanged.
    @Volatile private var cloudAnchorsEnabled = false
    private var hostFuture: HostCloudAnchorFuture? = null
    private var resolveFuture: ResolveCloudAnchorFuture? = null

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    // Depth occlusion has two flags. depthArmed decides the SESSION depthMode at
    // CREATION (AUTOMATIC vs DISABLED) — SceneView applies it authoritatively via
    // the direct composable param and ignores a post-hoc session.configure (proven
    // for cloudAnchorMode), so it must be known at creation; it is set from the
    // admin harness being mounted. depthOcclusionEnabled is the live on/off the
    // admin toggles — it only flips the captured camera stream's occlusion flag,
    // which needs no reconfigure, so a placed model is preserved. Both default off,
    // so regular users' sessions render exactly as before (depthMode DISABLED).
    @Volatile private var depthArmed = false
    @Volatile private var depthOcclusionEnabled = false
    @Volatile private var arCameraStream: ARCameraStream? = null

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    // Geospatial harness. geospatialMode is set at session CREATION via the direct
    // composable param (SceneView ignores a post-hoc configure — proven for
    // cloudAnchorMode), so START/STOP rebuild the session. Earth pose is read
    // per-frame in onSessionTick while active; earthState/trackingState transitions
    // are logged immediately, the pose is throttled by tick count. Never set for
    // regular users, so their sessions stay geospatialMode DISABLED.
    @Volatile private var geospatialEnabled = false
    private var lastEarthState: String? = null
    private var lastEarthTracking: String? = null
    private var geoTickCount = 0

    private var currentAnchorNode: AnchorNode? = null
    private var currentModelNode: ModelNode? = null
    // One or more world-anchored card placards. Grounded results use a single card
    // above the model; allowed-but-ungrounded statues use 1–3 spread placards.
    private val cardNodes = mutableListOf<ImageNode>()

    // Max world placards; kept in lock-step with MAX_AR_CARDS in DetectArScreen.tsx.
    private val maxCards = 6
    // Per-placement layout: one Position (relative to the anchor at the object's
    // base) per card, generated by cardLayoutFor() as a tightened arc so the cards
    // hug the object. Stored so the per-frame headlocked re-pose reuses the same
    // positions. TUNABLE on-device (arc span, radius, base height).
    private var activeCardLayout: List<Position> = emptyList()
    private val cardOnlyScale = 0.42f

    /**
     * Positions for [n] cards spread in a shallow arc close around the anchor
     * (radius ~0.30 m, ±60° span), with a gentle vertical zig-zag so neighbours
     * don't overlap. One card sits centred and low. Capped at [maxCards].
     */
    private fun cardLayoutFor(n: Int): List<Position> {
        val count = n.coerceIn(1, maxCards)
        if (count == 1) return listOf(Position(0f, 0.35f, 0f))
        val radius = 0.30f
        val spanDeg = 120f
        val step = spanDeg / (count - 1)
        val start = -spanDeg / 2f
        return (0 until count).map { i ->
            val rad = Math.toRadians((start + step * i).toDouble())
            val x = (radius * kotlin.math.sin(rad)).toFloat()
            val z = (radius * (1.0 - kotlin.math.cos(rad))).toFloat()
            val y = 0.35f + if (i % 2 == 0) 0.12f else -0.05f
            Position(x, y, z)
        }
    }
    private var readyReported = false
    private var planeReported = false
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

    // Card-only placement state (no-GLB heritage places). The placard is deferred and
    // retried each frame like the model: if camera tracking locks within TRACK_WAIT it
    // world-anchors ~cardDistance in front (walk-around-able); otherwise it falls back to
    // a camera-locked "headlocked" float so the card ALWAYS appears — a flat façade can
    // starve ARCore world tracking, which used to leave the user with no AR card at all.
    private var pendingCards: String? = null
    private var pendingCardX: Float = 0f
    private var pendingCardY: Float = 0f
    private var pendingCardsDeadlineNanos: Long = 0L
    private var cardsCameraLocked: Boolean = false
    private val trackWaitNanos = 1_500L * 1_000_000L
    private val cardDistance = 0.85f

    // ARSceneView (composable) is created in onAttachedToWindow, not here: the
    // ComposeView needs a ViewTreeLifecycleOwner (resolved once attached to the
    // Activity window) to drive the AR session lifecycle.

    private fun setupAR() {
        try {
            // Use the Activity context — a non-Activity context returns a null
            // Display on API 30+ and SceneView reads the display rotation.
            val hostContext: Context =
                (context as? ThemedReactContext)?.currentActivity ?: context

            val view = ComposeView(hostContext).apply {
                layoutParams = LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                // Dispose the composition (and release the AR session / Filament
                // engine) when THIS view unmounts — RN views come and go while the
                // host Activity lives, so the default (dispose-on-Activity-destroy)
                // would leak the camera/session.
                setViewCompositionStrategy(
                    ViewCompositionStrategy.DisposeOnDetachedFromWindow,
                )
                setContent {
                    val eng = rememberEngine()
                    val ml = rememberModelLoader(eng)
                    val matl = rememberMaterialLoader(eng)

                    // Explicit, asset-free bright IBL (AR light estimation is disabled
                    // below). A flat 1-band SH irradiance lights every dielectric
                    // surface uniformly — combined with the forced metallicFactor=0 at
                    // load this reliably lights the heritage models, which otherwise
                    // render near-black under indoor AR. Deterministic and independent
                    // of ARCore estimates.
                    val env = remember(eng) {
                        try {
                            val ibl = IndirectLight.Builder()
                                .irradiance(1, floatArrayOf(1.0f, 1.0f, 1.0f))
                                .intensity(80_000f)
                                .build(eng)
                            Environment(indirectLight = ibl)
                        } catch (t: Throwable) {
                            Log.w(TAG, "IBL build failed", t)
                            Environment()
                        }
                    }
                    val mainLight = rememberMainLightNode(eng)
                    // ADMIN-HARNESS (REMOVE AFTER KONARK)
                    // Own the camera stream so the depth-occlusion toggle can flip
                    // it live (captured into arCameraStream below).
                    val camStream = remember(matl) { ARCameraStream(matl) }
                    SideEffect {
                        engine = eng
                        modelLoader = ml
                        materialLoader = matl
                        // ADMIN-HARNESS (REMOVE AFTER KONARK)
                        arCameraStream = camStream
                        try {
                            camStream.isDepthOcclusionEnabled = depthOcclusionEnabled
                        } catch (_: Throwable) {
                        }
                        // Boost the main directional light for some shading/relief.
                        try {
                            mainLight?.let {
                                it.lightManager.setIntensity(it.lightInstance, 120_000f)
                            }
                        } catch (_: Throwable) {
                        }
                    }

                    io.github.sceneview.ar.ARSceneView(
                        modifier = Modifier.fillMaxSize(),
                        engine = eng,
                        modelLoader = ml,
                        materialLoader = matl,
                        environment = env,
                        mainLightNode = mainLight,
                        // Hide the dotted plane-visualization grid. Plane DETECTION
                        // stays on (planeFindingMode below) so hit-testing works.
                        planeRenderer = false,
                        // Cloud Anchor mode MUST be set via this direct composable
                        // param — SceneView applies its own cloudAnchorMode param
                        // authoritatively and overrides whatever the
                        // sessionConfiguration lambda sets (verified on-device: the
                        // lambda assignment did not enable it). Read at composition
                        // time; the prop sets the flag before creation, and
                        // rebuildAR() re-composes for the late-prop case. DISABLED
                        // (the default) in production, where the flag is never set.
                        cloudAnchorMode =
                            if (cloudAnchorsEnabled) Config.CloudAnchorMode.ENABLED
                            else Config.CloudAnchorMode.DISABLED,
                        // ADMIN-HARNESS (REMOVE AFTER KONARK)
                        // Depth mode MUST be set via this direct composable param at
                        // CREATION — SceneView applies it authoritatively and ignores
                        // a post-hoc session.configure (proven for cloudAnchorMode).
                        // Armed whenever the admin harness is mounted; DISABLED
                        // (default) for regular users, so the render path is
                        // unchanged. The visible occlusion is the camera-stream flag
                        // (depthOcclusionEnabled), toggled live in the SideEffect.
                        cameraStream = camStream,
                        depthMode =
                            if (depthArmed) Config.DepthMode.AUTOMATIC
                            else Config.DepthMode.DISABLED,
                        // ADMIN-HARNESS (REMOVE AFTER KONARK)
                        // Geospatial mode MUST be set via this direct composable param
                        // at CREATION (SceneView ignores post-hoc configure). ENABLED
                        // only while the admin runs the geospatial harness; DISABLED
                        // (default) for everyone else, so the render path is unchanged.
                        geospatialMode =
                            if (geospatialEnabled) Config.GeospatialMode.ENABLED
                            else Config.GeospatialMode.DISABLED,
                        sessionConfiguration = { _, config ->
                            config.geospatialMode = Config.GeospatialMode.DISABLED
                            config.planeFindingMode =
                                Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                            config.depthMode = Config.DepthMode.DISABLED
                            // Light estimation DISABLED — on this device it produced no
                            // usable scene light (models stayed black). Our own bright
                            // diffuse IBL (env above) is the only light source.
                            config.lightEstimationMode = Config.LightEstimationMode.DISABLED
                            config.focusMode = Config.FocusMode.AUTO
                            config.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                        },
                        onSessionCreated = { session ->
                            arSession = session
                            Log.i(
                                TAG,
                                "session created cloudAnchorMode=" +
                                    try {
                                        session.config.cloudAnchorMode.name
                                    } catch (t: Throwable) {
                                        "?"
                                    },
                            )
                            // ADMIN-HARNESS (REMOVE AFTER KONARK)
                            if (depthArmed) {
                                val supported = try {
                                    session.isDepthModeSupported(
                                        Config.DepthMode.AUTOMATIC,
                                    )
                                } catch (_: Throwable) {
                                    false
                                }
                                val mode = try {
                                    session.config.depthMode.name
                                } catch (_: Throwable) {
                                    "?"
                                }
                                Log.i(TAG, "depth armed; AUTOMATIC supported=$supported sessionDepthMode=$mode")
                            }
                            // ADMIN-HARNESS (REMOVE AFTER KONARK)
                            if (geospatialEnabled) {
                                val supported = try {
                                    session.isGeospatialModeSupported(
                                        Config.GeospatialMode.ENABLED,
                                    )
                                } catch (_: Throwable) {
                                    false
                                }
                                val mode = try {
                                    session.config.geospatialMode.name
                                } catch (_: Throwable) {
                                    "?"
                                }
                                Log.i(
                                    GEO_TAG,
                                    "geospatial requested; ENABLED supported=$supported sessionGeospatialMode=$mode",
                                )
                            }
                        },
                        onSessionUpdated = { session, frame ->
                            arSession = session
                            arFrame = frame
                            onSessionTick(session, frame)
                        },
                        onTrackingFailureChanged = { reason ->
                            // While a card placement is pending, stay quiet — the
                            // headlock fallback floats the card within TRACK_WAIT, so a
                            // raw INSUFFICIENT_FEATURES here would read as a scary "no
                            // surface" error.
                            if (reason != null && pendingCards == null) {
                                post { onARError?.invoke(reason.name) }
                            }
                        },
                    ) {
                        // Scene-attached root node; imperative placement parents the
                        // world-anchored nodes under it.
                        Node(apply = { sceneRoot = this })
                    }
                }
            }
            addView(view)
            composeView = view
        } catch (e: Throwable) {
            Log.e(TAG, "detect AR setup failed", e)
            post { onARError?.invoke(e.message ?: "detect AR setup failed") }
        }
    }

    /** Per-frame work, invoked from the composable's onSessionUpdated (main thread). */
    private fun onSessionTick(session: Session, frame: Frame) {
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
        // ADMIN-HARNESS (REMOVE AFTER KONARK)
        if (geospatialEnabled) {
            logGeospatial(session)
        }
        if (!planeReported && hasTrackedPlane(session)) {
            planeReported = true
            post { onPlaneDetected?.invoke() }
        }
        // Billboard the data placard to face the camera — Y-axis only, so it stays
        // upright (never inverted) and +Z (the image face) points at the viewer.
        // Best-effort: any mismatch is swallowed so the placard never crashes the
        // session.
        if (cardNodes.isNotEmpty()) {
            try {
                val cam = frame.camera.pose
                if (cardsCameraLocked) {
                    // Headlocked float: re-pose each card ~cardDistance in front of the
                    // camera every frame (no world anchor), so it stays in view even
                    // when ARCore never reaches full tracking.
                    for ((i, card) in cardNodes.withIndex()) {
                        val layout = activeCardLayout
                        val o = if (layout.isNotEmpty()) {
                            layout[i.coerceAtMost(layout.lastIndex)]
                        } else {
                            Position(0f, 0.35f, 0f)
                        }
                        val t = cam.compose(
                            Pose.makeTranslation(o.x, o.y, o.z - cardDistance),
                        )
                        card.worldPosition = Position(t.tx(), t.ty(), t.tz())
                        val yaw = Math.toDegrees(
                            atan2(
                                (cam.tx() - t.tx()).toDouble(),
                                (cam.tz() - t.tz()).toDouble(),
                            ),
                        ).toFloat()
                        card.rotation = Rotation(0f, yaw, 0f)
                    }
                } else {
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
                }
            } catch (_: Throwable) {
            }
        }
        // Retry any deferred placement now that a fresh (possibly TRACKING) frame is
        // available.
        if (pending != null) tryPlacePending()
        if (pendingCards != null) tryPlaceCardsPending()
    }

    private fun hasTrackedPlane(session: Session): Boolean {
        return try {
            session.getAllTrackables(Plane::class.java).any {
                it.trackingState == TrackingState.TRACKING
            }
        } catch (_: Throwable) {
            false
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
        val uriStr = glbUri ?: return
        try {
            currentModelNode?.let { node.removeChildNode(it) }
        } catch (t: Throwable) {
            Log.w(TAG, "swap: remove old model failed", t)
        }
        currentModelNode = null
        attachModel(node, uriStr)
    }

    fun setModelScale(scale: Float) {
        if (scale > 0f) modelScale = scale
    }

    /**
     * Set the grounded card JSON to render as a world-anchored placard floating
     * above the model. (Re)attaches now if an anchor exists; else at placement
     * time. Null/blank removes the placard.
     */
    fun setCardData(json: String?) {
        cardData = json?.takeIf { it.isNotBlank() }
        val anchorNode = currentAnchorNode ?: return
        val data = cardData
        if (data == null) {
            removeCardNodes(anchorNode)
            return
        }
        attachCard(anchorNode, data)
    }

    /**
     * Place the GLB at an arbitrary VIEW point (display pixels). A TAP feeds
     * this directly in W2. Only anchors on a TRACKING plane whose polygon
     * contains the hit pose.
     */
    fun placeAtScreenPoint(screenX: Float, screenY: Float) {
        val frame = arFrame
        if (!preflight(frame)) return
        doPlace(frame!!, screenX, screenY)
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
        val frame = arFrame ?: return
        if (glbUri.isNullOrBlank()) return
        if (frame.camera.trackingState != TrackingState.TRACKING) return

        when (p) {
            is Pending.Front -> {
                pending = null
                doPlaceInFront(frame)
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
                doPlace(frame, output[0], output[1])
            }
        }
    }

    /**
     * Anchor at a fixed point ~1.2 m ahead of the camera (plane-independent —
     * always succeeds while TRACKING) and attach the model. Powers the dev
     * picker's "auto-place in front" so a model appears without aiming at a plane.
     */
    private fun doPlaceInFront(frame: Frame) {
        val uri = glbUri ?: return
        val eng = engine ?: return
        val session = arSession ?: run {
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
            AnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "anchor node create failed", t)
            post { onARError?.invoke("anchor node create failed") }
            return
        }
        currentAnchorNode = anchorNode
        attachModel(anchorNode, uri)
    }

    /** Shared guard: glbUri set, session live, camera TRACKING. */
    private fun preflight(frame: Frame?): Boolean {
        if (glbUri.isNullOrBlank()) {
            post { onARError?.invoke("glbUri not set") }
            return false
        }
        if (frame == null || engine == null) {
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
    private fun doPlace(frame: Frame, viewX: Float, viewY: Float) {
        val uri = glbUri ?: return
        val eng = engine ?: return
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
            AnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "anchor node create failed", t)
            post { onARError?.invoke("anchor node create failed") }
            return
        }
        currentAnchorNode = anchorNode
        attachModel(anchorNode, uri)
    }

    /**
     * Card-only placement: anchor at the detection point and float 1–3 card placards
     * BESIDE the object (offset, eye-level-ish, not overlapping) — for allowed-but-
     * ungrounded statues that have no 3D model. cardsJson is a JSON array of card
     * objects (first full; the rest carry "continuation": true for long text).
     */
    fun placeCardsOnly(imgNormX: Float, imgNormY: Float, cardsJson: String) {
        // Defer-and-retry (mirrors the model's pending/tryPlacePending): world-anchor the
        // card when tracking locks, else headlock-float it after TRACK_WAIT. No hard
        // not-tracking failure — a no-GLB heritage card must ALWAYS appear.
        pendingCardX = imgNormX
        pendingCardY = imgNormY
        pendingCards = cardsJson
        pendingCardsDeadlineNanos = System.nanoTime() + trackWaitNanos
        tryPlaceCardsPending()
    }

    /**
     * Resolve a pending card placement. Called from placeCardsOnly and every frame in
     * onSessionUpdated. World-anchors in front once the camera is TRACKING (so the user
     * can walk around it); if tracking hasn't locked by the deadline, falls back to a
     * camera-locked headlocked float so the card is guaranteed to show.
     */
    private fun tryPlaceCardsPending() {
        val cardsJson = pendingCards ?: return
        val frame = arFrame ?: return

        if (frame.camera.trackingState == TrackingState.TRACKING) {
            val input = floatArrayOf(pendingCardX, pendingCardY)
            val output = FloatArray(2)
            val transformed = try {
                frame.transformCoordinates2d(
                    Coordinates2d.IMAGE_NORMALIZED, input, Coordinates2d.VIEW, output,
                )
                true
            } catch (t: Throwable) {
                Log.w(TAG, "placeCardsOnly transform failed", t)
                false
            }
            pendingCards = null
            if (transformed) {
                doPlaceCards(frame, output[0], output[1], cardsJson)
            } else {
                doPlaceCardsHeadlocked(cardsJson)
            }
            return
        }

        if (System.nanoTime() >= pendingCardsDeadlineNanos) {
            pendingCards = null
            doPlaceCardsHeadlocked(cardsJson)
        }
        // else: not tracking yet and still within the wait window — onSessionUpdated
        // will call us again on the next frame.
    }

    private fun doPlaceCards(frame: Frame, viewX: Float, viewY: Float, cardsJson: String) {
        val eng = engine ?: return
        val session = arSession ?: return
        // Prefer a plane hit at the aimed point; fall back to ~0.9 m ahead so the
        // cards still appear (close to the object) when no plane is under the cursor.
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
                val target = frame.camera.pose.compose(Pose.makeTranslation(0f, 0f, -0.9f))
                session.createAnchor(Pose.makeTranslation(target.tx(), target.ty(), target.tz()))
            }
        } catch (t: Throwable) {
            Log.w(TAG, "doPlaceCards anchor failed", t)
            post { onARError?.invoke("anchor creation failed") }
            return
        }

        clearCurrentAnchor()
        val anchorNode = try {
            AnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
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
        val n = minOf(cards.length(), maxCards)
        activeCardLayout = cardLayoutFor(n)
        for (i in 0 until n) {
            val json = cards.optJSONObject(i)?.toString() ?: continue
            addCardNode(anchorNode, json, activeCardLayout[i], cardOnlyScale)
        }
        if (cardNodes.isEmpty()) {
            post { onARError?.invoke("could not render the card") }
            return
        }
        setPlaneFinding(false)
        cardsCameraLocked = false
        post { onAnchorPlaced?.invoke("cards_only") }
    }

    /**
     * Headlock fallback: float the card(s) fixed in front of the camera with NO world
     * anchor — used when ARCore can't establish world tracking (e.g. a flat distant
     * façade). The per-frame pose is set in onSessionUpdated while cardsCameraLocked.
     */
    private fun doPlaceCardsHeadlocked(cardsJson: String) {
        clearCurrentAnchor()
        val cards = try {
            JSONArray(cardsJson)
        } catch (t: Throwable) {
            JSONArray()
        }
        val n = minOf(cards.length(), maxCards)
        activeCardLayout = cardLayoutFor(n)
        for (i in 0 until n) {
            val json = cards.optJSONObject(i)?.toString() ?: continue
            addCardNodeToScene(json, cardOnlyScale)
        }
        if (cardNodes.isEmpty()) {
            post { onARError?.invoke("could not render the card") }
            return
        }
        cardsCameraLocked = true
        setPlaneFinding(false)
        post { onAnchorPlaced?.invoke("cards_only_headlocked") }
    }

    /** Add a card placard parented to the SCENE (headlocked); pose set per-frame. */
    private fun addCardNodeToScene(json: String, scale: Float) {
        val matl = materialLoader ?: return
        try {
            val bitmap = EpocheyeArCardRenderer.render(json) ?: return
            val node = ImageNode(matl, bitmap).apply {
                setScale(scale)
            }
            sceneRoot?.addChildNode(node)
            cardNodes.add(node)
        } catch (t: Throwable) {
            Log.w(TAG, "addCardNodeToScene failed — placard skipped (RN card still shows data)", t)
        }
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
        pendingCards = null
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
        val session = arSession ?: return
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

    // ── Cloud Anchors (dev harness) ──────────────────────────────────────────

    /**
     * Enable/disable ARCore Cloud Anchors on the session. Set from the
     * `cloudAnchorsEnabled` prop (dev harness only) — a best-effort early enable.
     * The authoritative enable is just-in-time in [ensureCloudAnchorModeEnabled],
     * called from host/resolve, because prop timing vs session creation is racy on
     * some devices. Same live-reconfigure pattern as [setPlaneFinding].
     */
    fun setCloudAnchorsEnabled(enabled: Boolean) {
        if (enabled == cloudAnchorsEnabled) return
        Log.i(TAG, "setCloudAnchorsEnabled($enabled)")
        cloudAnchorsEnabled = enabled
        // SceneView only reliably applies session config through the
        // sessionConfiguration lambda at session CREATION (a post-hoc
        // session.configure on its ARSession does not persist — proven on-device:
        // cloudAnchorMode kept reverting to DISABLED). So when the flag flips on
        // and a session already exists but nothing is placed yet (the prop flips
        // once, at mount), rebuild the AR surface so the lambda enables cloud
        // anchors at creation — exactly how planeFindingMode reliably sticks.
        if (enabled && composeView != null && currentAnchorNode == null) {
            Log.i(TAG, "rebuilding AR session to enable cloud anchors")
            rebuildAR()
        }
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    /**
     * Arm/disarm session depth. Set from the `depthArmed` prop (= admin harness
     * mounted). Decides the session depthMode at CREATION via the direct composable
     * param, because SceneView ignores a post-hoc session.configure for these modes
     * (proven for cloudAnchorMode). Mirrors [setCloudAnchorsEnabled]: when it flips
     * on and a session already exists but nothing is placed, rebuild so the fresh
     * session is created with depthMode AUTOMATIC. Never set for regular users, so
     * their sessions stay depthMode DISABLED.
     */
    fun setDepthArmed(enabled: Boolean) {
        if (enabled == depthArmed) return
        Log.i(TAG, "setDepthArmed($enabled)")
        depthArmed = enabled
        if (enabled && composeView != null && currentAnchorNode == null) {
            Log.i(TAG, "rebuilding AR session to arm depth")
            rebuildAR()
        }
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    /**
     * Live on/off for depth occlusion (admin toggle). Only flips the captured
     * camera stream's occlusion flag — the depth texture is already produced when
     * [depthArmed] set depthMode AUTOMATIC at creation — so this needs no
     * reconfigure and a placed model is preserved. No-op until the stream exists.
     */
    fun setDepthOcclusionEnabled(enabled: Boolean) {
        if (enabled == depthOcclusionEnabled) return
        Log.i(TAG, "setDepthOcclusionEnabled($enabled) armed=$depthArmed")
        depthOcclusionEnabled = enabled
        try {
            arCameraStream?.let { it.isDepthOcclusionEnabled = enabled }
        } catch (t: Throwable) {
            Log.w(TAG, "camera-stream occlusion flip failed", t)
        }
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    /**
     * Start/stop the Geospatial harness. geospatialMode is a session-creation param
     * (SceneView ignores a post-hoc configure), so this mirrors [setDepthArmed]:
     * flip the flag and rebuild the session so it comes up ENABLED (start) or
     * DISABLED (stop). STOP therefore restores the normal session and the live AR
     * scene is unaffected afterward. Rebuild only when nothing is placed. Never set
     * for regular users ⇒ their sessions stay geospatialMode DISABLED.
     */
    fun setGeospatialEnabled(enabled: Boolean) {
        if (enabled == geospatialEnabled) return
        Log.i(GEO_TAG, "setGeospatialEnabled($enabled)")
        geospatialEnabled = enabled
        // Reset transition trackers so the fresh session logs its first states.
        lastEarthState = null
        lastEarthTracking = null
        geoTickCount = 0
        if (composeView != null && currentAnchorNode == null) {
            Log.i(GEO_TAG, "rebuilding AR session (geospatial=$enabled)")
            rebuildAR()
        }
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    /**
     * Per-frame Earth read while the geospatial harness is active. Logs
     * earthState/trackingState transitions immediately and the camera geospatial
     * pose (throttled ~1/sec) once Earth is ENABLED + TRACKING. Uses
     * orientationYawAccuracy (getHeadingAccuracy is deprecated). Fully guarded so a
     * geospatial hiccup never crashes the render session.
     */
    private fun logGeospatial(session: Session) {
        try {
            val earth = session.earth
            if (earth == null) {
                if (lastEarthState != "NO_EARTH") {
                    lastEarthState = "NO_EARTH"
                    Log.w(GEO_TAG, "session.earth is null (geospatial unavailable)")
                    // ADMIN-HARNESS (REMOVE AFTER KONARK)
                    emitGeospatialState("NO_EARTH", "-")
                }
                return
            }
            val earthState = try { earth.earthState.name } catch (_: Throwable) { "?" }
            val tracking = try { earth.trackingState.name } catch (_: Throwable) { "?" }
            var changed = false
            if (earthState != lastEarthState) {
                lastEarthState = earthState
                Log.i(GEO_TAG, "earthState -> $earthState")
                changed = true
            }
            if (tracking != lastEarthTracking) {
                lastEarthTracking = tracking
                Log.i(GEO_TAG, "trackingState -> $tracking")
                changed = true
            }
            // ADMIN-HARNESS (REMOVE AFTER KONARK) — push state transitions to the overlay.
            if (changed) emitGeospatialState(earthState, tracking)
            if (earth.earthState == Earth.EarthState.ENABLED &&
                earth.trackingState == TrackingState.TRACKING
            ) {
                geoTickCount++
                // ~1 log/sec at 60fps; state transitions above are unthrottled.
                if (geoTickCount % 60 == 1) {
                    val pose: GeospatialPose = earth.cameraGeospatialPose
                    Log.i(
                        GEO_TAG,
                        "pose lat=%.7f lon=%.7f horizAcc=%.2fm alt=%.2fm vertAcc=%.2fm orientationYawAccuracy=%.2fdeg".format(
                            pose.latitude,
                            pose.longitude,
                            pose.horizontalAccuracy,
                            pose.altitude,
                            pose.verticalAccuracy,
                            pose.orientationYawAccuracy,
                        ),
                    )
                    // ADMIN-HARNESS (REMOVE AFTER KONARK) — push pose accuracies (~1/sec) to the overlay.
                    emitGeospatialState(
                        earthState,
                        tracking,
                        pose.latitude,
                        pose.longitude,
                        pose.horizontalAccuracy,
                        pose.altitude,
                        pose.verticalAccuracy,
                        pose.orientationYawAccuracy,
                    )
                }
            }
        } catch (t: Throwable) {
            Log.w(GEO_TAG, "geospatial read failed", t)
        }
    }

    /**
     * Tear down and recreate the Compose AR surface so a fresh ARCore session is
     * created with the current [cloudAnchorsEnabled] flag applied by the
     * sessionConfiguration lambda. Only used by the dev cloud-anchor path, and
     * only before anything is placed, so no world content is lost.
     */
    private fun rebuildAR() {
        composeView?.let {
            try {
                removeView(it)
            } catch (t: Throwable) {
                Log.w(TAG, "rebuildAR removeView failed", t)
            }
        }
        composeView = null
        engine = null
        modelLoader = null
        materialLoader = null
        arSession = null
        arFrame = null
        arCameraStream = null // ADMIN-HARNESS (REMOVE AFTER KONARK)
        sceneRoot = null
        currentAnchorNode = null
        currentModelNode = null
        readyReported = false
        planeReported = false
        lastTrackingState = null
        setupAR()
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    private fun emitVpsResult(result: String, message: String? = null) {
        post { onVpsResult?.invoke(result, message) }
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    private fun emitGeospatialState(
        earthState: String,
        trackingState: String,
        latitude: Double? = null,
        longitude: Double? = null,
        horizontalAccuracy: Double? = null,
        altitude: Double? = null,
        verticalAccuracy: Double? = null,
        orientationYawAccuracy: Double? = null,
    ) {
        post {
            onGeospatialState?.invoke(
                earthState,
                trackingState,
                latitude,
                longitude,
                horizontalAccuracy,
                altitude,
                verticalAccuracy,
                orientationYawAccuracy,
            )
        }
    }

    private fun emitCloudAnchorEvent(
        phase: String,
        state: String,
        cloudAnchorId: String? = null,
        quality: String? = null,
        message: String? = null,
    ) {
        post { onCloudAnchorEvent?.invoke(phase, state, cloudAnchorId, quality, message) }
    }

    /**
     * Force Cloud Anchor mode ENABLED on the live session, right before a host or
     * resolve call. The prop-driven [setCloudAnchorsEnabled] + sessionConfiguration
     * lambda can race session creation on some devices (observed:
     * CloudAnchorsNotConfiguredException at host time), so we make the enable
     * just-in-time and idempotent here. We also flip [cloudAnchorsEnabled] true so
     * SceneView's per-frame config applier keeps the mode on afterwards (its lambda
     * reads this flag). Only ever reached from the dev host/resolve commands, so
     * release sessions — which never dispatch those — stay DISABLED. Returns true
     * once the session reports ENABLED.
     */
    private fun ensureCloudAnchorModeEnabled(session: Session): Boolean {
        cloudAnchorsEnabled = true
        return try {
            val config = session.config
            if (config.cloudAnchorMode != Config.CloudAnchorMode.ENABLED) {
                Log.i(TAG, "enabling cloudAnchorMode (was ${config.cloudAnchorMode})")
                config.cloudAnchorMode = Config.CloudAnchorMode.ENABLED
                session.configure(config)
            }
            session.config.cloudAnchorMode == Config.CloudAnchorMode.ENABLED
        } catch (t: Throwable) {
            Log.w(TAG, "ensureCloudAnchorModeEnabled failed", t)
            false
        }
    }

    /**
     * Dev harness: host the CURRENTLY placed anchor as a persistent Cloud Anchor.
     * Gates on [Session.estimateFeatureMapQualityForHosting] — an INSUFFICIENT map
     * aborts with guidance instead of burning a doomed host request. The async
     * result callback runs on the main thread (ARCore Future contract).
     *
     * Fully guarded: the command is dispatchable in release builds (where
     * cloudAnchorMode is always DISABLED), so every ARCore throw must surface as
     * an event, never a crash.
     */
    fun hostCloudAnchor(ttlDays: Int) {
        val session = arSession ?: run {
            emitCloudAnchorEvent("host", "ERROR_SESSION_NOT_READY")
            return
        }
        val anchor = currentAnchorNode?.anchor ?: run {
            emitCloudAnchorEvent("host", "ERROR_NO_ANCHOR", message = "place the model first")
            return
        }
        // Cancel-and-replace any stale in-flight host (its terminal event can be
        // swallowed while backgrounded) so a watchdog-driven retry actually runs
        // instead of being refused forever. cancel() guarantees the old callback
        // never fires.
        try {
            hostFuture?.cancel()
        } catch (_: Throwable) {
        }
        hostFuture = null
        // Force cloud-anchor mode on the live session NOW — prop-driven enabling
        // can lose the race with session creation on some devices.
        if (!ensureCloudAnchorModeEnabled(session)) {
            emitCloudAnchorEvent(
                "host",
                "ERROR_NOT_CONFIGURED",
                message = "could not enable cloud anchor mode",
            )
            return
        }
        val frame = arFrame
        val camera = try {
            frame?.camera?.takeIf { it.trackingState == TrackingState.TRACKING }
        } catch (_: Throwable) {
            null
        }
        if (camera == null) {
            emitCloudAnchorEvent("host", "ERROR_NOT_TRACKING")
            return
        }
        val quality = try {
            session.estimateFeatureMapQualityForHosting(camera.pose)
        } catch (t: Throwable) {
            // NotTracking / SessionPaused / CloudAnchorsNotConfigured all land here.
            Log.w(TAG, "estimateFeatureMapQualityForHosting failed", t)
            emitCloudAnchorEvent("host", "ERROR_QUALITY_CHECK_FAILED", message = t.message)
            return
        }
        if (quality == Session.FeatureMapQuality.INSUFFICIENT) {
            emitCloudAnchorEvent(
                "host",
                "INSUFFICIENT_QUALITY",
                quality = quality.name,
                message = "move around the object to map more of it, then try again",
            )
            return
        }
        emitCloudAnchorEvent("host", "HOSTING", quality = quality.name)
        hostFuture = try {
            session.hostCloudAnchorAsync(anchor, ttlDays.coerceIn(1, 365)) { id, state ->
                hostFuture = null
                emitCloudAnchorEvent(
                    "host",
                    state.name,
                    cloudAnchorId = id,
                    quality = quality.name,
                )
            }
        } catch (t: Throwable) {
            Log.w(TAG, "hostCloudAnchorAsync failed", t)
            emitCloudAnchorEvent("host", "ERROR_HOST_CALL_FAILED", message = t.message)
            null
        }
    }

    /**
     * Dev harness: resolve a previously hosted Cloud Anchor ID and attach the
     * current test model to the resolved pose. The callback runs on the main
     * thread; the model attaches via the same AnchorNode tail as [doPlaceInFront].
     */
    fun resolveCloudAnchor(cloudAnchorId: String) {
        val session = arSession ?: run {
            emitCloudAnchorEvent("resolve", "ERROR_SESSION_NOT_READY")
            return
        }
        if (cloudAnchorId.isBlank()) {
            emitCloudAnchorEvent("resolve", "ERROR_EMPTY_ID")
            return
        }
        // Cancel-and-replace any stale in-flight resolve (see hostCloudAnchor).
        try {
            resolveFuture?.cancel()
        } catch (_: Throwable) {
        }
        resolveFuture = null
        // Force cloud-anchor mode on the live session NOW (see hostCloudAnchor).
        if (!ensureCloudAnchorModeEnabled(session)) {
            emitCloudAnchorEvent(
                "resolve",
                "ERROR_NOT_CONFIGURED",
                cloudAnchorId = cloudAnchorId,
                message = "could not enable cloud anchor mode",
            )
            return
        }
        emitCloudAnchorEvent("resolve", "RESOLVING", cloudAnchorId = cloudAnchorId)
        resolveFuture = try {
            session.resolveCloudAnchorAsync(cloudAnchorId) { anchor, state ->
                resolveFuture = null
                if (state == Anchor.CloudAnchorState.SUCCESS && anchor != null) {
                    onCloudAnchorResolved(anchor, cloudAnchorId)
                } else {
                    try {
                        anchor?.detach()
                    } catch (_: Throwable) {
                    }
                    emitCloudAnchorEvent("resolve", state.name, cloudAnchorId = cloudAnchorId)
                }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "resolveCloudAnchorAsync failed", t)
            emitCloudAnchorEvent(
                "resolve",
                "ERROR_RESOLVE_CALL_FAILED",
                cloudAnchorId = cloudAnchorId,
                message = t.message,
            )
            null
        }
    }

    /**
     * Resolve-success tail — mirrors [doPlaceInFront]'s anchor adoption. The
     * callback can land after teardown (cleanup() nulls engine/sceneRoot), so
     * everything is null-guarded. If the GLB prop hasn't arrived yet (slow first
     * download), [setGlbUri]'s progressive-swap branch attaches the model to this
     * anchor when it lands.
     */
    private fun onCloudAnchorResolved(anchor: Anchor, cloudAnchorId: String) {
        val eng = engine
        val root = sceneRoot
        if (eng == null || root == null) {
            try {
                anchor.detach()
            } catch (_: Throwable) {
            }
            emitCloudAnchorEvent(
                "resolve",
                "ERROR_NODE_CREATE_FAILED",
                cloudAnchorId = cloudAnchorId,
                message = "AR scene torn down",
            )
            return
        }
        clearCurrentAnchor()
        val anchorNode = try {
            AnchorNode(eng, anchor).also { root.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "resolved anchor node create failed", t)
            try {
                anchor.detach()
            } catch (_: Throwable) {
            }
            emitCloudAnchorEvent(
                "resolve",
                "ERROR_NODE_CREATE_FAILED",
                cloudAnchorId = cloudAnchorId,
                message = t.message,
            )
            return
        }
        currentAnchorNode = anchorNode
        val uri = glbUri
        if (uri != null) {
            attachModel(anchorNode, uri)
        }
        emitCloudAnchorEvent(
            "resolve",
            "SUCCESS",
            cloudAnchorId = cloudAnchorId,
            message = if (uri == null) "resolved — model attaches when glbUri arrives" else null,
        )
    }

    /**
     * Dev harness: probe ARCore Geospatial VPS coverage at an arbitrary
     * (latitude, longitude) — the device's CURRENT location, passed down from JS —
     * and log the result under tag [VPS_TAG]. Uses a THROWAWAY bare [Session] — no
     * resume, no config, no camera — so it never touches the live AR scene; the
     * check is a network geo-lookup that works on an un-resumed session (Google's
     * documented temporary-session pattern).
     *
     * The check is async and the callback runs on the main thread, so the session
     * is closed INSIDE the callback (after logging) — closing it earlier would
     * cancel the future and the result would never arrive. Fully guarded: the
     * command is dispatchable in release, so a failure must log, never crash.
     */
    fun checkVps(latitude: Double, longitude: Double) {
        val session = try {
            Session(context)
        } catch (t: Throwable) {
            // UnavailableArcoreNotInstalled/ApkTooOld/SdkTooOld/DeviceNotCompatible.
            Log.e(VPS_TAG, "Session creation failed: ${t.message}", t)
            // ADMIN-HARNESS (REMOVE AFTER KONARK) — surface on the untethered overlay.
            emitVpsResult("SESSION_FAILED", t.message)
            return
        }
        try {
            session.checkVpsAvailabilityAsync(latitude, longitude) { availability ->
                val where = "current location (%.5f, %.5f)".format(latitude, longitude)
                when (availability) {
                    VpsAvailability.AVAILABLE ->
                        Log.i(VPS_TAG, "AVAILABLE at $where — VPS coverage present")
                    VpsAvailability.UNAVAILABLE ->
                        Log.i(VPS_TAG, "UNAVAILABLE at $where — no VPS coverage")
                    else ->
                        Log.w(VPS_TAG, "VPS check returned $availability at $where")
                }
                // ADMIN-HARNESS (REMOVE AFTER KONARK) — enum name to the overlay.
                emitVpsResult(availability.name)
                try {
                    session.close()
                } catch (t: Throwable) {
                    Log.w(VPS_TAG, "session close failed", t)
                }
            }
        } catch (t: Throwable) {
            Log.e(VPS_TAG, "checkVpsAvailabilityAsync failed: ${t.message}", t)
            // ADMIN-HARNESS (REMOVE AFTER KONARK)
            emitVpsResult("CALL_FAILED", t.message)
            try {
                session.close()
            } catch (_: Throwable) {
            }
        }
    }

    private fun clearCurrentAnchor() {
        // A live host future maps THIS anchor — detaching it mid-host is
        // undocumented ARCore territory, so cancel first (production no-op).
        try {
            hostFuture?.cancel()
        } catch (_: Throwable) {
        }
        hostFuture = null
        // Headlocked cards are parented to the scene (no anchor), so this must NOT
        // early-return on a null anchor — clean up cards explicitly in both cases.
        currentAnchorNode?.let { node ->
            try {
                sceneRoot?.removeChildNode(node)
            } catch (t: Throwable) {
                Log.w(TAG, "remove anchor node failed", t)
            }
            try {
                node.anchor.detach()
            } catch (t: Throwable) {
                Log.w(TAG, "anchor.detach failed", t)
            }
        }
        removeAllCardNodes()
        currentAnchorNode = null
        currentModelNode = null
        currentYawDeg = 0f
        pending = null
        cardsCameraLocked = false
    }

    /**
     * Detach every card placard from its actual parent — the anchor node (world-anchored
     * cards) or the scene (headlocked cards). Best-effort; a wrong-parent remove is a
     * harmless no-op we swallow.
     */
    private fun removeAllCardNodes() {
        val anchorNode = currentAnchorNode
        for (node in cardNodes) {
            try {
                anchorNode?.removeChildNode(node)
            } catch (_: Throwable) {
            }
            try {
                sceneRoot?.removeChildNode(node)
            } catch (_: Throwable) {
            }
        }
        cardNodes.clear()
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

    private fun attachModel(anchorNode: AnchorNode, glbUri: String) {
        val loader = modelLoader ?: run {
            post { onARError?.invoke("AR not ready") }
            return
        }
        try {
            loader.loadModelInstanceAsync(
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
                //     AR light it renders near-black — force dielectric so the diffuse
                //     path lights it.
                //  2) gltfpack's meshopt/quantization left the winding reversed, so
                //     back-face culling hid the camera-facing surfaces — the model
                //     showed as a black shell. setDoubleSided(true) renders both faces
                //     AND flips normals for the back side (plus cull NONE as backstop).
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
                    cardData?.let { attachCard(anchorNode, it) }
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
    private fun attachCard(anchorNode: AnchorNode, json: String) {
        removeCardNodes(anchorNode)
        addCardNode(anchorNode, json, Position(0f, 0.55f, 0f), 0.42f)
    }

    /** Render one card JSON to a bitmap and add it as a billboarded ImageNode. */
    private fun addCardNode(
        anchorNode: AnchorNode,
        json: String,
        position: Position,
        scale: Float,
    ) {
        val matl = materialLoader ?: return
        try {
            val bitmap = EpocheyeArCardRenderer.render(json) ?: return
            val node = ImageNode(matl, bitmap).apply {
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
        val frame = arFrame
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
        // Cancel in-flight Cloud Anchor futures BEFORE the anchor detach below and
        // the Compose disposal (session close) — in-flight behavior across
        // pause/close is undocumented. cleanup() runs twice (onDetachedFromWindow
        // + onDropViewInstance); null-after-cancel keeps it idempotent.
        try {
            hostFuture?.cancel()
        } catch (_: Throwable) {
        }
        hostFuture = null
        try {
            resolveFuture?.cancel()
        } catch (_: Throwable) {
        }
        resolveFuture = null
        clearCurrentAnchor()
        // Removing the ComposeView detaches it → DisposeOnDetachedFromWindow tears
        // down the composition, releasing the AR session + Filament engine.
        composeView?.let { removeView(it) }
        composeView = null
        engine = null
        modelLoader = null
        materialLoader = null
        arSession = null
        arFrame = null
        readyReported = false
        planeReported = false
        lastTrackingState = null
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (composeView == null) setupAR()
    }

    /**
     * Re-run a real measure + layout pass on this view and its children.
     *
     * React Native drives layout from its shadow tree and swallows requestLayout()
     * on the native view hierarchy. The AR surface (a SurfaceView added natively,
     * outside RN's shadow tree) calls requestLayout() when its surface is
     * (re)created so it can size/position the surface. RN drops that, so the surface
     * is never presented → BLACK SCREEN. Forcing this pass applies the geometry.
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
        super.onDetachedFromWindow()
        cleanup()
    }

    companion object {
        private const val TAG = "EpocheyeDetectARView"

        // Dev harness: VPS-availability probe log tag. Coordinates are the
        // device's CURRENT location, passed in from JS per call.
        private const val VPS_TAG = "VPS"

        // ADMIN-HARNESS (REMOVE AFTER KONARK) — geospatial pipeline log tag.
        private const val GEO_TAG = "GEO"
    }
}
