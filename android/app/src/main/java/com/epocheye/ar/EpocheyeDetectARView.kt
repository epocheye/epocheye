package com.epocheye.ar

import android.content.Context
import android.graphics.ImageFormat
import android.os.Build
import android.os.PowerManager
import android.graphics.Rect
import android.graphics.YuvImage
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.mutableStateOf
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
import io.github.sceneview.ar.ARDefaultCameraNode
import io.github.sceneview.ar.camera.ARCameraStream // ADMIN-HARNESS (REMOVE AFTER KONARK)
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.ar.scene.SceneUnderstanding
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
    /** See [setModelTrueScale]. Off by default so the detect→place path is unchanged. */
    private var modelTrueScale: Boolean = false
    private var currentYawDeg: Float = 0f
    /** Grounded card JSON (display_name/period/.../identity_confidence). */
    private var cardData: String? = null

    var onARReady: (() -> Unit)? = null

    /** Depth occlusion as it is ACTUALLY in force, read back from the camera stream. */
    var onDepthOcclusionState: ((Boolean) -> Unit)? = null
    var onPlaneDetected: (() -> Unit)? = null
    var onTrackingState: ((String) -> Unit)? = null
    var onAnchorPlaced: ((String) -> Unit)? = null

    /**
     * Site-readiness pipeline (PERMANENT). Two-point alignment: reports where the
     * author is standing, in the placement anchor's own frame, so JS can solve the
     * model transform from two marked features. (index, x, y, z, error-or-null).
     */
    var onAlignmentPoint: ((Int, Float, Float, Float, String?) -> Unit)? = null

    /** Android thermal status (level, isSevere) — see startThermalGuard. */
    var onThermalStatus: ((Int, Boolean) -> Unit)? = null
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

    // Site-readiness pipeline (PERMANENT product feature — NOT admin harness).
    // Geospatial anchor capture (authoring: read the placed model's WGS84 pose)
    // and placement (prod: create a geospatial anchor from a saved pose and
    // attach the model). phase = "capture" | "place"; pose fields present on a
    // successful capture. Requires the geospatial session to be TRACKING.
    var onGeospatialAnchorEvent: ((
        phase: String,
        state: String,
        message: String?,
        lat: Double?,
        lng: Double?,
        alt: Double?,
        qx: Double?,
        qy: Double?,
        qz: Double?,
        qw: Double?,
        horizontalAccuracy: Double?,
        orientationYawAccuracy: Double?,
    ) -> Unit)? = null

    // Discovery layer (Bangalore Fort and any authored site): a tap on a card or on
    // a named part of the reconstruction. `id` is the authored element id, so JS can
    // open the right detail sheet without a second round trip.
    var onElementTapped: ((id: String, kind: String, payload: String?) -> Unit)? = null

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

    /** Temporary anchor created at the aligned pose purely so it can be hosted. */
    private var hostTempAnchor: Anchor? = null
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

    /**
     * Whether geospatial is currently RUNNING, as opposed to merely armed.
     * Armed = the session was created able to do it; active = it is actually
     * localising and burning power. See [setGeospatialActive].
     */
    @Volatile private var geospatialActive = true
    private var lastEarthState: String? = null
    private var lastEarthTracking: String? = null
    /**
     * Wall-clock stamp of the last geospatial pose read, not a frame counter.
     *
     * This used to throttle on `frames % 60`, described in the code as "~1/sec at
     * 60fps". Switching the session to `UpdateMode.BLOCKING` halved the frame rate
     * and silently halved this too — the readout the admin watches while deciding
     * whether the fix has converged started updating every two seconds instead of
     * every one, with nothing in the code saying so. A frame-count throttle is a
     * rate that changes whenever the render rate changes; a clock is not.
     */
    private var lastGeoReadNanos = 0L

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

    // ── Discovery layer ──────────────────────────────────────────────────────
    // placeCardsOnly hangs up to `maxCards` cards on a fixed arc it generates itself.
    // A site discovery layer is the opposite: the author supplies the pose of every
    // card in the anchor's local frame, and there are more of them than six. These
    // nodes are deliberately kept OUT of `cardNodes` so the per-frame billboard loop
    // never touches them — a card hung on a wall must keep the wall's facing, not
    // swing to the camera.
    private class DiscoveryCard(
        val id: String,
        val node: ImageNode,
        val local: Position,
        val yawDeg: Float,
        val halfW: Float,
        val halfH: Float,
        val payload: String,
    )
    private val discoveryCards = mutableListOf<DiscoveryCard>()

    /** A named box in the anchor's local frame — how a tap resolves to part of the model. */
    private class TapTarget(
        val id: String,
        val minX: Float, val minY: Float, val minZ: Float,
        val maxX: Float, val maxY: Float, val maxZ: Float,
        val payload: String,
    )
    private val tapTargets = mutableListOf<TapTarget>()
    private var tapDownX = 0f
    private var tapDownY = 0f
    private var tapDownTimeMs = 0L

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

    // How long a Front placement waits for ARCore to report a tracked plane before
    // settling for a free-space anchor. Long enough for detection to catch up after
    // being re-enabled; short enough that a textureless room still gets a model.
    //
    // Measured on-device 2026-08-14: at 4 s, three of four placements fell through to
    // the free-space branch — including on a well-lit office floor — because plane
    // detection needs PARALLAX, and the seconds right after tapping Load are exactly
    // when the phone is held still to read the screen. A free-space anchor is the one
    // that drifts and tips, which is what "the model floats away" has meant every time.
    // Waiting is cheap and reversible; a drifting anchor costs a site visit.
    //
    // Revised 2026-08-15 down from 12 s. Twelve seconds of a blank screen after
    // tapping Load is what "the model loads very slowly" meant at Bangalore Fort —
    // the download is not the bottleneck (388 KB, 230 ms, edge-cached). Six seconds
    // still covers a sweep, without reading as a hang. The real answer to drift is
    // not a longer wait but a better fallback: see doPlaceInFront.
    private val planeWaitNanos = 6_000L * 1_000_000L
    private var planeWaitDeadlineNanos: Long = 0L

    /**
     * Whether continuous plane detection is currently wanted.
     *
     * Mirrors what [setPlaneFinding] last applied, so a session rebuild re-applies
     * it instead of silently reverting to HORIZONTAL_AND_VERTICAL — the most
     * expensive plane mode — for the rest of the session.
     */
    private var planeFindingWanted = true

    /**
     * Throttle for the per-frame trackable scan.
     *
     * `hasTrackedPlane` allocates a fresh collection from `getAllTrackables` on
     * every call. It was called every frame until the first plane appeared — and
     * standing 20-40 m from a fort outdoors, that can be the entire session, at
     * display refresh rate. Four times a second is far faster than a human can
     * react to and costs ~1/30th as much.
     */
    private var lastPlaneScanNanos = 0L
    private val planeScanIntervalNanos = 250L * 1_000_000L

    /** Last logged anchor tracking/visibility signature, so only changes print. */
    private var lastAnchorSig: String? = null

    /** Last EFFECTIVE depth-occlusion value read back from the camera stream. */
    private var lastEffectiveOcclusion: Boolean? = null

    /**
     * Depth occlusion as COMPOSE STATE.
     *
     * SceneView writes cameraStream.isDepthOcclusionEnabled from its
     * sceneUnderstanding.occlusion on every update. A plain Kotlin var is read
     * once at composition and never re-read, so the live toggle could never move
     * it — and writing the stream flag directly just created a value SceneView
     * immediately contradicted. Compose state makes the composable recompose, so
     * ONE value drives the whole thing and nothing fights.
     */
    private val occlusionState = mutableStateOf(false)

    // Alignment of the model WITHIN its anchor, in anchor-local metres. Applied to
    // the model node, folded into the captured geospatial pose, and applied to the
    // discovery layer so the cards travel with the walls they annotate.
    private var modelOffsetX = 0f
    private var modelOffsetY = 0f
    private var modelOffsetZ = 0f

    /** Cards as last requested, so alignment can re-place them unchanged. */
    private var lastDiscoveryCardsJson: String? = null

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
                    // A camera whose near clip plane is close enough to stand
                    // inside a building.
                    //
                    // A reconstruction is architecture, not an object on a table:
                    // visitors walk up to walls and through gateways, so geometry
                    // routinely ends up centimetres from the lens. Anything nearer
                    // than the near plane is clipped away, which reads as the fort
                    // "disappearing" as you approach — proven on-device 2026-08-10,
                    // where the anchor stayed TRACKING/PAUSED with nodeVisible=true
                    // and the model attached while nothing was drawn.
                    val arCamera = remember(eng) {
                        ARDefaultCameraNode(eng).apply {
                            try {
                                // Depth precision is governed by the near:far RATIO,
                                // and almost all of it sits near the near plane. An
                                // aggressive near of 0.02 m bought close-range viewing
                                // and paid for it with z-fighting across the whole
                                // model — surfaces flickering even with the camera
                                // still. 0.08 m still lets a visitor put the phone
                                // against a wall, and capping far at 400 m (the fort
                                // is 48 m across) recovers roughly two orders of
                                // magnitude of precision versus the default far.
                                near = 0.08f
                                far = 400f
                            } catch (t: Throwable) {
                                Log.w(TAG, "camera clip planes not set", t)
                            }
                        }
                    }
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
                        //
                        // And turn its SHADOWS OFF. SceneView's DefaultLightNode is
                        // created with castShadows(true), so Filament was rendering a
                        // full shadow-map depth pass over the whole scene every frame —
                        // including the 47 m fort, which has frustum culling disabled
                        // and so is in that pass even when it is behind the camera.
                        // The reconstruction is lit by a flat ambient IBL anyway, so the
                        // shadow map bought almost nothing visually and cost a second
                        // full scene traversal per frame. Intensity is free by
                        // comparison — it is a shader constant.
                        try {
                            mainLight?.let {
                                it.lightManager.setIntensity(it.lightInstance, 120_000f)
                                it.lightManager.setShadowCaster(it.lightInstance, false)
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
                        cameraNode = arCamera,
                        // SceneUnderstanding.occlusion is what actually drives the
                        // camera stream's depth occlusion: SceneView writes
                        // `cameraStream.isDepthOcclusionEnabled` from THIS value on
                        // every update, so our own SideEffect assignment was being
                        // stamped back over milliseconds later. That is why
                        // `setDepthOcclusionEnabled(true)` logged success while a
                        // hand still passed behind the model. Same trap as the
                        // geospatialMode lambda: a SceneView parameter silently
                        // overriding a post-hoc setting.
                        //
                        // lighting stays FALSE deliberately — ARCore light
                        // estimation left models pitch black indoors, which is why
                        // this scene uses its own bright diffuse IBL.
                        sceneUnderstanding = SceneUnderstanding(
                            // Must track the LIVE toggle, not just depthArmed.
                            //
                            // SceneView writes cameraStream.isDepthOcclusionEnabled
                            // from this value every update, while the SideEffect
                            // below writes it from depthOcclusionEnabled. Keying
                            // this off depthArmed alone made the two disagree the
                            // moment occlusion was switched off: SceneView kept
                            // re-enabling it, the toggle did nothing, and the stream
                            // sat in a contradictory half-configured state — the
                            // most likely cause of the whole scene, cards included,
                            // flickering. One source of truth, so they cannot fight.
                            occlusion = occlusionState.value,
                            lighting = false,
                            physics = false,
                            planeVisualization = false,
                        ),
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
                        // updateMode MUST be set here, as a direct composable param —
                        // NOT in the sessionConfiguration lambda below.
                        //
                        // This is the same trap as cloudAnchorMode and geospatialMode,
                        // and it caught us again. SceneView defaults this parameter to
                        // LATEST_CAMERA_IMAGE and applies it from its own
                        // LaunchedEffect(updateMode), which runs AFTER the lambda and
                        // wins. Setting BLOCKING in the lambda therefore did nothing.
                        //
                        // MEASURED on-device 2026-08-16, which is how we know: the
                        // per-frame GEO readout is throttled to every 60th tick and it
                        // was printing once a SECOND — i.e. 60 ticks/s, the display
                        // refresh rate, against a 30 fps camera. Three of every four
                        // frames were a full ARCore update plus a full Filament render
                        // of an identical image.
                        updateMode = Config.UpdateMode.BLOCKING,
                        sessionConfiguration = { _, config ->
                            // These two used to be hard-set to DISABLED here, which
                            // silently contradicted the geospatialMode/depthMode
                            // composable params set immediately above and won —
                            // proven on-device 2026-08-10:
                            //   "geospatial requested; ENABLED supported=true
                            //    sessionGeospatialMode=DISABLED"
                            //   "session.earth is null (geospatial unavailable)"
                            // ARCore returns a null Earth when the mode is DISABLED,
                            // so the whole geospatial pipeline was unreachable and
                            // read on screen as a site/coverage problem. Mirror the
                            // params instead of overriding them; production leaves
                            // both flags false, so both stay DISABLED there.
                            config.geospatialMode =
                                if (geospatialEnabled) Config.GeospatialMode.ENABLED
                                else Config.GeospatialMode.DISABLED
                            // Honour a plane-finding state that may already be OFF.
                            // A session rebuild used to hard-reset this to the most
                            // expensive mode, silently undoing every setPlaneFinding
                            // (false) the placement path had done.
                            config.planeFindingMode =
                                if (planeFindingWanted) {
                                    Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                                } else {
                                    Config.PlaneFindingMode.DISABLED
                                }
                            config.depthMode =
                                if (depthArmed) Config.DepthMode.AUTOMATIC
                                else Config.DepthMode.DISABLED
                            // Light estimation DISABLED — on this device it produced no
                            // usable scene light (models stayed black). Our own bright
                            // diffuse IBL (env above) is the only light source.
                            config.lightEstimationMode = Config.LightEstimationMode.DISABLED
                            config.focusMode = Config.FocusMode.AUTO
                            // BLOCKING, not LATEST_CAMERA_IMAGE.
                            //
                            // LATEST_CAMERA_IMAGE returns immediately, so SceneView's
                            // Choreographer loop ran a full ARCore update + a full
                            // Filament render + onSessionTick at the DISPLAY refresh
                            // rate — 90 or 120 Hz on a modern handset — against a
                            // camera that only produces 30 frames a second. Three out
                            // of every four frames redrew an identical image. That is a
                            // straight 2-4x multiplier on the entire render and
                            // per-frame cost, and it is the single largest contributor
                            // to the phone shutting down after 2-3 minutes at Bangalore
                            // Fort (2026-08-15). BLOCKING paces the loop to the camera.
                            config.updateMode = Config.UpdateMode.BLOCKING
                        },
                        onSessionCreated = { session ->
                            arSession = session
                            // A fresh session starts in whatever the composable param
                            // asked for, so the suspend flag must start agreeing with it.
                            geospatialActive = geospatialEnabled
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
                            if (pendingCards == null) {
                                if (reason != null) {
                                    post { onARError?.invoke(reason.name) }
                                } else {
                                    // Recovery. Without this the raw enum name from a
                                    // single momentary glitch sat on screen forever —
                                    // at Bangalore Fort a stale "BAD_STATE" was showing
                                    // while tracking was healthy and the model was
                                    // placed, which reads as a live fault and is not.
                                    // Empty string = "no current error"; every listener
                                    // maps it back to null.
                                    post { onARError?.invoke("") }
                                }
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
        // `geospatialActive`, not just armed: once suspended for power there is no
        // Earth to read and nothing worth reporting to JS.
        if (geospatialEnabled && geospatialActive) {
            logGeospatial(session)
        }
        // Read the occlusion flag BACK from the camera stream, rather than trusting
        // the value we wrote. SceneView drives this from its own
        // sceneUnderstanding.occlusion on every update, so a write that "succeeded"
        // could be stamped over a frame later — which is exactly how depth
        // occlusion appeared enabled while a hand still passed behind the model.
        // Logging the effective value makes that verifiable instead of assumed.
        if (depthArmed) {
            val effective = try {
                arCameraStream?.isDepthOcclusionEnabled
            } catch (_: Throwable) {
                null
            }
            if (effective != lastEffectiveOcclusion) {
                lastEffectiveOcclusion = effective
                Log.i(
                    TAG,
                    "depth occlusion EFFECTIVE=$effective (requested=$depthOcclusionEnabled)",
                )
                // Surface it on screen too. Whoever is standing at the site cannot
                // read logcat, and "I set the flag" has already proved to be a
                // different thing from "the flag is in force".
                post { onDepthOcclusionState?.invoke(effective == true) }
            }
        }
        // Throttled: see planeScanIntervalNanos. Once a plane has been reported this
        // stops entirely, so the steady-state cost is zero.
        if (!planeReported) {
            val now = System.nanoTime()
            if (now - lastPlaneScanNanos >= planeScanIntervalNanos) {
                lastPlaneScanNanos = now
                if (hasTrackedPlane(session)) {
                    planeReported = true
                    post { onPlaneDetected?.invoke() }
                }
            }
        }
        // Why did the model vanish? Log every transition of the things that can
        // hide it: the anchor's own tracking state (PAUSED/STOPPED), whether the
        // node still thinks it is visible, and whether the plane it hangs off has
        // been subsumed by a larger one (which STOPS its anchors permanently).
        run {
            val node = currentAnchorNode
            if (node != null) {
                val st = try {
                    node.anchor.trackingState.name
                } catch (_: Throwable) {
                    "?"
                }
                val vis = try {
                    node.isVisible
                } catch (_: Throwable) {
                    null
                }
                val sig = "$st/$vis/${currentModelNode != null}"
                if (sig != lastAnchorSig) {
                    lastAnchorSig = sig
                    Log.i(
                        TAG,
                        "anchor state -> tracking=$st nodeVisible=$vis " +
                            "model=${currentModelNode != null}",
                    )
                }
            }
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

    /**
     * Build an AnchorNode that does NOT blink out when ARCore momentarily loses
     * visual tracking.
     *
     * SceneView's AnchorNode renders only while the anchor's tracking state is in
     * `visibleTrackingStates`, which defaults to TRACKING alone. Walking up to a
     * reconstruction fills the camera with a close, low-texture surface — a wall —
     * and ARCore drops the anchor to PAUSED. The node then hides and the whole
     * fort disappears, reappearing a moment later when tracking recovers. That is
     * the flicker seen on-device 2026-08-10 when approaching the model and
     * stepping inside it.
     *
     * A world-locked heritage reconstruction must survive that: the pose is still
     * known, ARCore has simply stopped refining it, so the right behaviour is to
     * keep drawing at the last known pose. Visitors walk up to walls and step
     * inside gateways — that is the whole point of the experience — and the
     * building cannot vanish when they do.
     *
     * STOPPED is deliberately excluded: that means the anchor is permanently dead,
     * where continuing to draw would be a lie about where it is.
     */
    private fun newAnchorNode(eng: Engine, anchor: Anchor): AnchorNode {
        return AnchorNode(eng, anchor).apply {
            visibleTrackingStates = setOf(
                TrackingState.TRACKING,
                TrackingState.PAUSED,
            )
        }
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
     * True-to-life sizing: keep the GLB's own metres instead of normalising the
     * model to [modelScale] metres across. Set this for surveyed reconstructions;
     * leave it off for detected objects whose real size is unknown.
     */
    fun setModelTrueScale(enabled: Boolean) {
        modelTrueScale = enabled
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
        // Give the hit-test something to hit. attachModel turns plane finding OFF
        // once a model lands (to stop ARCore burning power growing planes), so
        // WITHOUT this every re-place after the first — including each preview
        // scale change — searched a session with plane detection switched off,
        // found nothing, and fell back to a free-space anchor that drifts.
        setPlaneFinding(true)
        planeWaitDeadlineNanos = System.nanoTime() + planeWaitNanos
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
                // Prefer a real surface. Plane detection needs a second or two of
                // parallax after it is switched back on, so hold the placement
                // briefly rather than instantly settling for a free-space anchor
                // that will drift. Bounded, so a textureless room still gets a
                // model instead of nothing.
                val session = arSession
                val planeReady = session != null && hasTrackedPlane(session)
                if (!planeReady && System.nanoTime() < planeWaitDeadlineNanos) {
                    return
                }
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
     * Anchor the model and attach it, preferring a REAL SURFACE.
     *
     * Prefers a plane hit-test through the screen centre and falls back to a
     * free-space point ~1.2 m ahead only when no plane is tracked yet.
     *
     * Why the plane matters, beyond looking right: a free-space anchor is pinned
     * to nothing the tracker can see, so every relocalisation moves it — indoors
     * on a plain surface the model visibly swims, tips and drifts out of frame.
     * A plane anchor is backed by a trackable ARCore keeps re-observing, so it
     * stays put. It also makes the model REST on the table instead of hanging in
     * mid-air at chest height, which is what "place it on the table" means.
     */
    private fun doPlaceInFront(frame: Frame) {
        val uri = glbUri ?: return
        val eng = engine ?: return
        val session = arSession ?: run {
            post { onARError?.invoke("AR session not ready") }
            return
        }
        // Screen centre → a tracked plane, accepting only a hit inside the plane's
        // own polygon (not its infinite extension), so the model lands on the real
        // surface rather than on a guess beyond its edge.
        val planeHit = try {
            frame.hitTest(width / 2f, height / 2f).firstOrNull { r ->
                val tr = r.trackable
                tr is Plane && tr.trackingState == TrackingState.TRACKING &&
                    tr.isPoseInPolygon(r.hitPose)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "plane hit-test failed", t)
            null
        }
        // Second tier: ARCore is tracking a plane, but the centre ray missed its
        // polygon — you are aiming past the desk edge, or across it at a steep
        // angle. Observed on-device: the status line read "Surface ✓" while every
        // placement still logged "no plane". Anchoring to that plane's own centre
        // is far better than free space: it is backed by a trackable ARCore keeps
        // re-observing, so it holds still instead of drifting.
        val nearestPlane: Plane? = if (planeHit != null) {
            null
        } else {
            try {
                val cam = frame.camera.pose
                session.getAllTrackables(Plane::class.java)
                    .filter { it.trackingState == TrackingState.TRACKING }
                    .minByOrNull { p ->
                        val c = p.centerPose
                        val dx = c.tx() - cam.tx()
                        val dy = c.ty() - cam.ty()
                        val dz = c.tz() - cam.tz()
                        dx * dx + dy * dy + dz * dz
                    }
            } catch (t: Throwable) {
                Log.w(TAG, "nearest-plane scan failed", t)
                null
            }
        }

        // Third tier: no plane anywhere, but ARCore Earth has a CONVERGED fix.
        //
        // A free-space anchor is pinned to nothing the tracker re-observes, so it
        // slides on every relocalisation — and with the fort extending 30 m from
        // its anchor, a fraction of a degree there is metres at the far wall. An
        // Earth anchor is re-solved against VPS every frame instead, so it holds.
        //
        // The accuracy gate is the whole point. A LOOSE Earth fix is worse than
        // free space, not better: the anchor jumps as the estimate converges, and
        // a jump after alignment throws away the alignment. 3 m is chosen against
        // this site — the fixes recorded in the Bangalore Fort courtyard were
        // +/-2.3 to +/-2.4 m, so a converged fix there passes and an unconverged
        // one indoors (measured +/-19 to +/-25 m at the desk) does not.
        val earthAnchorPose: Pose? = if (planeHit != null || nearestPlane != null) {
            null
        } else {
            try {
                val earth = session.earth
                if (earth != null &&
                    earth.earthState == Earth.EarthState.ENABLED &&
                    earth.trackingState == TrackingState.TRACKING
                ) {
                    val cam = frame.camera.pose
                    val fwd = cam.compose(Pose.makeTranslation(0f, 0f, -1.2f))
                    // Identity rotation, ground-estimated height: the same target
                    // the free-space tier builds, so the two tiers seat the model
                    // identically and only the anchor backing differs.
                    val y = if (modelTrueScale) cam.ty() - EYE_HEIGHT_M else fwd.ty()
                    val target = Pose.makeTranslation(fwd.tx(), y, fwd.tz())
                    val gp = earth.getGeospatialPose(target)
                    if (gp.horizontalAccuracy <= MAX_EARTH_FALLBACK_ACC_M) {
                        target
                    } else {
                        Log.i(
                            TAG,
                            "placeInFront: Earth fix too loose for a fallback anchor " +
                                "(horizAcc=%.1fm > %.1fm) — using free space"
                                    .format(gp.horizontalAccuracy, MAX_EARTH_FALLBACK_ACC_M),
                        )
                        null
                    }
                } else {
                    null
                }
            } catch (t: Throwable) {
                Log.w(TAG, "Earth fallback probe failed", t)
                null
            }
        }

        val anchor = try {
            when {
                planeHit != null -> {
                    Log.i(TAG, "placeInFront: anchored on plane (centre hit)")
                    planeHit.createAnchor()
                }
                nearestPlane != null -> {
                    Log.i(TAG, "placeInFront: anchored on NEAREST tracked plane")
                    nearestPlane.createAnchor(nearestPlane.centerPose)
                }
                earthAnchorPose != null -> {
                    val earth = session.earth!!
                    val gp = earth.getGeospatialPose(earthAnchorPose)
                    val q = gp.eastUpSouthQuaternion
                    Log.i(
                        TAG,
                        "placeInFront: no plane — anchored on EARTH " +
                            "(horizAcc=%.1fm)".format(gp.horizontalAccuracy),
                    )
                    post {
                        onARError?.invoke(
                            "placed without a surface, held by GPS + VPS. Sweep the " +
                                "phone across textured ground and tap Re-place for a " +
                                "steadier lock.",
                        )
                    }
                    earth.createAnchor(
                        gp.latitude,
                        gp.longitude,
                        gp.altitude,
                        q[0],
                        q[1],
                        q[2],
                        q[3],
                    )
                }
                else -> {
                    val cam = frame.camera.pose
                    val target = cam.compose(Pose.makeTranslation(0f, 0f, -1.2f))
                    // Drop a SURVEYED reconstruction to the estimated ground.
                    //
                    // Free space carries no floor, so the anchor used to inherit the
                    // camera's own height. For a detected object that is right — you
                    // want it at eye level. For a true-scale building it is not: this
                    // model's origin IS its ground course (y runs 0 → 13.52 m), so the
                    // fort materialised with its base at the admin's chest and every
                    // authoring session began by tapping "Down" fifteen times, at 1 m a
                    // press, while the real wall it had to meet was underfoot.
                    // Estimating the floor as eye-height below the camera is wrong by
                    // how far the phone is from a standing hold — centimetres, which the
                    // fine pad closes in a tap or two — instead of wrong by a storey.
                    val y = if (modelTrueScale) cam.ty() - EYE_HEIGHT_M else target.ty()
                    Log.i(
                        TAG,
                        "placeInFront: no tracked plane at all — free-space fallback " +
                            "1.2 m ahead (trueScale=$modelTrueScale, y=%.2f vs camera %.2f)"
                                .format(y, cam.ty()),
                    )
                    // Say so on screen. A free-space anchor is pinned to nothing the
                    // tracker keeps re-observing, so it moves on every relocalisation —
                    // and with a 47 m model extending 30 m from the anchor, a fraction
                    // of a degree there is metres at the far wall. That is the "it
                    // drifts away" reported from site, and until now the only sign it
                    // had happened was a line in logcat nobody at a monument can read.
                    post {
                        onARError?.invoke(
                            "placed WITHOUT a surface — it will drift. Sweep the phone " +
                                "across textured ground, then tap Re-place.",
                        )
                    }
                    // Identity rotation so the model stays upright rather than
                    // inheriting the camera's tilt.
                    session.createAnchor(Pose.makeTranslation(target.tx(), y, target.tz()))
                }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "createAnchor (front) failed", t)
            post { onARError?.invoke("anchor creation failed") }
            return
        }
        clearCurrentAnchor()
        val anchorNode = try {
            newAnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "anchor node create failed", t)
            post { onARError?.invoke("anchor node create failed") }
            return
        }
        currentAnchorNode = anchorNode
        // The anchor exists; continuous plane growth earns nothing from here on.
        // attachModel also does this, but only on its async SUCCESS path — so a GLB
        // that failed to load left the most expensive ARCore mode running for the
        // rest of the session with nothing to show for it.
        setPlaneFinding(false)
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
            newAnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
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
            newAnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
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
        reapplyDiscoveryLayer()
    }

    /**
     * Slide the model within its anchor, in the anchor's own axes (metres).
     * X = east-ish, Y = up, Z = south-ish relative to the anchor.
     *
     * Alignment needs BOTH degrees of freedom: yaw alone can never bring a
     * reconstruction onto a surviving wall, because the anchor lands wherever
     * the admin happened to be standing. Without translation the model is
     * simply in the wrong place and no amount of rotating fixes it.
     */
    fun nudgeModel(dx: Float, dy: Float, dz: Float) {
        val node = currentModelNode ?: return
        modelOffsetX += dx
        modelOffsetY += dy
        modelOffsetZ += dz
        try {
            node.position = Position(modelOffsetX, modelOffsetY, modelOffsetZ)
        } catch (t: Throwable) {
            Log.w(TAG, "model nudge failed", t)
            return
        }
        Log.i(
            TAG,
            "nudgeModel -> offset=(%.2f, %.2f, %.2f) yaw=%.1f".format(
                modelOffsetX, modelOffsetY, modelOffsetZ, currentYawDeg,
            ),
        )
        reapplyDiscoveryLayer()
    }

    /** Drop all alignment back to the anchor's own pose. */
    fun resetAlignment() {
        currentYawDeg = 0f
        modelOffsetX = 0f
        modelOffsetY = 0f
        modelOffsetZ = 0f
        try {
            currentModelNode?.let {
                it.rotation = Rotation(0f, 0f, 0f)
                it.position = Position(0f, 0f, 0f)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "reset alignment failed", t)
        }
        reapplyDiscoveryLayer()
    }

    /**
     * The model's pose relative to its anchor — the alignment the admin applied.
     * This is what makes the saved geospatial pose describe the RECONSTRUCTION
     * rather than the arbitrary spot the admin was standing on.
     */
    private fun modelLocalPose(): Pose {
        val yawRad = Math.toRadians(currentYawDeg.toDouble())
        val half = yawRad / 2.0
        val rot = Pose.makeRotation(
            0f,
            kotlin.math.sin(half).toFloat(),
            0f,
            kotlin.math.cos(half).toFloat(),
        )
        return Pose.makeTranslation(modelOffsetX, modelOffsetY, modelOffsetZ)
            .compose(rot)
    }

    /** Re-place the discovery layer so cards follow the model as it is aligned. */
    /**
     * Re-pose the discovery cards after an alignment nudge.
     *
     * This used to call [placeDiscoveryCards], which re-renders all 20 card bitmaps
     * and builds 20 fresh ImageNodes on EVERY nudge — while [removeAllDiscoveryCards]
     * only DETACHED the previous ones, never destroying their Filament textures. So
     * each tap of the alignment pad leaked 20 textures. Measured at Bangalore Fort
     * on 2026-08-15: the pad lagged, the phone cooked, and after a few dozen taps
     * Android killed the process for native memory — mid-authoring, losing the whole
     * alignment. That single bug ended the site visit.
     *
     * Nothing about a nudge changes a card's artwork; only its pose. So re-pose the
     * nodes that already exist: no bitmap render, no allocation, nothing to leak.
     * `local`/`yawDeg` hold the AUTHORED pose (see the DiscoveryCard construction),
     * so the current alignment composes onto them cleanly every time.
     */
    private fun reapplyDiscoveryLayer() {
        if (discoveryCards.isEmpty()) return
        val m = modelLocalPose()
        for (c in discoveryCards) {
            try {
                val a = m.transformPoint(floatArrayOf(c.local.x, c.local.y, c.local.z))
                c.node.position = Position(a[0], a[1], a[2])
                c.node.rotation = Rotation(0f, c.yawDeg + currentYawDeg, 0f)
            } catch (t: Throwable) {
                Log.w(TAG, "discovery card re-pose failed: ${c.id}", t)
            }
        }
    }

    /**
     * Take the discovery layer down and forget it.
     *
     * Hiding the cards from JS used to be cosmetic only: `lastDiscoveryCardsJson`
     * stayed set, so the nudge path kept rebuilding a layer the author could no
     * longer see, and there was no way to un-arm it short of killing the screen.
     */
    fun clearDiscoveryLayer() {
        removeAllDiscoveryCards()
        tapTargets.clear()
        lastDiscoveryCardsJson = null
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
        // Recorded even if the session is not up yet, so the creation lambda and any
        // later rebuild apply the same intent rather than defaulting back to ON.
        planeFindingWanted = enabled
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
        occlusionState.value = enabled && depthOcclusionEnabled
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
        // Drive the Compose state only. Writing arCameraStream.isDepthOcclusionEnabled
        // here as well would put a value in the stream that SceneView contradicts on
        // its next update — the half-configured state this whole fix is about.
        occlusionState.value = depthArmed && enabled
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
        lastGeoReadNanos = 0L
        if (composeView != null && currentAnchorNode == null) {
            Log.i(GEO_TAG, "rebuilding AR session (geospatial=$enabled)")
            rebuildAR()
        }
    }

    /**
     * Suspend or resume ARCore Geospatial on the LIVE session, without rebuilding it.
     *
     * Geospatial/VPS is the most power-hungry thing this view turns on: continuous
     * fine GPS, continuous network traffic, and on-device visual localisation running
     * alongside the normal tracker. It was enabled for the entire life of the screen
     * and never switched off, even once the pose it exists to produce had been banked.
     * That is a large share of why the phone shut down after 2-3 minutes at Bangalore
     * Fort (2026-08-15).
     *
     * Safe to do live: SceneView applies its `geospatialMode` parameter from a
     * `LaunchedEffect(geospatialMode)` (verified by decompiling arsceneview 4.18.0),
     * so it runs once per value change rather than every frame and will NOT stamp our
     * value back — unlike the traps this view has hit before.
     *
     * Only meaningful when geospatial was ARMED at session creation; ARCore will not
     * accept ENABLED on a session that was not created for it.
     */
    fun setGeospatialActive(active: Boolean) {
        if (!geospatialEnabled) {
            Log.i(GEO_TAG, "setGeospatialActive($active) ignored — never armed")
            return
        }
        if (active == geospatialActive) return
        val session = arSession ?: return
        try {
            val config = session.config
            config.geospatialMode =
                if (active) Config.GeospatialMode.ENABLED
                else Config.GeospatialMode.DISABLED
            session.configure(config)
            geospatialActive = active
            Log.i(GEO_TAG, "geospatial ${if (active) "RESUMED" else "SUSPENDED"} (power)")
        } catch (t: Throwable) {
            Log.w(GEO_TAG, "setGeospatialActive($active) failed", t)
        }
    }

    /**
     * Site-readiness pipeline (PERMANENT). Mark where the author is standing, in
     * the placement anchor's local frame, for two-point alignment.
     *
     * The camera pose is used deliberately, NOT a raycast. A hit-test needs a
     * detected plane or a depth sample, and a heritage reconstruction is aligned
     * against masonry 20-40 m away where ARCore has neither — depth is only
     * trustworthy to about 5 m. What ARCore IS good at over those distances is
     * knowing where the device itself has moved, so the author walks to the
     * feature and marks it by being there.
     *
     * Reported in the ANCHOR's frame because that is the frame the model node's
     * position and rotation live in, so JS can solve a transform and apply it
     * straight through nudgeYaw/nudgeModel.
     */
    fun markAlignmentPoint(index: Int) {
        val frame = arFrame ?: run {
            post { onAlignmentPoint?.invoke(index, 0f, 0f, 0f, "AR session not ready") }
            return
        }
        val anchor = currentAnchorNode?.anchor ?: run {
            post { onAlignmentPoint?.invoke(index, 0f, 0f, 0f, "place the model first") }
            return
        }
        val camera = frame.camera
        if (camera.trackingState != TrackingState.TRACKING) {
            // Marking while tracking is lost would record a stale pose and quietly
            // corrupt the alignment — the exact class of failure this feature exists
            // to remove.
            post {
                onAlignmentPoint?.invoke(
                    index, 0f, 0f, 0f,
                    "not tracking — move the phone slowly, then mark again",
                )
            }
            return
        }
        val local = try {
            anchor.pose.inverse().compose(camera.pose)
        } catch (t: Throwable) {
            Log.w(TAG, "markAlignmentPoint transform failed", t)
            post { onAlignmentPoint?.invoke(index, 0f, 0f, 0f, "could not read the camera pose") }
            return
        }
        Log.i(
            TAG,
            "markAlignmentPoint[%d] anchor-local (%.2f, %.2f, %.2f)".format(
                index, local.tx(), local.ty(), local.tz(),
            ),
        )
        post { onAlignmentPoint?.invoke(index, local.tx(), local.ty(), local.tz(), null) }
    }

    /**
     * Site-readiness pipeline (PERMANENT). Apply a solved alignment in one step:
     * absolute yaw and an absolute anchor-local offset, replacing whatever the
     * nudge pad had accumulated.
     *
     * Exists so a two-point solve lands atomically. Driving it as reset + nudgeYaw
     * + nudgeModel from JS works, but each of those re-poses the discovery layer
     * and emits its own frame, so a solve would visibly scatter the model through
     * three intermediate states before settling.
     */
    fun applyAlignment(yawDeg: Float, dx: Float, dy: Float, dz: Float) {
        val node = currentModelNode ?: return
        currentYawDeg = yawDeg % 360f
        modelOffsetX = dx
        modelOffsetY = dy
        modelOffsetZ = dz
        try {
            node.rotation = Rotation(0f, currentYawDeg, 0f)
            node.position = Position(modelOffsetX, modelOffsetY, modelOffsetZ)
        } catch (t: Throwable) {
            Log.w(TAG, "applyAlignment failed", t)
            return
        }
        Log.i(
            TAG,
            "applyAlignment yaw=%.2f offset=(%.2f, %.2f, %.2f)".format(
                currentYawDeg, modelOffsetX, modelOffsetY, modelOffsetZ,
            ),
        )
        reapplyDiscoveryLayer()
    }

    // Site-readiness pipeline (PERMANENT product feature). Authoring: read the
    // WGS84 geospatial pose of the currently-placed model (local anchor → Earth
    // frame) so it can be saved to a viewing station. Requires geospatial ENABLED
    // + Earth TRACKING and a placed anchor. Result → onGeospatialAnchorEvent.
    fun captureGeospatialPose() {
        val session = arSession ?: run {
            emitGeoAnchor("capture", "ERROR_SESSION_NOT_READY")
            return
        }
        val earth = session.earth
        if (earth == null || earth.earthState != Earth.EarthState.ENABLED ||
            earth.trackingState != TrackingState.TRACKING
        ) {
            emitGeoAnchor("capture", "ERROR_EARTH_NOT_TRACKING")
            return
        }
        val node = currentAnchorNode ?: run {
            emitGeoAnchor("capture", "ERROR_NO_ANCHOR", "place the model first")
            return
        }
        val anchorPose = node.anchor?.pose ?: run {
            emitGeoAnchor("capture", "ERROR_NO_POSE")
            return
        }
        // Capture where the RECONSTRUCTION is, not where the anchor happens to be.
        //
        // The anchor lands wherever the admin was standing when they pressed Load.
        // Every bit of alignment — the yaw that puts the model's walls on the real
        // walls, and the translation that slides it onto them — lives on the MODEL
        // node, as a transform relative to that anchor. Capturing the bare anchor
        // pose therefore threw all of it away: the station saved the admin's
        // standing spot with an arbitrary heading, and visitors would have seen the
        // fort offset and rotated. Compose the two so the saved WGS84 pose is the
        // model's own.
        val pose = anchorPose.compose(modelLocalPose())
        Log.i(
            GEO_TAG,
            "capture: folding alignment yaw=%.1f offset=(%.2f, %.2f, %.2f) into the saved pose"
                .format(currentYawDeg, modelOffsetX, modelOffsetY, modelOffsetZ),
        )
        val geo = try {
            earth.getGeospatialPose(pose)
        } catch (t: Throwable) {
            Log.e(GEO_TAG, "getGeospatialPose failed", t)
            emitGeoAnchor("capture", "ERROR_READ_FAILED", t.message)
            return
        }
        // EastUpSouth quaternion [x, y, z, w] — the same frame createAnchor expects.
        val q = try { geo.eastUpSouthQuaternion } catch (_: Throwable) { floatArrayOf(0f, 0f, 0f, 1f) }
        val cam = try { earth.cameraGeospatialPose } catch (_: Throwable) { null }
        emitGeoAnchor(
            "capture", "SUCCESS", null,
            geo.latitude, geo.longitude, geo.altitude,
            q.getOrElse(0) { 0f }.toDouble(),
            q.getOrElse(1) { 0f }.toDouble(),
            q.getOrElse(2) { 0f }.toDouble(),
            q.getOrElse(3) { 1f }.toDouble(),
            cam?.horizontalAccuracy,
            cam?.orientationYawAccuracy,
        )
    }

    // Site-readiness pipeline (PERMANENT). Prod resolve + authoring re-verify:
    // create a geospatial (WGS84) anchor from a saved pose and attach the current
    // glbUri model to it, world-locked. Requires geospatial ENABLED + TRACKING.
    // Result → onGeospatialAnchorEvent (phase "place").
    fun placeGeospatialAnchor(
        lat: Double,
        lng: Double,
        alt: Double,
        qx: Float,
        qy: Float,
        qz: Float,
        qw: Float,
    ) {
        val session = arSession ?: run {
            emitGeoAnchor("place", "ERROR_SESSION_NOT_READY")
            return
        }
        val earth = session.earth
        if (earth == null || earth.earthState != Earth.EarthState.ENABLED ||
            earth.trackingState != TrackingState.TRACKING
        ) {
            emitGeoAnchor("place", "ERROR_EARTH_NOT_TRACKING")
            return
        }
        val eng = engine ?: run {
            emitGeoAnchor("place", "ERROR_NOT_READY")
            return
        }
        val root = sceneRoot ?: run {
            emitGeoAnchor("place", "ERROR_NOT_READY")
            return
        }
        val anchor = try {
            earth.createAnchor(lat, lng, alt, qx, qy, qz, qw)
        } catch (t: Throwable) {
            Log.e(GEO_TAG, "createAnchor failed", t)
            emitGeoAnchor("place", "ERROR_CREATE_FAILED", t.message)
            return
        }
        clearCurrentAnchor()
        val anchorNode = try {
            newAnchorNode(eng, anchor).also { root.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(GEO_TAG, "geo anchor node create failed", t)
            try { anchor.detach() } catch (_: Throwable) {}
            emitGeoAnchor("place", "ERROR_NODE_FAILED")
            return
        }
        currentAnchorNode = anchorNode
        // The saved pose already IS the aligned model pose (see captureGeospatialPose),
        // so the model must sit on this anchor with no extra transform. Without this
        // reset, an admin who re-verifies straight after capturing would have their
        // alignment applied a second time on top of itself.
        currentYawDeg = 0f
        modelOffsetX = 0f
        modelOffsetY = 0f
        modelOffsetZ = 0f
        val uri = glbUri
        if (uri != null) {
            attachModel(anchorNode, uri)
        }
        emitGeoAnchor("place", "SUCCESS")
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
                // Once every GEO_READ_INTERVAL_NANOS of WALL CLOCK, whatever the
                // frame rate. State transitions above stay unthrottled — those are
                // the ones you must not miss.
                val now = System.nanoTime()
                if (now - lastGeoReadNanos >= GEO_READ_INTERVAL_NANOS) {
                    lastGeoReadNanos = now
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
    /**
     * Coalesce rebuild requests to one per frame.
     *
     * cloudAnchorsEnabled, depthArmed and geospatialEnabled all arrive from JS as
     * separate prop writes at mount, and each independently asked for a rebuild —
     * so a screen that sets all three tore down and recreated the ARCore session
     * and the Filament engine up to THREE times in the first seconds, before the
     * user had done anything. Posting collapses them into a single rebuild with
     * every flag already in its final state.
     */
    private val rebuildRunnable = Runnable { rebuildARNow() }

    private fun rebuildAR() {
        removeCallbacks(rebuildRunnable)
        post(rebuildRunnable)
    }

    private fun rebuildARNow() {
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

    // Site-readiness pipeline (PERMANENT).
    private fun emitGeoAnchor(
        phase: String,
        state: String,
        message: String? = null,
        lat: Double? = null,
        lng: Double? = null,
        alt: Double? = null,
        qx: Double? = null,
        qy: Double? = null,
        qz: Double? = null,
        qw: Double? = null,
        horizontalAccuracy: Double? = null,
        orientationYawAccuracy: Double? = null,
    ) {
        post {
            onGeospatialAnchorEvent?.invoke(
                phase, state, message,
                lat, lng, alt, qx, qy, qz, qw,
                horizontalAccuracy, orientationYawAccuracy,
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
        val placementAnchor = currentAnchorNode?.anchor ?: run {
            emitCloudAnchorEvent("host", "ERROR_NO_ANCHOR", message = "place the model first")
            return
        }
        // Host the ALIGNED pose, not the placement anchor.
        //
        // The placement anchor is wherever the admin stood; the alignment onto the
        // real walls is a transform of the MODEL relative to it. captureGeospatialPose
        // folds that in, but hosting the bare anchor did not — and on resolve the
        // visitor's model is attached with NO local transform, and the resolved cloud
        // anchor REPLACES the geospatial one. So hosting used to make placement
        // strictly worse: every visitor saw the fort displaced and rotated by exactly
        // the alignment the admin had worked to apply, on a 365-day TTL.
        //
        // Hosting a temporary anchor built at the aligned pose makes the resolved
        // anchor the model's own pose, which is what the zero-transform attach on the
        // visitor side already assumes.
        val alignedAnchor: Anchor? = try {
            session.createAnchor(placementAnchor.pose.compose(modelLocalPose()))
        } catch (t: Throwable) {
            Log.w(TAG, "aligned host anchor failed; hosting placement anchor", t)
            null
        }
        val anchor = alignedAnchor ?: placementAnchor
        // Detached after the host resolves — see hostFuture's completion handler.
        hostTempAnchor = alignedAnchor
        Log.i(
            TAG,
            "hostCloudAnchor: hosting %s pose (yaw=%.1f offset=%.2f,%.2f,%.2f)".format(
                if (alignedAnchor != null) "ALIGNED" else "raw placement",
                currentYawDeg, modelOffsetX, modelOffsetY, modelOffsetZ,
            ),
        )
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
                // The aligned anchor existed only to be hosted; the scene keeps
                // using the placement anchor, so release it either way.
                try {
                    hostTempAnchor?.detach()
                } catch (_: Throwable) {
                }
                hostTempAnchor = null
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
            newAnchorNode(eng, anchor).also { root.addChildNode(it) }
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
        // The model now hangs off the CLOUD anchor; the geospatial anchor it was on
        // has been cleared. Nothing left in this session needs Earth, so stop paying
        // for it — this is the one place geospatial can be dropped with no loss at
        // all, and it is also the steady state a visitor sits in for many minutes.
        setGeospatialActive(false)
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

    // ── Discovery layer: authored poses, and tap-to-identify ─────────────────

    /**
     * Place a whole authored discovery layer on ONE anchor.
     *
     * [cardsJson] is a JSON array; each element carries the card fields
     * EpocheyeArCardRenderer already reads, plus its pose in the anchor's local
     * frame:
     *
     *   { "id": "bfort_card_breach",
     *     "x": 6.73, "y": 1.45, "z": -5.29,   // metres, anchor-local
     *     "yaw": 138.8,                        // degrees about +Y; the face normal
     *     "w": 1.75,                           // card width in metres
     *     ...display_name / period / narrative / ... }
     *
     * Unlike placeCardsOnly there is no six-card cap and no generated arc: the
     * author decided where every card goes, so this method only obeys. The anchor
     * comes from a plane hit under the aim point when there is one, otherwise from
     * a point ~1.5 m ahead — a resolved Cloud Anchor is the intended production
     * source, and callers should resolve first and then call this.
     */
    fun placeDiscoveryCards(cardsJson: String) {
        lastDiscoveryCardsJson = cardsJson
        val eng = engine ?: run {
            post { onARError?.invoke("engine not ready") }
            return
        }
        val session = arSession ?: run {
            post { onARError?.invoke("session not ready") }
            return
        }
        val frame = arFrame ?: run {
            post { onARError?.invoke("no frame") }
            return
        }
        val cards = try {
            JSONArray(cardsJson)
        } catch (t: Throwable) {
            post { onARError?.invoke("discovery cards json invalid") }
            return
        }
        if (cards.length() == 0) return

        val anchor = try {
            val existing = currentAnchorNode?.anchor
            if (existing != null) {
                // ALWAYS re-use the anchor the model is already on, whatever its
                // tracking state.
                //
                // This used to require TRACKING. When the model's anchor was merely
                // PAUSED — routine indoors, and for the first seconds after any
                // placement — a second anchor was created here, the identity check
                // below then failed, and `clearCurrentAnchor()` tore down the
                // model's anchor node with the model on it. Showing the cards
                // deleted the reconstruction. The layer's poses are authored in
                // this anchor's local frame, so a different anchor is wrong even
                // when it does not destroy anything.
                existing
            } else {
                val hit = try {
                    frame.hitTest(width / 2f, height / 2f).firstOrNull { r ->
                        val tr = r.trackable
                        tr is Plane && tr.trackingState == TrackingState.TRACKING &&
                            tr.isPoseInPolygon(r.hitPose)
                    }
                } catch (_: Throwable) {
                    null
                }
                if (hit != null) {
                    hit.createAnchor()
                } else {
                    val target = frame.camera.pose.compose(Pose.makeTranslation(0f, 0f, -1.5f))
                    session.createAnchor(Pose.makeTranslation(target.tx(), target.ty(), target.tz()))
                }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "placeDiscoveryCards anchor failed", t)
            post { onARError?.invoke("anchor creation failed") }
            return
        }

        // Only ever build a NEW anchor node when there is genuinely no current one.
        // `clearCurrentAnchor()` also removes the model, so reaching it while a
        // reconstruction is placed is a bug, not a fallback.
        val anchorNode = currentAnchorNode?.takeIf { it.anchor === anchor } ?: run {
            clearCurrentAnchor()
            try {
                newAnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
            } catch (t: Throwable) {
                Log.e(TAG, "discovery anchor node create failed", t)
                post { onARError?.invoke("anchor node create failed") }
                return
            }
        }
        currentAnchorNode = anchorNode
        removeAllDiscoveryCards()

        val matl = materialLoader
        var placed = 0
        for (i in 0 until cards.length()) {
            val obj = cards.optJSONObject(i) ?: continue
            val id = obj.optString("id", "card_$i")
            val json = obj.toString()
            if (matl == null) continue
            try {
                val bitmap = EpocheyeArCardRenderer.renderDiscovery(json)
                    ?: EpocheyeArCardRenderer.render(json)
                    ?: continue
                // ImageNode extends PlaneNode and takes an explicit size in METRES, so
                // the card is built at its authored width rather than scale-guessed
                // from the bitmap's pixel count. Height follows the bitmap's aspect.
                val widthM = obj.optDouble("w", 1.75).toFloat()
                val heightM = widthM * bitmap.height.toFloat() / bitmap.width.toFloat()
                // Cards are authored in the MODEL's frame but hang off the ANCHOR,
                // so the admin's alignment has to be applied to them by hand or the
                // annotations slide off the walls they describe the moment the
                // model is nudged.
                val authored = floatArrayOf(
                    obj.optDouble("x", 0.0).toFloat(),
                    obj.optDouble("y", 1.5).toFloat(),
                    obj.optDouble("z", 0.0).toFloat(),
                )
                val aligned = modelLocalPose().transformPoint(authored)
                val local = Position(aligned[0], aligned[1], aligned[2])
                val yaw = obj.optDouble("yaw", 0.0).toFloat() + currentYawDeg
                val node = ImageNode(
                    materialLoader = matl,
                    bitmap = bitmap,
                    size = Position(widthM, heightM, 0f),
                ).apply {
                    this.position = local
                    this.rotation = Rotation(0f, yaw, 0f)
                }
                anchorNode.addChildNode(node)
                val halfW = widthM / 2f
                val halfH = heightM / 2f
                // Hit-testing happens in the MODEL's frame (see hitTestElements),
                // so record the AUTHORED pose here, not the aligned one the node is
                // rendered at — otherwise the alignment would be applied twice and
                // every card tap would miss by exactly the offset.
                discoveryCards.add(
                    DiscoveryCard(
                        id,
                        node,
                        Position(authored[0], authored[1], authored[2]),
                        yaw - currentYawDeg,
                        halfW,
                        halfH,
                        json,
                    ),
                )
                placed++
            } catch (t: Throwable) {
                Log.w(TAG, "discovery card skipped: $id", t)
            }
        }
        if (placed == 0) {
            post { onARError?.invoke("no discovery cards could be rendered") }
            return
        }
        setPlaneFinding(false)
        cardsCameraLocked = false
        post { onAnchorPlaced?.invoke("discovery_layer") }
    }

    /**
     * Register the named parts of the reconstruction a tap can resolve to.
     * [targetsJson] is an array of { id, min:[x,y,z], max:[x,y,z], ...payload },
     * all in the anchor's local frame — the same frame the discovery poses use.
     * Boxes are tested nearest-first, so overlapping boxes resolve to the closest.
     */
    fun setTapTargets(targetsJson: String) {
        tapTargets.clear()
        val arr = try {
            JSONArray(targetsJson)
        } catch (t: Throwable) {
            post { onARError?.invoke("tap targets json invalid") }
            return
        }
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val mn = o.optJSONArray("min") ?: continue
            val mx = o.optJSONArray("max") ?: continue
            if (mn.length() < 3 || mx.length() < 3) continue
            tapTargets.add(
                TapTarget(
                    o.optString("id", "target_$i"),
                    mn.optDouble(0).toFloat(), mn.optDouble(1).toFloat(), mn.optDouble(2).toFloat(),
                    mx.optDouble(0).toFloat(), mx.optDouble(1).toFloat(), mx.optDouble(2).toFloat(),
                    o.toString(),
                ),
            )
        }
    }

    override fun onTouchEvent(event: android.view.MotionEvent): Boolean {
        when (event.actionMasked) {
            android.view.MotionEvent.ACTION_DOWN -> {
                tapDownX = event.x
                tapDownY = event.y
                tapDownTimeMs = System.currentTimeMillis()
                return true
            }
            android.view.MotionEvent.ACTION_UP -> {
                val dx = event.x - tapDownX
                val dy = event.y - tapDownY
                val moved = dx * dx + dy * dy
                val heldMs = System.currentTimeMillis() - tapDownTimeMs
                // A tap, not a drag and not a long press. 24 px slop matches the
                // platform touch slop closely enough for a full-screen AR surface.
                if (moved <= 24f * 24f && heldMs <= 500L) {
                    hitTestElements(event.x, event.y)
                }
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    /**
     * Resolve a screen tap to an authored element.
     *
     * Deliberately NOT Filament/SceneView node picking: everything here is placed
     * relative to one ARCore anchor whose pose we already have, so the ray test is
     * done in the anchor's local frame with ARCore's own Pose maths. That keeps the
     * result NAMED (picking would hand back an untagged node) and keeps it working
     * across SceneView upgrades.
     *
     * Cards are tested first — a card in front of a wall should win over the wall.
     */
    private fun hitTestElements(screenX: Float, screenY: Float) {
        if (discoveryCards.isEmpty() && tapTargets.isEmpty()) return
        val frame = arFrame ?: return
        val anchorPose = currentAnchorNode?.anchor?.pose ?: return
        if (width <= 0 || height <= 0) return

        val view = FloatArray(16)
        val proj = FloatArray(16)
        val vp = FloatArray(16)
        val inv = FloatArray(16)
        try {
            frame.camera.getViewMatrix(view, 0)
            frame.camera.getProjectionMatrix(proj, 0, 0.05f, 200f)
        } catch (t: Throwable) {
            return
        }
        android.opengl.Matrix.multiplyMM(vp, 0, proj, 0, view, 0)
        if (!android.opengl.Matrix.invertM(inv, 0, vp, 0)) return

        val ndcX = 2f * screenX / width.toFloat() - 1f
        val ndcY = 1f - 2f * screenY / height.toFloat()
        val near = FloatArray(4)
        val far = FloatArray(4)
        android.opengl.Matrix.multiplyMV(near, 0, inv, 0, floatArrayOf(ndcX, ndcY, -1f, 1f), 0)
        android.opengl.Matrix.multiplyMV(far, 0, inv, 0, floatArrayOf(ndcX, ndcY, 1f, 1f), 0)
        if (near[3] == 0f || far[3] == 0f) return
        val ox = near[0] / near[3]
        val oy = near[1] / near[3]
        val oz = near[2] / near[3]
        var dx = far[0] / far[3] - ox
        var dy = far[1] / far[3] - oy
        var dz = far[2] / far[3] - oz
        val dlen = kotlin.math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dlen <= 1e-6f) return
        dx /= dlen; dy /= dlen; dz /= dlen

        // Into the MODEL's local frame, where every authored pose lives.
        //
        // Cards carry their own aligned pose, but the 135 tap-target boxes are
        // axis-aligned in the model's frame — so once the admin nudges the model,
        // testing the ray in the ANCHOR frame misses every one of them. Folding the
        // alignment into the inverse here keeps the boxes axis-aligned (a yawed box
        // would break the slab test outright) and makes taps land after any nudge.
        val invPose = anchorPose.compose(modelLocalPose()).inverse()
        val lo = invPose.transformPoint(floatArrayOf(ox, oy, oz))
        val ld = invPose.rotateVector(floatArrayOf(dx, dy, dz))

        var bestT = Float.MAX_VALUE
        var bestId: String? = null
        var bestKind = ""
        var bestPayload: String? = null

        for (c in discoveryCards) {
            val rad = Math.toRadians(c.yawDeg.toDouble())
            val s = kotlin.math.sin(rad).toFloat()
            val co = kotlin.math.cos(rad).toFloat()
            // ImageNode's face is +Z locally; yaw about +Y turns it.
            val nx = s; val nz = co
            val denom = ld[0] * nx + ld[2] * nz
            if (kotlin.math.abs(denom) < 1e-5f) continue
            val t = ((c.local.x - lo[0]) * nx + (c.local.z - lo[2]) * nz) / denom
            if (t <= 0f || t >= bestT) continue
            val px = lo[0] + ld[0] * t
            val py = lo[1] + ld[1] * t
            val pz = lo[2] + ld[2] * t
            // Right vector of a +Z-facing quad yawed by `yaw`.
            val rx = co; val rz = -s
            val u = (px - c.local.x) * rx + (pz - c.local.z) * rz
            val v = py - c.local.y
            if (kotlin.math.abs(u) <= c.halfW && kotlin.math.abs(v) <= c.halfH) {
                bestT = t; bestId = c.id; bestKind = "card"; bestPayload = c.payload
            }
        }

        if (bestId == null) {
            for (b in tapTargets) {
                val t = rayBoxT(lo, ld, b) ?: continue
                if (t < bestT) {
                    bestT = t; bestId = b.id; bestKind = "element"; bestPayload = b.payload
                }
            }
        }

        val id = bestId ?: return
        val kind = bestKind
        val payload = bestPayload
        post { onElementTapped?.invoke(id, kind, payload) }
    }

    /** Slab test; returns the near intersection distance, or null when the ray misses. */
    private fun rayBoxT(o: FloatArray, d: FloatArray, b: TapTarget): Float? {
        var tmin = 0f
        var tmax = Float.MAX_VALUE
        val mn = floatArrayOf(b.minX, b.minY, b.minZ)
        val mx = floatArrayOf(b.maxX, b.maxY, b.maxZ)
        for (i in 0..2) {
            if (kotlin.math.abs(d[i]) < 1e-6f) {
                if (o[i] < mn[i] || o[i] > mx[i]) return null
            } else {
                val inv = 1f / d[i]
                var t1 = (mn[i] - o[i]) * inv
                var t2 = (mx[i] - o[i]) * inv
                if (t1 > t2) { val tmp = t1; t1 = t2; t2 = tmp }
                if (t1 > tmin) tmin = t1
                if (t2 < tmax) tmax = t2
                if (tmin > tmax) return null
            }
        }
        return if (tmin > 0f) tmin else null
    }

    private fun removeAllDiscoveryCards() {
        for (c in discoveryCards) {
            try {
                currentAnchorNode?.removeChildNode(c.node)
            } catch (t: Throwable) {
                Log.w(TAG, "remove discovery card failed", t)
            }
            // Detaching a node from the scene graph does NOT free the Filament
            // texture ImageNode built from its bitmap — only destroy() does. Twenty
            // cards rebuilt without this is twenty leaked textures per rebuild.
            try {
                c.node.destroy()
            } catch (t: Throwable) {
                Log.w(TAG, "destroy discovery card failed", t)
            }
        }
        discoveryCards.clear()
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
        removeAllDiscoveryCards()
        removeAllCardNodes()
        currentAnchorNode = null
        currentModelNode = null
        currentYawDeg = 0f
        // Offsets MUST reset with the yaw. A re-place rebuilds the model node at
        // (0,0,0), so leaving them set makes what is captured disagree with what is
        // on screen: the fort snaps back to the anchor while the stale translation
        // is still folded into the saved pose, world-locking the station somewhere
        // the admin never saw.
        modelOffsetX = 0f
        modelOffsetY = 0f
        modelOffsetZ = 0f
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
            // See removeAllDiscoveryCards: detach frees nothing, destroy() does.
            try {
                node.destroy()
            } catch (_: Throwable) {
            }
        }
        cardNodes.clear()
    }

    /** Detach + destroy + forget all card placards (best-effort). */
    private fun removeCardNodes(anchorNode: AnchorNode) {
        for (node in cardNodes) {
            try {
                anchorNode.removeChildNode(node)
            } catch (_: Throwable) {
            }
            try {
                node.destroy()
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
                // The winding fix-ups are for the RECOMPRESSED heritage GLBs only.
                //
                // A surveyed reconstruction must NOT get them. Bangalore Fort's GLB is
                // written by our own direct glTF writer — no gltfpack, no meshopt, no
                // extensions — and its material declares `doubleSided: false`
                // deliberately. That flag is load-bearing: the grounding core ships with
                // its inner face omitted (…__NO-INNER-FACE) precisely so that back-face
                // culling makes it invisible from the courtyard and solid from outside.
                // Forcing doubleSided + CullingMode.NONE overrode that intent, so the
                // app rendered wall interiors and the backs of faces that were meant to
                // be absent — painting geometry over the real masonry in the camera
                // feed, which is exactly what the model was designed to avoid, and the
                // likeliest source of the dark patches reported on site 2026-08-15.
                // It also roughly doubled the rasterised fragments for a closed solid.
                val trustGlbMaterials = modelTrueScale
                try {
                    modelInstance.materialInstances.forEach { mi ->
                        try { mi.setParameter("metallicFactor", 0.0f) } catch (_: Throwable) {}
                        try { mi.setParameter("roughnessFactor", 0.85f) } catch (_: Throwable) {}
                        if (!trustGlbMaterials) {
                            try { mi.isDoubleSided = true } catch (_: Throwable) {}
                            try {
                                mi.cullingMode =
                                    com.google.android.filament.Material.CullingMode.NONE
                            } catch (_: Throwable) {}
                        }
                    }
                } catch (t: Throwable) {
                    Log.w(TAG, "material fix-up skipped", t)
                }
                Log.i(
                    TAG,
                    "materials: winding fix-ups " +
                        if (trustGlbMaterials) "SKIPPED (trusting the GLB)" else "applied",
                )
                try {
                    // scaleToUnits NORMALISES: it resizes the model so its largest
                    // bounding-box dimension equals that many metres. That is right for
                    // a detected object of unknown size, and catastrophically wrong for
                    // a surveyed reconstruction — a 48 m fort would render at 0.5 m.
                    // modelTrueScale keeps the GLB's own metres and treats modelScale as
                    // a fine trim (1.0 = as authored), which is what a world-locked
                    // heritage reconstruction needs.
                    val modelNode = if (modelTrueScale) {
                        ModelNode(modelInstance = modelInstance).apply {
                            if (modelScale > 0f) setScale(modelScale)
                        }
                    } else {
                        ModelNode(
                            modelInstance = modelInstance,
                            scaleToUnits = modelScale,
                        )
                    }
                    try {
                        modelNode.rotation = Rotation(0f, currentYawDeg, 0f)
                        // Belt and braces with the reset in clearCurrentAnchor: the
                        // rendered model must always agree with the transform
                        // modelLocalPose() reports, or capture saves a pose nobody saw.
                        modelNode.position =
                            Position(modelOffsetX, modelOffsetY, modelOffsetZ)
                    } catch (_: Throwable) {
                    }
                    // Never frustum-cull the reconstruction. Filament culls a
                    // renderable by its bounding box, and standing INSIDE a
                    // building is the degenerate case that gets that wrong —
                    // exactly what a visitor does in a courtyard or a gateway.
                    // Free to disable here: this model is ~5,000 vertices.
                    try {
                        modelNode.setCulling(false)
                    } catch (t: Throwable) {
                        Log.w(TAG, "disable culling failed", t)
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

    // ── Thermal guard ────────────────────────────────────────────────────────
    /**
     * Degrade before Android kills us.
     *
     * At Bangalore Fort the app ran 2-3 minutes and the system shut it down with the
     * phone very hot. Android tells us this is coming — `PowerManager` publishes a
     * thermal status well before the throttling gets severe — and we were not
     * listening. Once it does, the cheapest large saving available at runtime is to
     * drop geospatial, which is both the hottest subsystem and the one whose absence
     * degrades gracefully (the model stays exactly where it is; only re-localisation
     * stops).
     *
     * The status is also reported to JS so the screen can say what happened, rather
     * than the accuracy readout mysteriously freezing.
     */
    private var powerManager: PowerManager? = null
    private var thermalListener: PowerManager.OnThermalStatusChangedListener? = null

    private fun startThermalGuard() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        if (thermalListener != null) return
        val pm = try {
            context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        } catch (t: Throwable) {
            Log.w(TAG, "thermal guard unavailable", t)
            null
        } ?: return
        val listener = PowerManager.OnThermalStatusChangedListener { status ->
            // Two thresholds, deliberately different.
            //
            // Measured on-device 2026-08-16: this handset reaches LIGHT within about
            // three minutes of ordinary authoring. Dropping geospatial that early
            // would take the accuracy readout away from an admin who still needs it,
            // so LIGHT only WARNS. MODERATE is where the system actually throttles,
            // and that is where we shed the most expensive subsystem.
            val warn = status >= PowerManager.THERMAL_STATUS_LIGHT
            val severe = status >= PowerManager.THERMAL_STATUS_MODERATE
            Log.i(TAG, "thermal status=$status warn=$warn severe=$severe")
            post {
                onThermalStatus?.invoke(status, warn)
                if (severe) setGeospatialActive(false)
            }
        }
        try {
            pm.addThermalStatusListener(listener)
            powerManager = pm
            thermalListener = listener
        } catch (t: Throwable) {
            Log.w(TAG, "addThermalStatusListener failed", t)
        }
    }

    private fun stopThermalGuard() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val pm = powerManager
        val l = thermalListener
        if (pm != null && l != null) {
            try {
                pm.removeThermalStatusListener(l)
            } catch (_: Throwable) {
            }
        }
        powerManager = null
        thermalListener = null
    }

    fun cleanup() {
        // Name the teardown. cleanup() is reached from BOTH onDetachedFromWindow
        // and onDropViewInstance, and an AR screen that ends itself mid-session is
        // indistinguishable from a crash unless the log says which one ran first.
        Log.i(TAG, "cleanup(): attached=$isAttachedToWindow session=${arSession != null}")
        stopThermalGuard()
        // A queued rebuild would call setupAR() after teardown, resurrecting the
        // session on a view that is going away.
        removeCallbacks(rebuildRunnable)
        removeCallbacks(measureAndLayout)
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
        // Hold the display awake for as long as the AR surface is attached.
        //
        // Aligning a 47 m reconstruction means standing still and LOOKING, with no
        // touches for minutes at a time — which is precisely what the display
        // timeout counts as idle. When it fires, ARCore pauses, the camera is
        // released and the session comes back re-initialised; from the user's side
        // that reads as the screen "automatically closing down" mid-alignment.
        // Nothing else in the app sets this, so on a handset with a 30 s timeout
        // the AR screen was unusable by design.
        //
        // View.keepScreenOn maps to WindowManager's FLAG_KEEP_SCREEN_ON and is
        // scoped to this view's attachment, so it needs no permission and cannot
        // leak past cleanup() the way an explicit WakeLock can.
        keepScreenOn = true
        startThermalGuard()
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
        keepScreenOn = false
        cleanup()
    }

    companion object {
        private const val TAG = "EpocheyeDetectARView"

        /**
         * Assumed height of a hand-held phone above the ground, in metres.
         *
         * Only ever used to guess where the floor is when ARCore has found no plane
         * at all, and only for true-scale models whose origin is their ground course.
         * Being 20 cm out here is a couple of taps on the fine pad; inheriting the
         * camera's own height instead put a 13.5 m building's base at chest level.
         */
        private const val EYE_HEIGHT_M = 1.5f

        /**
         * Worst Earth horizontal accuracy, in metres, still worth anchoring to when
         * no plane was found. See the third tier in [doPlaceInFront] — above this,
         * the Earth fix is still converging and its anchor JUMPS, which is worse
         * than free space's smooth drift because a jump undoes an alignment.
         */
        private const val MAX_EARTH_FALLBACK_ACC_M = 3.0

        /**
         * How often the Earth pose is read and pushed to JS, in nanoseconds.
         *
         * 2 s, matching the rate this actually ran at on the measured build — not
         * the 1 s its old comment claimed. Every read is a JNI call plus a JS event
         * that re-renders the authoring screen, on the screen this project is
         * trying to stop overheating, so it stays at the slower measured rate
         * rather than being quietly doubled while "fixing" the throttle.
         */
        private const val GEO_READ_INTERVAL_NANOS = 2_000_000_000L

        // Dev harness: VPS-availability probe log tag. Coordinates are the
        // device's CURRENT location, passed in from JS per call.
        private const val VPS_TAG = "VPS"

        // ADMIN-HARNESS (REMOVE AFTER KONARK) — geospatial pipeline log tag.
        private const val GEO_TAG = "GEO"
    }
}
