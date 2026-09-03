package com.epocheye.ar

import android.content.Context
import android.graphics.ImageFormat
import android.os.Build
import android.os.PowerManager
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.MediaPlayer
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
import com.google.ar.core.CameraConfig
import com.google.ar.core.CameraConfigFilter
import com.google.ar.core.Config
import com.google.ar.core.Coordinates2d
import com.google.ar.core.DepthPoint
import com.google.ar.core.Earth // ADMIN-HARNESS (REMOVE AFTER KONARK)
import com.google.ar.core.Frame
import com.google.ar.core.GeospatialPose // ADMIN-HARNESS (REMOVE AFTER KONARK)
import com.google.ar.core.HostCloudAnchorFuture
import com.google.ar.core.Plane
import com.google.ar.core.Pose
import com.google.ar.core.ResolveCloudAnchorFuture
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.VpsAvailability
import dev.romainguy.kotlin.math.Float4
import dev.romainguy.kotlin.math.inverse
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
import io.github.sceneview.node.PlaneNode
import io.github.sceneview.node.VideoNode
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberMainLightNode
import io.github.sceneview.rememberMaterialLoader
import io.github.sceneview.rememberModelLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.launch
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

    /**
     * WHY tracking is currently degraded, as the raw ARCore `TrackingFailureReason`
     * name, or `""` once it clears.
     *
     * Split out of [onARError] deliberately. That channel carries hand-written
     * sentences ("model attach failed", "no floor at that point"), and every screen
     * renders whatever arrives on it straight into a status pill — so routing an
     * ARCore enum down it put the literal text `INSUFFICIENT_FEATURES` in front of
     * visitors. The comment on the recovery branch below records a stale `BAD_STATE`
     * sitting on screen at Bangalore Fort while tracking was perfectly healthy.
     *
     * A tracking failure is also a fundamentally different KIND of event from an app
     * fault: it is environmental, usually transient, and the visitor can often fix it
     * by moving. It needs its own channel so JS can translate it into plain words
     * instead of forwarding a symbol.
     *
     * The enum name is passed rather than a message because the words belong in
     * i18n, not in Kotlin — see src/features/ar/trackingHint.ts.
     */
    var onArTrackingFailure: ((String) -> Unit)? = null

    /**
     * PHASE 0 — glTF skeletal-animation clip inventory for the model that just
     * loaded: (count, names, durationsSeconds).
     *
     * Every GLB this app ships is static geometry, so nothing has ever confirmed
     * that the loader preserves a skeleton. Reading the inventory back off the
     * Filament animator is what separates "this renderer cannot animate" from
     * "this particular model has no clips" — two failures that look identical on
     * screen and would otherwise be guessed at.
     */
    var onModelAnimations: ((Int, List<String>, List<Float>) -> Unit)? = null

    /**
     * PHASE 0 — rolling render cost: (meanMs, p95Ms, fps, modelIsAnimated).
     * Emitted about once a second while a session is running.
     */
    var onFrameStats: ((Float, Float, Float, Boolean, Int, String) -> Unit)? = null

    /**
     * Live figure geometry for the on-screen readout: (feetY, headY, camY, walkedM).
     *
     * On screen rather than in logcat on purpose. The placement-time numbers said the
     * feet were on the floor while the person holding the phone was watching him float,
     * and that contradiction cost several rounds precisely because the two observations
     * were never in the same place at the same time. Now whoever is looking at him can
     * read where the app thinks he is.
     */
    var onFigureGeometry: ((Float, Float, Float, Float) -> Unit)? = null
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

    // A tap on one of the recognition placards hung by placeCardsOnly /
    // placeCardsAtScreenPoint / cardData — NOT the discovery layer, which keeps
    // onElementTapped. `videoUrl` is set when the tapped card is a video card, so JS
    // can open the same clip in its full-screen player; `posterUrl` rides along for
    // that player's poster.
    var onCardTap: ((id: String, videoUrl: String?, posterUrl: String?) -> Unit)? = null

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
    // Typed as PlaneNode, not ImageNode: a bitmap placard (ImageNode) and a video
    // card (VideoNode) share the same quad geometry, billboard loop and teardown, so
    // they live in one list and the per-frame code never has to tell them apart.
    private val cardNodes = mutableListOf<PlaneNode>()

    /**
     * What the tap test and the video lifecycle need to know about each placard in
     * [cardNodes]. Kept beside the node list rather than folded into it so the
     * per-frame billboard loop stays a plain iteration over nodes. `player` is
     * non-null only for a video card and is released wherever its node is
     * destroyed. `placardJson` is the text fallback drawn if the video cannot play —
     * null when the card carries no text worth showing, in which case the slot is
     * simply dropped rather than filled with an "Unknown object" placard.
     */
    private class CardRecord(
        val id: String,
        val node: PlaneNode,
        val videoUrl: String?,
        val posterUrl: String?,
        var player: MediaPlayer?,
        val placardJson: String?,
    )
    private val cardRecords = mutableListOf<CardRecord>()

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

    /**
     * Draw ARCore's plane grid. COMPOSE STATE, not a plain field, and that distinction
     * is the whole point.
     *
     * `planeRenderer = groundAnchored` looked correct and silently never worked: a plain
     * field is read ONCE when the composable first runs, which happens before React has
     * delivered the prop, so the grid was permanently baked to false. The same trap ate
     * depthMode earlier in this session. Anything the composable reads and a prop can
     * change has to be state, so the setter triggers recomposition.
     */
    private val planeGridState = mutableStateOf(false)

    /**
     * Session depth mode as COMPOSE STATE — the value SceneView is actually holding
     * the session to.
     *
     * The sessionConfiguration lambda sets config.depthMode = AUTOMATIC whenever the
     * device supports it, and the comment there explains why depth is wanted for every
     * session: a STANDING visitor never generates the parallax plane fitting needs, so
     * the depth map is the only thing that answers frame.hitTest(). But SceneView also
     * runs its own LaunchedEffect(depthMode) keyed on the DIRECT composable param, and
     * that effect reconfigures the live session the moment the two disagree — the same
     * "param beats lambda" trap already documented here for cloudAnchorMode,
     * geospatialMode and updateMode. `depthArmed` is false for everyone but the admin
     * harness, so the param said DISABLED, the effect turned depth back off a beat
     * after creation, and every depth hit-test came back empty: the journey's cards
     * fell through the depth tier to the "0.9 m ahead of camera" guess and parallaxed
     * off the pillar they labelled.
     *
     * So the param is driven from HERE instead, written by the lambda once it has asked
     * the session whether AUTOMATIC is supported. The write recomposes, the effect
     * re-keys to the value the session already has, and it no-ops. Asking the session
     * is what keeps this safe on a device without depth support — an unconditional
     * AUTOMATIC param would hand ARCore a configuration it rejects. The value survives
     * rebuildARNow (same view instance), so only the very first session of a view pays
     * the one-frame round trip.
     *
     * depthArmed still exists and still means what it meant: it gates the admin
     * harness's visible OCCLUSION, not whether the session produces depth at all.
     */
    private val depthModeState = mutableStateOf(Config.DepthMode.DISABLED)

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
    /** True when pendingCardX/Y are already VIEW pixels (placeCardsAtScreenPoint). */
    private var pendingCardsInView: Boolean = false
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
                        // SHOW the plane grid for a ground-standing figure.
                        //
                        // Normally hidden because a placard does not need it. For a figure
                        // it is essential feedback: the viewer must be able to see WHICH
                        // surface ARCore has actually found before tapping it, and whether
                        // it is the floor or a table. Several rounds were spent arguing
                        // about a floor neither of us could see.
                        planeRenderer = planeGridState.value.also {
                            Log.i(TAG, "COMPOSE planeRenderer=$it")
                        },
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
                        // Read from state, NOT from depthArmed — see depthModeState.
                        // SceneView's LaunchedEffect(depthMode) reconfigures the live
                        // session to whatever this param says, so it has to agree with
                        // what the sessionConfiguration lambda applied or it silently
                        // undoes it.
                        depthMode = depthModeState.value,
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
                        sessionConfiguration = { session, config ->
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
                            // DEPTH IS HOW A STANDING USER FINDS THE FLOOR.
                            //
                            // Plane detection triangulates from parallax, so it needs the
                            // viewer to WALK. A visitor stands still and points, and gets
                            // "0 planes tracked" forever — which is why the floor ended up
                            // being guessed as a fixed height below the phone, and why the
                            // figure hovered whenever the phone was held above that guess.
                            // The depth map returns real geometry from a single viewpoint,
                            // so pointing at the floor is enough. Armed for ground-standing
                            // models regardless of the admin harness flag.
                            // Depth ON whenever the device supports it, unconditionally.
                            //
                            // It CANNOT be driven from a prop. depthMode is only honoured
                            // when the session is created, and React props arrive after the
                            // view mounts — so gating it on groundAnchored armed it a beat
                            // too late and frame.hitTest() returned zero results, which is
                            // exactly what the device reported:
                            //     "hit-test: 0 results, kinds= -> none"
                            // Depth is what lets a STANDING viewer find the floor by
                            // pointing at it; plane detection cannot, because it needs the
                            // parallax of walking. Enabling it costs some power and nothing
                            // visual: depth OCCLUSION is a separate flag and stays off.
                            val depthOk = try {
                                session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)
                            } catch (t: Throwable) {
                                false
                            }
                            config.depthMode =
                                if (depthOk) Config.DepthMode.AUTOMATIC
                                else Config.DepthMode.DISABLED
                            // Publish it to the composable param as well. Without this
                            // SceneView's own LaunchedEffect(depthMode) sees the param
                            // (DISABLED) disagree with the session it just created and
                            // reconfigures depth straight back off — see depthModeState.
                            depthModeState.value = config.depthMode
                            // INSTANT PLACEMENT STAYS OFF.
                            //
                            // It was switched on to let a stationary viewer place before any
                            // plane existed. What it actually does is return a hit with NO
                            // REAL PLANE, at an ASSUMED depth — the call succeeds and the
                            // pose is a guess. That is precisely the "model standing on a
                            // plane in mid-air" that was reported: a fabricated surface at
                            // the viewer's own height. A wrong placement is worse than none.
                            config.instantPlacementMode = Config.InstantPlacementMode.DISABLED
                            // Printed from the config itself. The previous line here carried
                            // a hard-coded "instantPlacement=LOCAL_Y_UP" left over from before
                            // the mode was disabled, and it sent a whole diagnosis the wrong
                            // way. Never log a literal for a value the object can report.
                            Log.i(
                                TAG,
                                "session config: depthSupported=$depthOk depthMode=" +
                                    "${config.depthMode} instantPlacement=" +
                                    "${config.instantPlacementMode} planeFinding=" +
                                    "${config.planeFindingMode}",
                            )
                            // Light estimation DISABLED — on this device it produced no
                            // usable scene light (models stayed black). Our own bright
                            // diffuse IBL (env above) is the only light source.
                            // STEP 0 PROBE (log only, no behaviour change).
                            //
                            // A HARDWARE depth (ToF) sensor emits its own infrared, so it
                            // measures geometry in TOTAL DARKNESS. If this phone has one,
                            // the dark-room problem is solvable properly and the luminance
                            // /verdict machinery below is largely unnecessary. `dumpsys
                            // media.camera` could not answer this - the tags it prints are
                            // the generic Camera2 vocabulary, not evidence - so it is asked
                            // of ARCore directly, once, and the answer is logged.
                            try {
                                val tofFilter = CameraConfigFilter(session)
                                    .setDepthSensorUsage(
                                        java.util.EnumSet.of(
                                            CameraConfig.DepthSensorUsage.REQUIRE_AND_USE,
                                        ),
                                    )
                                val tofConfigs = session.getSupportedCameraConfigs(tofFilter)
                                Log.i(
                                    TAG,
                                    "PROBE hardware ToF depth sensor: " +
                                        if (tofConfigs.isEmpty()) {
                                            "ABSENT (depth is from motion only - needs light)"
                                        } else {
                                            "PRESENT (${tofConfigs.size} config(s)) - works in the dark"
                                        },
                                )
                            } catch (t: Throwable) {
                                Log.w(TAG, "PROBE ToF query failed: ${t.message}")
                            }
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
                            // Depth is now wanted for EVERY session (see depthModeState),
                            // so report what the session actually ended up with — the
                            // param/lambda disagreement that used to switch it back off
                            // is invisible in the lambda's own creation-time log.
                            Log.i(
                                TAG,
                                "session depth: param=${depthModeState.value} session=" +
                                    try {
                                        session.config.depthMode.name
                                    } catch (t: Throwable) {
                                        "?"
                                    },
                            )
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
                                    // Logged so the advisory path is VERIFIABLE. Absence
                                    // of a log line proves nothing if the line was never
                                    // written - that mistake has already cost one wrong
                                    // diagnosis in this file's history.
                                    Log.i(TAG, "AR tracking failure -> " + reason.name)
                                    post { onArTrackingFailure?.invoke(reason.name) }
                                } else {
                                    // Recovery. Without this the raw enum name from a
                                    // single momentary glitch sat on screen forever —
                                    // at Bangalore Fort a stale "BAD_STATE" was showing
                                    // while tracking was healthy and the model was
                                    // placed, which reads as a live fault and is not.
                                    // Empty string = "no current error"; every listener
                                    // maps it back to null.
                                    Log.i(TAG, "AR tracking failure cleared")
                                    post { onArTrackingFailure?.invoke("") }
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

    /**
     * Push ARCore's anchor corrections into the scene graph. WITHOUT THIS THE MODEL
     * NEVER MOVES AFTER PLACEMENT.
     *
     * SceneView syncs an [AnchorNode] to its ARCore anchor inside
     * `AnchorNode.update(session, frame)`, and the ONLY caller is `onARFrame`, which
     * walks the TOP-LEVEL `childNodes` list the composable was given and tests each
     * entry with `is PoseNode`. Our anchors are not in that list: they are parented
     * under `sceneRoot`, a plain [Node], and the walk does not recurse. So `update()`
     * was never reached and every anchored node in this view froze at the pose it was
     * created with.
     *
     * Measured, not inferred — 15 s after one placement:
     *     TRUTH arAnchorY=-1.055  nodeAnchorY=-0.988
     * ARCore had refined the floor down by 6.7 cm as it learned the plane; the model
     * stayed exactly where it started, hanging that far above the ground. This is the
     * "he floats" report, and it also explains why it kept coming back: plane
     * refinement happens on EVERY session, so the error is always reintroduced.
     *
     * `update()` reads `frameUpdatedAnchors` and falls back to `frame.updatedAnchors`
     * when it is unset (it is — the setter is arsceneview-internal), so a plain call
     * from here is enough and costs one set lookup per frame.
     */
    private fun syncAnchorNodes(session: Session, frame: Frame) {
        val node = currentAnchorNode ?: return
        try {
            node.update(session, frame)
        } catch (t: Throwable) {
            Log.w(TAG, "anchor node sync failed", t)
        }
    }

    /** Per-frame work, invoked from the composable's onSessionUpdated (main thread). */
    private fun onSessionTick(session: Session, frame: Frame) {
        sampleFrameTime()
        syncAnchorNodes(session, frame)
        shadowFollowTick()
        driftGuardTick(frame)
        faceViewerTick(frame)
        aimTick(frame)
        advanceWalk()
        visemeTick()
        screenProbe(frame)
        planeCensus(session, frame)
        governTorch(session, frame)
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
        // An anchor with no model appeared mid-session from a path static reading could
        // not identify. Cheap to log the stack on every creation (one per placement),
        // decisive when it happens again.
        Log.i(
            TAG,
            "anchor created at y=%.2f - caller:".format(
                try { anchor.pose.ty() } catch (_: Throwable) { Float.NaN },
            ),
            Throwable(),
        )
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
        currentShadowNode = null
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
    fun placeAtScreenPoint(dpX: Float, dpY: Float) {
        val frame = arFrame
        if (!preflight(frame)) return
        // React Native reports touch locations in dp; frame.hitTest wants physical
        // pixels. Without this the ray was cast from the top-left third of the screen
        // on a ~3x device, which is why "floor tracked, nothing under the ray" and
        // the earlier desk / mid-air placements happened.
        val density = resources.displayMetrics.density
        val screenX = dpX * density
        val screenY = dpY * density
        Log.i(
            TAG,
            "tap dp=(%.0f,%.0f) px=(%.0f,%.0f) view=%dx%d density=%.2f".format(
                dpX, dpY, screenX, screenY, width, height, density,
            ),
        )
        // A tapped figure goes through the plane-only routine, carrying the tap point.
        // The viewer can see the plane grid, so the tap says exactly which surface and
        // which spot on it - which beats any inference the app can make.
        if (groundAnchored) {
            pending = null
            setPlaneFinding(true)
            placeFigureOnFloor(frame!!, screenX, screenY)
            return
        }
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
                // Placement is DEPTH-based now, and a depth point exists as soon as the
                // camera is tracking - it does not need the sustained parallax that plane
                // fitting does. Waiting for a plane here would reintroduce exactly the
                // dependency this change removes, so the wait is gone. placeFigureOnFloor
                // does its own plausibility check and refuses rather than guessing.
                val session = arSession
                if (session == null) return
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
    /**
     * Put a ground-standing FIGURE on a REAL floor, at the point the viewer chose.
     *
     * Plane hit or nothing. Every previous version of this carried a fallback - a
     * camera-relative offset for X/Z, an assumed floor height, a depth point, an
     * instant-placement guess - and each one produced a confident placement onto a
     * surface that did not exist. The figure then stood in mid-air at the viewer's own
     * height, because a pose derived from the phone follows the phone.
     *
     * Now: the anchor comes from `hitResult.createAnchor()` on a horizontal upward-facing
     * plane, with `isPoseInPolygon` so it is inside the detected polygon rather than on
     * its infinite extension. Position AND height both come from the floor. If there is
     * no plane under the ray, nothing is placed and the viewer is told to aim at the
     * floor - a wrong placement is worse than none.
     *
     * @param screenX,screenY where to test; defaults to screen centre for auto-place,
     *        and carries the tap point when the viewer chooses a spot.
     */
    /**
     * Fold one measured floor drop into the running estimate, and remember it.
     *
     * The drop - how far the floor sits below the phone - is the single number the whole
     * placement rests on once planes are out of the picture, because ARCore's Y axis is
     * gravity-aligned and therefore "down" needs no detection at all. Measure it while
     * depth is working, and every later placement is free, instant, and immune to a dark
     * room or a floor with no texture.
     *
     * A running mean rather than the latest value: depth-from-motion is noisy at the
     * edges of objects, and one bad sample should not move a number this load-bearing.
     * Persisted so a returning visitor is calibrated before they point the phone anywhere.
     */
    private fun learnFloorDrop(drop: Float) {
        if (drop !in FLOOR_DROP_MIN..FLOOR_DROP_MAX) return
        floorDropSamples++
        val w = 1f / kotlin.math.min(floorDropSamples, FLOOR_DROP_MAX_SAMPLES).toFloat()
        learnedFloorDropM += (drop - learnedFloorDropM) * w
        if (floorDropSamples % 4 == 1) {
            try {
                context.getSharedPreferences(PREFS_AR, android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putFloat(PREF_FLOOR_DROP, learnedFloorDropM)
                    .apply()
            } catch (_: Throwable) {
            }
        }
    }

    private fun loadLearnedFloorDrop() {
        try {
            val v = context.getSharedPreferences(PREFS_AR, android.content.Context.MODE_PRIVATE)
                .getFloat(PREF_FLOOR_DROP, 0f)
            if (v in FLOOR_DROP_MIN..FLOOR_DROP_MAX) {
                learnedFloorDropM = v
                floorDropSamples = 1
                Log.i(TAG, "floor drop restored from a previous session: %.2f m".format(v))
            }
        } catch (_: Throwable) {
        }
    }

    private fun placeFigureOnFloor(frame: Frame, screenX: Float = -1f, screenY: Float = -1f) {
        val uri = glbUri ?: return
        val eng = engine ?: return
        val x = if (screenX >= 0f) screenX else width / 2f
        val y = if (screenY >= 0f) screenY else height / 2f

        // DEPTH, NOT PLANES.
        //
        // Plane detection was the weak link and the reports were consistent: a floor
        // that is plainly there never gets fitted; whatever DOES get fitted is often not
        // the floor; and the plane vanishes the moment the visitor walks forward, taking
        // the anchor's credibility with it. Plane fitting needs sustained parallax and
        // then keeps re-segmenting what it found.
        //
        // A DepthPoint needs none of that. It is a per-pixel distance measured from ONE
        // viewpoint, so it exists the instant the ray is cast, it does not need the
        // visitor to walk sideways first, and it cannot be "merged" out of existence.
        // This device has no ToF sensor (the startup probe says so), so depth here is
        // derived from motion and still wants light - but it is available far sooner and
        // far more often than a fitted plane, which is what actually matters.
        //
        // LOWEST candidate below the camera wins, same rule as before and for the same
        // reason: nearest-under-the-ray picks the desk you are aiming across.
        val camPose = frame.camera.pose
        val depthHits = try {
            frame.hitTest(x, y).filter { r ->
                r.trackable is DepthPoint && r.hitPose.ty() < camPose.ty()
            }
        } catch (t: Throwable) {
            Log.w(TAG, "figure depth hit-test failed", t)
            emptyList()
        }

        // PLAUSIBILITY, which replaces the old table-rejection.
        //
        // With planes we compared against the lowest known floor plane. There is no such
        // reference here, so the test is the drop itself: a floor is between FLOOR_DROP_MIN
        // and FLOOR_DROP_MAX below a hand-held phone. A depth point 0.4 m down is a table
        // or the visitor's own body; one 3 m down is a stairwell or noise. Both are
        // refused rather than stood on.
        val hit = depthHits
            .filter { r ->
                val drop = camPose.ty() - r.hitPose.ty()
                drop in FLOOR_DROP_MIN..FLOOR_DROP_MAX
            }
            .minByOrNull { it.hitPose.ty() }

        if (depthHits.isNotEmpty()) {
            Log.i(
                TAG,
                "placeFigure: %d depth candidates: %s -> %s".format(
                    depthHits.size,
                    depthHits.joinToString(", ") {
                        "drop=%.2f".format(camPose.ty() - it.hitPose.ty())
                    },
                    if (hit != null) "accepted" else "all implausible",
                ),
            )
        }

        // LEARN THE FLOOR, then never need to measure it again.
        //
        // Once we know how far the floor sits below the phone, we own the one number the
        // whole placement depends on - and ARCore's Y axis is gravity-aligned, so "down"
        // is exact and free forever after. Depth may fail later (dark room, no motion,
        // lens covered); the learned drop does not. Averaged over readings so one bad
        // sample cannot move it much, and persisted so a returning visitor starts
        // calibrated.
        val measuredDrop = hit?.let { camPose.ty() - it.hitPose.ty() }
        if (measuredDrop != null) learnFloorDrop(measuredDrop)

        // No usable depth: place at the learned height rather than refusing.
        //
        // Refusing was right when the alternative was inventing a surface. It is wrong
        // now, because the drop is no longer invented - it was measured, on this floor,
        // by this visitor. Placing at a remembered real height beats an empty screen.
        val groundY: Float
        val source: String
        if (hit != null) {
            groundY = hit.hitPose.ty()
            source = "DEPTH"
        } else if (floorDropSamples > 0) {
            groundY = camPose.ty() - learnedFloorDropM
            source = "LEARNED"
        } else {
            Log.i(TAG, "placeFigure: no depth and nothing learned yet - placing nothing")
            post { onARError?.invoke("Point at the floor and move the phone slowly") }
            return
        }

        // X/Z from the hit when we have one, else straight ahead at a readable distance.
        val z = camPose.zAxis
        var fwdX = -z[0]
        var fwdZ = -z[2]
        val flen = kotlin.math.sqrt(fwdX * fwdX + fwdZ * fwdZ)
        if (flen > 1e-4f) { fwdX /= flen; fwdZ /= flen }
        val groundX = hit?.hitPose?.tx() ?: (camPose.tx() + fwdX * PLACE_DISTANCE_FIGURE_M)
        val groundZ = hit?.hitPose?.tz() ?: (camPose.tz() + fwdZ * PLACE_DISTANCE_FIGURE_M)

        val dx = groundX - camPose.tx()
        val dz = groundZ - camPose.tz()
        Log.i(
            TAG,
            ("placeFigure: %s hit y=%.2f camY=%.2f drop=%.2f groundDist=%.2fm " +
                "learnedDrop=%.2f (n=%d)")
                .format(
                    source, groundY, camPose.ty(), camPose.ty() - groundY,
                    kotlin.math.sqrt(dx * dx + dz * dz),
                    learnedFloorDropM, floorDropSamples,
                ),
        )
        val hitPose = Pose.makeTranslation(groundX, groundY, groundZ)

        // A WORLD anchor at the computed pose, NOT hit.createAnchor().
        //
        // hit.createAnchor() attaches the anchor to the PLANE, and ARCore merges planes
        // constantly while it learns a floor: the plane the figure was placed on at
        // 16:07:28 was subsumed by its neighbour 100 ms later, its tracking state went
        // STOPPED, the anchor went STOPPED with it, and the node hid itself -
        //     anchor state -> tracking=STOPPED nodeVisible=false model=true
        // The figure vanished a tenth of a second after appearing, which reads as
        // "it does not work" and is not a placement fault at all. A session anchor at
        // the same pose sits in the world map, survives every plane merge, and still
        // gets ARCore's pose corrections like any other anchor.
        val session = arSession ?: run {
            post { onARError?.invoke("AR session not ready") }
            return
        }
        val anchor = try {
            session.createAnchor(hitPose)
        } catch (t: Throwable) {
            Log.w(TAG, "figure anchor creation failed", t)
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
        post { onARError?.invoke("") }
        attachModel(anchorNode, uri)
    }

    private fun doPlaceInFront(frame: Frame) {
        // A ground-standing figure gets the dedicated routine above. The ladder below
        // stays for object placards, which are a different problem: they want to sit
        // where you point, at eye level, and they are not broken.
        if (groundAnchored) {
            placeFigureOnFloor(frame)
            return
        }
        val uri = glbUri ?: return
        val eng = engine ?: return
        val session = arSession ?: run {
            post { onARError?.invoke("AR session not ready") }
            return
        }
        // Screen centre → a tracked plane, accepting only a hit inside the plane's
        // own polygon (not its infinite extension), so the model lands on the real
        // surface rather than on a guess beyond its edge.
        val camPoseForHit = frame.camera.pose
        // Camera forward projected onto the ground plane. The model's forward is its
        // local -Z, so a yaw of atan2(-fx, -fz) makes it face the same way the viewer
        // is looking; adding WALK_HEADING_OFFSET_DEG turns it across the view.
        run {
            val z = camPoseForHit.zAxis          // camera +Z points BACKWARD
            val fx = -z[0]
            val fz = -z[2]
            if (fx * fx + fz * fz > 1e-6f) {
                placementCamYawDeg =
                    Math.toDegrees(kotlin.math.atan2(-fx, -fz).toDouble()).toFloat()
            }
        }
        val hits = try {
            frame.hitTest(width / 2f, height / 2f)
        } catch (t: Throwable) {
            Log.w(TAG, "hit-test failed", t)
            emptyList()
        }

        // Reject only what is clearly ABOVE the ground the viewer is aiming at.
        //
        // This used to demand a hit be MIN_FLOOR_DROP_M (0.9 m) below the camera, which
        // was written to stop the figure standing on a desk. Applied to every rung of
        // the ladder it does real damage: a phone held low, or a viewer aiming at floor
        // close to their feet, produces a genuine floor hit less than 0.9 m down, and
        // rejecting it drops through to the ASSUMED floor — the very guess that makes
        // the figure hover. A hit the user deliberately aimed at is better evidence
        // than any assumption, so the bar here is only "below the camera at all".
        // The strict desk-rejecting bound still applies where it belongs: the
        // nearest-plane search below, which picks a surface the user did NOT aim at.
        fun lowEnough(p: Pose) =
            !dropAnchorToFloor || p.ty() < camPoseForHit.ty() - MIN_AIMED_DROP_M

        // 1. A real tracked plane is still the best answer when one exists.
        var planeHit = hits.firstOrNull { r ->
            val tr = r.trackable
            tr is Plane && tr.trackingState == TrackingState.TRACKING &&
                tr.isPoseInPolygon(r.hitPose) && lowEnough(r.hitPose)
        }

        // 2. NO PLANE? USE THE DEPTH MAP.
        //
        // This is the case that matters for a real visitor: standing still, pointing at
        // the floor. Plane detection cannot serve them because it needs parallax from
        // walking, but a DepthPoint is real measured geometry from one viewpoint. Taking
        // it means "point at the floor" does what it says instead of falling through to
        // an assumed floor height.
        if (planeHit == null) {
            planeHit = hits.firstOrNull { r ->
                r.trackable is DepthPoint && lowEnough(r.hitPose)
            }
            if (planeHit != null) {
                Log.i(TAG, "placeInFront: no plane — using DEPTH point at y=%.2f"
                    .format(planeHit.hitPose.ty()))
            }
        }

        Log.i(
            TAG,
            "hit-test: %d results, kinds=%s -> %s".format(
                hits.size,
                hits.take(6).joinToString(",") { it.trackable.javaClass.simpleName },
                planeHit?.trackable?.javaClass?.simpleName ?: "none",
            ),
        )
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
                val tracked = session.getAllTrackables(Plane::class.java)
                    .filter { it.trackingState == TrackingState.TRACKING }

                if (dropAnchorToFloor) {
                    // A FIGURE STANDS ON THE FLOOR, AND THE NEAREST PLANE IS NOT THE
                    // FLOOR. Indoors the first horizontal surface ARCore resolves is
                    // almost always a desk, because that is what the phone is held over
                    // and what has texture. Picking "nearest" put a 1.7 m man on a
                    // 0.75 m desk — head above the viewer's — which reads on screen as
                    // "the model is far too big" even though it measured exactly 1.700 m.
                    //
                    // So for ground-standing models, pick the LOWEST upward-facing plane
                    // instead: floors sit below desks, and below the camera. The
                    // eye-height sanity bound keeps a stray plane found through a
                    // doorway or stairwell from dragging the figure into a basement.
                    val floorish = tracked.filter {
                        it.type == Plane.Type.HORIZONTAL_UPWARD_FACING &&
                            it.centerPose.ty() < cam.ty() - MIN_FLOOR_DROP_M &&
                            it.centerPose.ty() > cam.ty() - MAX_FLOOR_DROP_M
                    }
                    val floor = floorish.minByOrNull { it.centerPose.ty() }
                    if (floor != null) {
                        Log.i(
                            TAG,
                            "placeInFront: floor candidates=%d chosen y=%.2f (camera %.2f)"
                                .format(floorish.size, floor.centerPose.ty(), cam.ty()),
                        )
                        floor
                    } else {
                        // Deliberately NULL, not "nearest". With no floor-like plane the
                        // only candidates left are desks and counters, and falling back
                        // to the nearest of those is exactly the bug this branch exists
                        // to fix. Returning null drops through to the free-space tier,
                        // which seats the figure at cam.ty() - EYE_HEIGHT_M. That anchor
                        // drifts, and the user is told so — but a figure standing at the
                        // right height on a shaky anchor beats one standing on a desk.
                        Log.i(
                            TAG,
                            ("placeInFront: %d planes tracked but none upward-facing " +
                                "between %.1fm and %.1fm below the camera — using the " +
                                "estimated floor instead of a table top")
                                .format(tracked.size, MIN_FLOOR_DROP_M, MAX_FLOOR_DROP_M),
                        )
                        null
                    }
                } else {
                    tracked.minByOrNull { p ->
                        val c = p.centerPose
                        val dx = c.tx() - cam.tx()
                        val dy = c.ty() - cam.ty()
                        val dz = c.tz() - cam.tz()
                        dx * dx + dy * dy + dz * dz
                    }
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
                    val fwd = cam.compose(Pose.makeTranslation(0f, 0f, -placeDistanceM))
                    // Identity rotation, ground-estimated height: the same target
                    // the free-space tier builds, so the two tiers seat the model
                    // identically and only the anchor backing differs.
                    val y = if (dropAnchorToFloor) cam.ty() - EYE_HEIGHT_M else fwd.ty()
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
                    val target = cam.compose(Pose.makeTranslation(0f, 0f, -placeDistanceM))
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
                    val y = if (dropAnchorToFloor) cam.ty() - EYE_HEIGHT_M else target.ty()
                    Log.i(
                        TAG,
                        "placeInFront: no tracked plane at all — free-space fallback " +
                            "%.1f m ahead (trueScale=$modelTrueScale, ground=$groundAnchored, ".format(placeDistanceM) +
                            "y=%.2f vs camera %.2f)"
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
        pendingCardsInView = false
        pendingCards = cardsJson
        pendingCardsDeadlineNanos = System.nanoTime() + trackWaitNanos
        tryPlaceCardsPending()
    }

    /**
     * Card placement at a TAP: the same deferred pipeline as [placeCardsOnly], but the
     * point is the visitor's touch in dp (as React Native reports it), not a detector
     * coordinate. Mapping a touch to IMAGE_NORMALIZED in JS would need the camera
     * image's crop and rotation, which only ARCore knows — so the view takes the raw
     * touch and hit-tests it directly, exactly as [placeAtScreenPoint] does for the
     * model. The same dp→px conversion applies, for the same reason.
     */
    fun placeCardsAtScreenPoint(dpX: Float, dpY: Float, cardsJson: String) {
        val density = resources.displayMetrics.density
        pendingCardX = dpX * density
        pendingCardY = dpY * density
        pendingCardsInView = true
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
            val output = FloatArray(2)
            val transformed = if (pendingCardsInView) {
                // Already VIEW pixels (placeCardsAtScreenPoint) — nothing to map.
                output[0] = pendingCardX
                output[1] = pendingCardY
                true
            } else {
                val input = floatArrayOf(pendingCardX, pendingCardY)
                try {
                    frame.transformCoordinates2d(
                        Coordinates2d.IMAGE_NORMALIZED, input, Coordinates2d.VIEW, output,
                    )
                    true
                } catch (t: Throwable) {
                    Log.w(TAG, "placeCardsOnly transform failed", t)
                    false
                }
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
        val camPose = frame.camera.pose
        val hits = try {
            frame.hitTest(viewX, viewY)
        } catch (t: Throwable) {
            Log.w(TAG, "doPlaceCards hit-test failed", t)
            emptyList()
        }

        // DEPTH FIRST, for the reason placeFigureOnFloor gives: a DepthPoint is
        // measured geometry that exists the instant the ray is cast, while a fitted
        // plane needs parallax the visitor has not supplied — and once a figure is
        // placed, plane finding is switched off altogether, so a plane-only test here
        // found nothing and every card landed on the "0.9 m ahead" guess, parallaxing
        // against the pillar it was meant to label. The NEAREST plausible depth point
        // under the ray is the surface the visitor actually tapped.
        //
        // Plausibility deliberately differs from the floor rule. A figure stands on
        // the floor, so the figure filter wants the hit well BELOW the phone. A card
        // pins to whatever was tapped — a wall, a pillar, a doorway — which sits
        // anywhere from waist height to a little above the phone. So the band is on
        // the ray length (too near is the visitor's own hand, too far is sky or noise)
        // and on the drop (a stairwell is refused exactly as it is for the figure),
        // with a modest allowance above the camera.
        val depthCandidates = hits.filter { it.trackable is DepthPoint }
        val depthHit = depthCandidates
            .filter { r -> plausibleCardHit(camPose, r.hitPose, r.distance) }
            .minByOrNull { it.distance }
        if (depthCandidates.isNotEmpty()) {
            Log.i(
                TAG,
                "doPlaceCards: %d depth candidates: %s -> %s".format(
                    depthCandidates.size,
                    depthCandidates.joinToString(", ") {
                        "d=%.2f drop=%.2f".format(it.distance, camPose.ty() - it.hitPose.ty())
                    },
                    if (depthHit != null) "accepted" else "all implausible",
                ),
            )
        }
        // Then a TRACKING plane whose polygon contains the point (the pre-depth rule,
        // unchanged); then ~0.9 m ahead so the cards still appear close to the object
        // when nothing at all is under the cursor.
        val planeHit = if (depthHit != null) {
            null
        } else {
            hits.firstOrNull { r ->
                val tr = r.trackable
                tr is Plane && tr.trackingState == TrackingState.TRACKING &&
                    tr.isPoseInPolygon(r.hitPose)
            }
        }
        val anchor = try {
            when {
                // Translation only: a DepthPoint pose is oriented to the estimated
                // surface normal, and on a wall that would lay the card frame on its
                // side. The placard layout and the Y-axis billboard assume an upright
                // anchor — exactly what the free-space fallback below provides.
                //
                // Stood off the surface along the ray back to the camera: a placard
                // centred exactly ON a wall has half its width inside the wall, which
                // depth occlusion clips and which reads as "stuck in", not "pinned to".
                depthHit != null -> {
                    val hp = depthHit.hitPose
                    val vx = hp.tx() - camPose.tx()
                    val vy = hp.ty() - camPose.ty()
                    val vz = hp.tz() - camPose.tz()
                    val len = kotlin.math.sqrt(vx * vx + vy * vy + vz * vz)
                    val k = if (len > 1e-4f) CARD_STANDOFF_M / len else 0f
                    session.createAnchor(
                        Pose.makeTranslation(hp.tx() - vx * k, hp.ty() - vy * k, hp.tz() - vz * k),
                    )
                }
                planeHit != null -> planeHit.createAnchor()
                else -> {
                    val target = camPose.compose(Pose.makeTranslation(0f, 0f, -0.9f))
                    session.createAnchor(
                        Pose.makeTranslation(target.tx(), target.ty(), target.tz()),
                    )
                }
            }
        } catch (t: Throwable) {
            // NEVER NOTHING. An anchor the session refuses to create is not a reason
            // to leave the visitor without a card; the headlocked float is still a
            // node in world space, re-posed in front of the camera each frame.
            Log.w(TAG, "doPlaceCards anchor failed — headlocking the cards", t)
            doPlaceCardsHeadlocked(cardsJson)
            return
        }
        Log.i(
            TAG,
            "doPlaceCards: anchor via %s at y=%.2f (cam y=%.2f)".format(
                when {
                    depthHit != null -> "DEPTH"
                    planeHit != null -> "PLANE"
                    else -> "AHEAD"
                },
                anchor.pose.ty(), camPose.ty(),
            ),
        )

        clearCurrentAnchor()
        val anchorNode = try {
            newAnchorNode(eng, anchor).also { sceneRoot?.addChildNode(it) }
        } catch (t: Throwable) {
            Log.e(TAG, "card anchor node create failed — headlocking the cards", t)
            try {
                anchor.detach()
            } catch (_: Throwable) {
            }
            doPlaceCardsHeadlocked(cardsJson)
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
     * Whether a depth hit is a surface a card can sensibly pin to — see the band
     * described in [doPlaceCards]. `distanceM` is ARCore's camera-to-hit distance.
     */
    private fun plausibleCardHit(camPose: Pose, hitPose: Pose, distanceM: Float): Boolean {
        if (distanceM !in CARD_HIT_MIN_M..CARD_HIT_MAX_M) return false
        val drop = camPose.ty() - hitPose.ty()
        return drop <= FLOOR_DROP_MAX && drop >= -CARD_RISE_MAX_M
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
            val rec = buildCardNode(matl, json, cardNodes.size, scale) ?: return
            sceneRoot?.addChildNode(rec.node)
            cardNodes.add(rec.node)
            cardRecords.add(rec)
        } catch (t: Throwable) {
            Log.w(TAG, "addCardNodeToScene failed — placard skipped (RN card still shows data)", t)
        }
    }

    /**
     * Build the node for one card object. A card carrying `video_url` becomes a
     * [VideoNode] playing in world space (see [newVideoCardNode]); anything else is
     * rendered to a bitmap placard exactly as before. Both are scaled by the same
     * [scale] over a normalised quad (longest side = 1), so a video card comes out
     * the same size as its bitmap neighbours. `slot` is the index the card will
     * take in [cardNodes], used for the default id. Returns null when nothing could
     * be built — the caller skips the slot.
     */
    private fun buildCardNode(
        matl: MaterialLoader,
        json: String,
        slot: Int,
        scale: Float,
    ): CardRecord? {
        val obj = try {
            JSONObject(json)
        } catch (_: Throwable) {
            JSONObject()
        }
        val id = obj.optString("id").ifBlank { "card_$slot" }
        val videoUrl = obj.optString("video_url").takeIf { it.isNotBlank() }
        val posterUrl = obj.optString("poster_url").takeIf { it.isNotBlank() }
        if (videoUrl != null) {
            val placardJson = if (hasPlacardText(obj)) json else null
            val built = newVideoCardNode(matl, videoUrl, obj.optBoolean("muted", true), scale)
            if (built != null) {
                return CardRecord(id, built.first, videoUrl, posterUrl, built.second, placardJson)
            }
            // The player or the node could not be built: fall through to the text
            // placard when there is text, so the slot is never blank for a card that
            // had something to say. The URL is kept so a tap still reaches JS.
            val fallback = placardJson ?: return null
            val bitmap = EpocheyeArCardRenderer.render(fallback) ?: return null
            val node = ImageNode(matl, bitmap).apply { setScale(scale) }
            return CardRecord(id, node, videoUrl, posterUrl, null, null)
        }
        val bitmap = renderCardBitmap(obj, json) ?: return null
        val node = ImageNode(matl, bitmap).apply { setScale(scale) }
        return CardRecord(id, node, null, null, null, null)
    }

    /**
     * Choose the renderer from the card's own shape.
     *
     * A card carrying `meta` is a PROVENANCE card: its meta line is the evidence
     * tier and the source that supports the body ("CONFIRMED · Museums of India").
     * renderDiscovery draws that line; render() does not, and would silently drop
     * it — which for a researched claim means dropping the citation and showing the
     * claim bare. That is the one thing this must never do.
     *
     * The no-source rule that governs render() is unaffected: a recognition card's
     * confidence is a statement about our model and is still never shown. A
     * provenance line is a statement about the record, which is the opposite case.
     */
    private fun renderCardBitmap(obj: JSONObject?, json: String): android.graphics.Bitmap? {
        val hasMeta = obj?.optString("meta")?.isNotBlank() == true
        return if (hasMeta) {
            EpocheyeArCardRenderer.renderDiscovery(json) ?: EpocheyeArCardRenderer.render(json)
        } else {
            EpocheyeArCardRenderer.render(json)
        }
    }

    /**
     * Replace the content of the cards already standing at the current anchor.
     *
     * This is what lets a researched history fill in behind an identification the
     * visitor was shown seconds earlier. The ANCHOR IS KEPT: no new hit-test, no
     * re-detection, no drift — the cards do not jump to a new place in the room,
     * they change what they say where they already are.
     *
     * A per-node texture swap is not possible here and would not be right anyway:
     * research returns a different NUMBER of cards than the identification placed
     * (one lead card plus one per sourced claim), so the arc layout has to be
     * recomputed. Rebuilding the children of the existing AnchorNode is the
     * smallest operation that preserves what the visitor cares about, which is
     * where the cards are — not which Kotlin objects back them.
     *
     * No-ops when nothing is anchored: research that lands after the visitor has
     * walked away or started a new scan must not resurrect a card.
     */
    fun updateAnchoredCards(cardsJson: String) {
        val anchorNode = currentAnchorNode
        if (anchorNode == null) {
            Log.i(TAG, "updateAnchoredCards: nothing anchored, ignoring")
            return
        }
        val cards = try {
            JSONArray(cardsJson)
        } catch (t: Throwable) {
            Log.w(TAG, "updateAnchoredCards: bad JSON", t)
            return
        }
        val n = minOf(cards.length(), maxCards)
        if (n == 0) return

        // Tear down the old children only after the new JSON has parsed, so a
        // malformed payload leaves the visitor with the card they already had
        // rather than an empty anchor.
        releaseCardPlayers()
        for (node in cardNodes) {
            try {
                anchorNode.removeChildNode(node)
            } catch (_: Throwable) {
            }
            destroyNodeSafely(node, "updated card")
        }
        cardNodes.clear()

        activeCardLayout = cardLayoutFor(n)
        for (i in 0 until n) {
            val json = cards.optJSONObject(i)?.toString() ?: continue
            addCardNode(anchorNode, json, activeCardLayout[i], cardOnlyScale)
        }
        Log.i(TAG, "updateAnchoredCards: replaced with $n card(s) on the existing anchor")
        post { onAnchorPlaced?.invoke("cards_updated") }
    }

    /** Whether the renderer would draw anything but a blank "Unknown object" card. */
    private fun hasPlacardText(obj: JSONObject): Boolean =
        obj.optString("display_name").isNotBlank() ||
            obj.optString("heading").isNotBlank() ||
            obj.optString("narrative").isNotBlank()

    /**
     * A video card: a SceneView [VideoNode] whose external texture is fed by a
     * [MediaPlayer] through a SurfaceTexture → Filament Stream, so the clip plays ON
     * the quad in world space — never a screen-space overlay.
     *
     * The player is given the URL (https, or a file:// path from the media cache —
     * MediaPlayer opens both), set looping and, by default, MUTED: the journey's
     * narration owns the speaker, and the card is a moving illustration until the
     * visitor taps it into the full-screen player. `prepareAsync` keeps this thread
     * clear; playback starts from the prepared callback. Sizing needs no work here:
     * VideoNode re-derives the quad from the stream's natural size once it is known,
     * normalised the same way ImageNode normalises a bitmap, so [scale] means the
     * same thing for both.
     *
     * Every step is guarded because MediaPlayer throws on bad state and on a URL it
     * cannot open. A failure releases whatever was built and returns null so the
     * caller can fall back to a text placard. The player is owned by the returned
     * pair's [CardRecord] and released with the node (see [releaseCardPlayers]).
     */
    private fun newVideoCardNode(
        matl: MaterialLoader,
        videoUrl: String,
        muted: Boolean,
        scale: Float,
    ): Pair<VideoNode, MediaPlayer>? {
        val player = MediaPlayer()
        try {
            player.setDataSource(context, Uri.parse(videoUrl))
            player.isLooping = true
            if (muted) player.setVolume(0f, 0f)
            player.setOnPreparedListener { mp ->
                try {
                    mp.start()
                } catch (t: Throwable) {
                    Log.w(TAG, "video card start failed", t)
                }
            }
            player.setOnErrorListener { mp, what, extra ->
                // Delivered on this view's looper already; posted anyway so the node
                // swap runs strictly after whatever scene work is on the stack.
                post { onVideoCardError(mp, what, extra) }
                true
            }
        } catch (t: Throwable) {
            Log.w(TAG, "video card player setup failed ($videoUrl)", t)
            try {
                player.release()
            } catch (_: Throwable) {
            }
            return null
        }
        val node = try {
            VideoNode(materialLoader = matl, player = player).apply { setScale(scale) }
        } catch (t: Throwable) {
            Log.w(TAG, "video card node failed", t)
            try {
                player.release()
            } catch (_: Throwable) {
            }
            return null
        }
        try {
            player.prepareAsync()
        } catch (t: Throwable) {
            Log.w(TAG, "video card prepareAsync failed ($videoUrl)", t)
            destroyNodeSafely(node, "video card")
            try {
                player.release()
            } catch (_: Throwable) {
            }
            return null
        }
        return node to player
    }

    /**
     * A video card's player failed after setup (bad stream, network gone). Swap the
     * black quad for the card's text placard in the SAME slot and parent, or drop
     * the slot when it has no text. The record keeps `videoUrl`, so a tap can still
     * hand the URL to the full-screen player, which may succeed where MediaPlayer
     * did not. Replacing in place keeps [cardNodes] index-aligned with
     * [activeCardLayout] for the headlocked re-pose.
     */
    private fun onVideoCardError(player: MediaPlayer, what: Int, extra: Int) {
        val rec = cardRecords.firstOrNull { it.player === player } ?: return
        Log.w(TAG, "video card '${rec.id}' failed what=$what extra=$extra — falling back to placard")
        try {
            player.release()
        } catch (_: Throwable) {
        }
        rec.player = null
        val old = rec.node
        val parent: SvNode? = old.parent
        val idx = cardNodes.indexOf(old)
        val recIdx = cardRecords.indexOf(rec)
        val replacement = try {
            val matl = materialLoader
            val json = rec.placardJson
            if (matl != null && json != null && parent != null) {
                EpocheyeArCardRenderer.render(json)?.let { bmp ->
                    ImageNode(matl, bmp).apply {
                        this.position = old.position
                        this.scale = old.scale
                    }
                }
            } else {
                null
            }
        } catch (t: Throwable) {
            Log.w(TAG, "video card fallback placard failed", t)
            null
        }
        try {
            parent?.removeChildNode(old)
        } catch (_: Throwable) {
        }
        destroyNodeSafely(old, "video card")
        if (replacement != null && parent != null) {
            try {
                parent.addChildNode(replacement)
            } catch (t: Throwable) {
                Log.w(TAG, "video card fallback attach failed", t)
            }
            if (idx >= 0) cardNodes[idx] = replacement else cardNodes.add(replacement)
            cardRecords[recIdx] = CardRecord(rec.id, replacement, rec.videoUrl, rec.posterUrl, null, null)
        } else {
            if (idx >= 0) cardNodes.removeAt(idx)
            cardRecords.removeAt(recIdx)
        }
    }

    /**
     * Release every video card's MediaPlayer and forget the records. Called BEFORE
     * the nodes are destroyed: the node owns the Surface the player decodes into,
     * so the producer stops first. Idempotent — a released player is nulled.
     */
    private fun releaseCardPlayers() {
        for (rec in cardRecords) {
            val p = rec.player ?: continue
            rec.player = null
            try {
                p.release()
            } catch (t: Throwable) {
                Log.w(TAG, "video card release failed", t)
            }
        }
        cardRecords.clear()
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
        // A FIGURE NEVER LOSES PLANE FINDING.
        //
        // A session was observed with `mode=DISABLED wanted=false` and an anchor node
        // but NO model, after nothing but plane-only figure taps - so some path switched
        // detection off while the viewer was still hunting for a floor. From that
        // moment no plane could ever appear, no grid could ever draw, and every
        // further tap was guaranteed to fail. Every call site on the figure path is
        // guarded, and the caller was not identified by reading the code; so refuse
        // here, centrally, where no future site can get round it, and print the stack
        // of whoever asked so the next occurrence names itself.
        // The refusal that used to live here protected a PLANE-BASED figure: switching
        // detection off mid-hunt meant no plane could ever appear and every tap was
        // guaranteed to fail. Placement is depth-based now and consults no plane at all,
        // so the dependency the guard defended is gone, and keeping detection alive only
        // burns CPU and heat for a grid nothing reads. The caller trace stays, because
        // the phantom disable that prompted the guard was never identified.
        if (!enabled) {
            Log.i(TAG, "setPlaneFinding(false) - caller:", Throwable())
        }
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
     * Arm/disarm the admin harness's visible depth OCCLUSION. Set from the
     * `depthArmed` prop (= admin harness mounted).
     *
     * It no longer decides the session depthMode: depth is armed for every session
     * from the sessionConfiguration lambda, published to SceneView's own depthMode
     * param through [depthModeState] (see there for why the param has to agree with
     * the lambda). All this flag now gates is [occlusionState] — whether the camera
     * stream draws the depth occlusion — which applies live and needs no rebuild.
     * The rebuild below is therefore belt-and-braces for a late prop on a session
     * that predates it; it is kept because nothing is placed at that point and the
     * harness has been proven on-device in this shape.
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
        // FREE THE SCENE NODES FIRST, WHILE THE ENGINE IS STILL ALIVE.
        //
        // Removing the ComposeView disposes the composition, which destroys the Filament
        // Engine. This function used to do that and then null every handle WITHOUT
        // touching cardNodes / cardRecords / discoveryCards, leaving live ImageNodes
        // pointing at a dead engine. The next teardown - a clearAnchor command, or
        // cleanup() on the way out - then called destroy() on them and segfaulted inside
        // libgltfio/libfilament.
        //
        // The callers' guard (`currentAnchorNode == null`) does not protect against this:
        // HEADLOCKED cards are parented to sceneRoot and are placed only AFTER
        // clearCurrentAnchor() has nulled currentAnchorNode, so the guard is true exactly
        // when cards are on screen.
        removeAllCardNodes()
        removeAllDiscoveryCards()
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
        currentShadowNode = null
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
        // Recognition placards first: they float nearest the visitor, in front of
        // whatever they label, so they win over a discovery layer behind them. They
        // are not part of the anchor-frame test below — a headlocked card has no
        // anchor at all — so they get their own per-node test.
        if (hitTestCards(screenX, screenY)) return
        if (discoveryCards.isEmpty() && tapTargets.isEmpty()) return
        val frame = arFrame ?: return
        val anchorPose = currentAnchorNode?.anchor?.pose ?: return
        val ray = screenRayWorld(frame, screenX, screenY) ?: return
        val ox = ray[0]
        val oy = ray[1]
        val oz = ray[2]
        val dx = ray[3]
        val dy = ray[4]
        val dz = ray[5]

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

    /**
     * Unproject a screen point (view pixels) to a world-space ray: [ox, oy, oz, dx,
     * dy, dz] with a unit direction, or null when the view has no size yet or the
     * camera matrices are unavailable. Shared by the placard test and the
     * discovery-layer test so both see exactly the same ray.
     */
    private fun screenRayWorld(frame: Frame, screenX: Float, screenY: Float): FloatArray? {
        if (width <= 0 || height <= 0) return null

        val view = FloatArray(16)
        val proj = FloatArray(16)
        val vp = FloatArray(16)
        val inv = FloatArray(16)
        try {
            frame.camera.getViewMatrix(view, 0)
            frame.camera.getProjectionMatrix(proj, 0, 0.05f, 200f)
        } catch (t: Throwable) {
            return null
        }
        android.opengl.Matrix.multiplyMM(vp, 0, proj, 0, view, 0)
        if (!android.opengl.Matrix.invertM(inv, 0, vp, 0)) return null

        val ndcX = 2f * screenX / width.toFloat() - 1f
        val ndcY = 1f - 2f * screenY / height.toFloat()
        val near = FloatArray(4)
        val far = FloatArray(4)
        android.opengl.Matrix.multiplyMV(near, 0, inv, 0, floatArrayOf(ndcX, ndcY, -1f, 1f), 0)
        android.opengl.Matrix.multiplyMV(far, 0, inv, 0, floatArrayOf(ndcX, ndcY, 1f, 1f), 0)
        if (near[3] == 0f || far[3] == 0f) return null
        val ox = near[0] / near[3]
        val oy = near[1] / near[3]
        val oz = near[2] / near[3]
        var dx = far[0] / far[3] - ox
        var dy = far[1] / far[3] - oy
        var dz = far[2] / far[3] - oz
        val dlen = kotlin.math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dlen <= 1e-6f) return null
        dx /= dlen; dy /= dlen; dz /= dlen
        return floatArrayOf(ox, oy, oz, dx, dy, dz)
    }

    /**
     * Resolve a tap to one of the placards in [cardNodes]. Unlike the discovery
     * layer these are not authored in one anchor frame — a headlocked card has no
     * anchor at all — so the ray is taken into each node's OWN local frame through
     * its world transform (parent anchor, billboard yaw and scale all folded in) and
     * tested against the unscaled quad. Nearest along the ray wins; a hit is
     * reported on [onCardTap]. Returns true when a card was hit.
     */
    private fun hitTestCards(screenX: Float, screenY: Float): Boolean {
        if (cardRecords.isEmpty()) return false
        val frame = arFrame ?: return false
        val ray = screenRayWorld(frame, screenX, screenY) ?: return false
        val origin = Float4(ray[0], ray[1], ray[2], 1f)
        val dir = Float4(ray[3], ray[4], ray[5], 0f)

        var bestT = Float.MAX_VALUE
        var best: CardRecord? = null
        for (rec in cardRecords) {
            val t = try {
                rayQuadT(origin, dir, rec.node)
            } catch (_: Throwable) {
                null
            } ?: continue
            if (t < bestT) {
                bestT = t
                best = rec
            }
        }
        val hit = best ?: return false
        Log.i(TAG, "card tap '%s' at %.2f m video=%b".format(hit.id, bestT, hit.videoUrl != null))
        post { onCardTap?.invoke(hit.id, hit.videoUrl, hit.posterUrl) }
        return true
    }

    /**
     * Ray-vs-quad in the node's local frame. The quad is PlaneNode's geometry: an
     * axis-aligned rectangle of `size` about `center` in the local XY plane, facing
     * +Z (the same fact the discovery test relies on). The world transform carries
     * the node's scale, so the extents here are the unscaled geometry size; and
     * because the transform is affine, the parameter t is the same distance along
     * the world ray — comparable across cards. Null when the ray misses.
     */
    private fun rayQuadT(origin: Float4, dir: Float4, node: PlaneNode): Float? {
        val inv = inverse(node.worldTransform)
        val o = inv * origin
        val d = inv * dir
        val geo = node.geometry
        val center = geo.center
        if (kotlin.math.abs(d.z) < 1e-6f) return null
        val t = (center.z - o.z) / d.z
        if (t <= 0f) return null
        val u = o.x + d.x * t - center.x
        val v = o.y + d.y * t - center.y
        val size = geo.size
        return if (kotlin.math.abs(u) <= size.x / 2f && kotlin.math.abs(v) <= size.y / 2f) t else null
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
            destroyNodeSafely(c.node, "discovery card")
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
        currentShadowNode = null
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
     * Destroy a scene node ONLY when it is still safe to touch, and never twice.
     *
     * THE CRASH THIS EXISTS FOR (2026-08-26, reproducible on every card teardown):
     *
     *     F libc : Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), addr 0x616c2f6176616a4c
     *     #00 libfilament-jni.so
     *     #03 RenderableManager.getMaterialInstanceAt
     *     #18 RenderableNode.getMaterialInstance
     *     #23 ImageNode.destroy
     *     #28 EpocheyeDetectARView.removeAllCardNodes
     *
     * The fault address is ASCII - "Ljava/la..." little-endian - a freed arena reused
     * for a Java string and then dereferenced as a pointer.
     *
     * WHY try/catch CANNOT HELP. SceneView's `ImageNode.destroy()` reads its material
     * instance FIRST, before any of its own guards:
     *     getMaterialInstance() -> RenderableManager.getMaterialInstanceAt(instance, 0)
     * and `Engine.getRenderableManager()` is a plain field read with no validity check.
     * `Engine.destroy()` zeroes the ENGINE's handle but leaves the cached
     * RenderableManager holding a STALE native pointer, so the call succeeds into freed
     * memory. A native SIGSEGV is not a Java Throwable; the `catch (_: Throwable)` that
     * used to wrap these calls caught nothing.
     *
     * So the check has to happen BEFORE destroy(), and it has to be ours:
     *   - `Engine.isValid()` - the engine's own native handle is still live.
     *   - `RenderableManager.hasComponent(entity)` - this particular renderable still
     *     exists, which catches the second path (a node orphaned by rebuildARNow, whose
     *     entity is gone while the engine is fine).
     *
     * When the engine is already gone there is nothing to free - it died with the
     * engine - so dropping the reference is correct, not a leak.
     */
    private fun destroyNodeSafely(node: SvNode, what: String) {
        val eng = engine
        if (eng == null || !eng.isValid) {
            if (!nodeDestroySkipWarned) {
                nodeDestroySkipWarned = true
                Log.w(TAG, "skipping $what destroy: Filament engine already torn down")
            }
            return
        }
        try {
            val rm = eng.renderableManager
            if (!rm.hasComponent(node.entity)) {
                // Orphaned renderable - the entity outlived its component (rebuildARNow
                // disposes the composition without clearing these lists). destroy() would
                // read material slot 0 off instance 0 and walk out of bounds.
                Log.w(TAG, "skipping $what destroy: renderable component is gone")
                return
            }
        } catch (t: Throwable) {
            Log.w(TAG, "skipping $what destroy: renderable check failed", t)
            return
        }
        try {
            node.destroy()
        } catch (t: Throwable) {
            Log.w(TAG, "$what destroy threw", t)
        }
    }

    /**
     * Detach every card placard from its actual parent — the anchor node (world-anchored
     * cards) or the scene (headlocked cards). Best-effort; a wrong-parent remove is a
     * harmless no-op we swallow.
     */
    private fun removeAllCardNodes() {
        releaseCardPlayers()
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
            destroyNodeSafely(node, "card")
        }
        cardNodes.clear()
        cardRecords.clear()
    }

    /** Detach + destroy + forget all card placards (best-effort). */
    private fun removeCardNodes(anchorNode: AnchorNode) {
        releaseCardPlayers()
        for (node in cardNodes) {
            try {
                anchorNode.removeChildNode(node)
            } catch (_: Throwable) {
            }
            destroyNodeSafely(node, "card")
        }
        cardNodes.clear()
        cardRecords.clear()
    }

    // PHASE 0 — frame-time sampling. A ring of inter-tick gaps, summarised once a
    // second. Kept as primitives in a fixed array so the sampler itself costs
    // nothing measurable: allocating per frame would corrupt the very number it
    // is trying to report.
    private val frameGapsMs = FloatArray(FRAME_SAMPLE_SIZE)
    private var frameGapCount = 0
    private var frameGapIndex = 0
    private var lastFrameNanos = 0L
    private var lastFrameReportNanos = 0L

    private var lastCensusNanos = 0L
    private var lastScreenProbeNanos = 0L

    /**
     * WHERE IS HE ON THE SCREEN? The only measurement that matches what the eye sees.
     *
     * Every number logged so far describes the figure in WORLD coordinates, and world
     * coordinates have repeatedly said "he is on the floor 2.5 m away" while the person
     * holding the phone watched him hang overhead. Projecting his feet and head through
     * ARCore's own view and projection matrices ends that argument: it reports the pixel
     * he actually occupies, and whether he is in front of the camera at all.
     *
     * screenY near 0 = top of the frame, 1 = bottom. behind=true means he is behind the
     * viewer and should not be visible at all.
     */
    private fun screenProbe(frame: Frame) {
        val node = currentModelNode ?: return
        val now = System.nanoTime()
        if (now - lastScreenProbeNanos < CENSUS_INTERVAL_NANOS) return
        lastScreenProbeNanos = now
        try {
            val view = FloatArray(16)
            val proj = FloatArray(16)
            frame.camera.getViewMatrix(view, 0)
            frame.camera.getProjectionMatrix(proj, 0, 0.05f, 100f)

            val bb = node.boundingBox
            val sc = node.scale.y
            val wp = node.worldPosition
            val feetY = wp.y + (bb.center[1] - bb.halfExtent[1]) * sc
            val headY = wp.y + (bb.center[1] + bb.halfExtent[1]) * sc

            fun project(x: Float, y: Float, z: Float): Triple<Float, Float, Float> {
                val vx = view[0] * x + view[4] * y + view[8] * z + view[12]
                val vy = view[1] * x + view[5] * y + view[9] * z + view[13]
                val vz = view[2] * x + view[6] * y + view[10] * z + view[14]
                val cx = proj[0] * vx + proj[4] * vy + proj[8] * vz + proj[12]
                val cy = proj[1] * vx + proj[5] * vy + proj[9] * vz + proj[13]
                val cw = proj[3] * vx + proj[7] * vy + proj[11] * vz + proj[15]
                if (kotlin.math.abs(cw) < 1e-6f) return Triple(-1f, -1f, vz)
                // NDC -> 0..1 screen, y flipped so 0 is the TOP of the frame
                return Triple(
                    (cx / cw + 1f) * 0.5f,
                    1f - (cy / cw + 1f) * 0.5f,
                    -vz,                       // metres in front of the camera
                )
            }

            val (fx, fy, fdist) = project(wp.x, feetY, wp.z)
            val (_, hy, _) = project(wp.x, headY, wp.z)
            Log.i(
                TAG,
                ("SCREEN feet=(%.2f,%.2f) head_y=%.2f distAhead=%.2fm behind=%b " +
                    "| 0=top 1=bottom")
                    .format(fx, fy, hy, fdist, fdist < 0f),
            )
        } catch (t: Throwable) {
            Log.w(TAG, "screen probe failed", t)
        }
    }

    /**
     * Report what ARCore ACTUALLY sees, once a second.
     *
     * "0 planes tracked" is ambiguous on its own: it cannot tell you whether ARCore
     * found nothing, or found planes we then filtered away. Those need opposite
     * fixes, and guessing between them has already cost several rounds. This prints
     * the raw census — every plane, its type, its tracking state — plus the session's
     * EFFECTIVE plane-finding mode read back from the config rather than from the
     * flag we think we set.
     */
    /**
     * Largest extent (min of X/Z) each plane has ever reported. A PAUSED plane reports
     * 0 x 0, so the live value says nothing about whether it was ever a real surface;
     * this does. Keyed by the Plane object, which ARCore keeps stable for its lifetime.
     */
    private val maxPlaneExtent = java.util.WeakHashMap<Plane, Float>()

    /**
     * DARK ROOMS: turn the phone's own lamp on so ARCore has something to see.
     *
     * A camera tracker cannot find a floor in the dark - that is physics, not a bug. But
     * the phone carries a light, and ARCore 1.54 exposes it (Config.FlashMode.TORCH,
     * verified against core-1.54.0.aar). Switching it on is the one real remedy for
     * `INSUFFICIENT_LIGHT`, and it is what lets an unlit corridor resolve a floor at all.
     *
     * Limits, so nobody expects more of it than it gives: the lamp reaches perhaps 2-4 m,
     * so it rescues a room and does nothing for a courtyard at night; and it cannot help a
     * FEATURELESS surface, which fails as INSUFFICIENT_FEATURES instead - bare polished
     * concrete needs objects scattered on it, not more light.
     *
     * Held off until the reason has persisted, because ARCore reports INSUFFICIENT_LIGHT
     * in single frames while panning past a dark patch, and a lamp that strobes on every
     * such frame is worse than none. Switched off again as soon as a floor is tracked:
     * the torch is a real battery and heat cost, and this file already fights heat.
     */
    private fun governTorch(session: Session, frame: Frame) {
        val reason = try {
            frame.camera.trackingFailureReason
        } catch (_: Throwable) {
            null
        }
        val dark = reason == TrackingFailureReason.INSUFFICIENT_LIGHT
        val haveFloor = try {
            session.getAllTrackables(Plane::class.java).any {
                it.trackingState == TrackingState.TRACKING &&
                    it.type == Plane.Type.HORIZONTAL_UPWARD_FACING
            }
        } catch (_: Throwable) {
            false
        }
        val now = System.nanoTime()
        // Measure only while there is no floor - see measureLuma's note on cost.
        if (!haveFloor && now - lastLumaNanos >= LUMA_SAMPLE_INTERVAL_NANOS) {
            lastLumaNanos = now
            val l = measureLuma(frame)
            if (l >= 0) {
                lastLuma = l
                // CALIBRATION DATA. The DIM / HOPELESS thresholds must come from these
                // readings taken in the real rooms - lit, unlit, and unlit-with-torch -
                // not from a guess. A guessed threshold is how "too dark" fires in a
                // perfectly usable room.
                Log.i(TAG, "LUMA %3d torch=%s planes=%s why=%s"
                    .format(l, torchOn, haveFloor, reason?.name ?: "NONE"))
            }
        }
        if (!torchSupported) return
        if (dark && !haveFloor) {
            if (lowLightSinceNanos == 0L) lowLightSinceNanos = now
            if (!torchOn && now - lowLightSinceNanos >= LOW_LIGHT_TORCH_DELAY_NANOS) {
                setTorch(session, true)
            }
        } else {
            lowLightSinceNanos = 0L
            // Only give the light back once there is a floor to stand on. Letting it go
            // the instant ARCore stops saying "dark" would flap: the lamp is often the
            // only reason the frame stopped being dark in the first place.
            if (torchOn && haveFloor) setTorch(session, false)
        }
    }

    /**
     * HOW DARK IS IT, ACTUALLY - measured here, because nothing else will tell us.
     *
     * ARCore only reports a binary INSUFFICIENT_LIGHT, which cannot separate "dim, the
     * lamp will fix this" from "hopeless, say so and stop pretending". ARCore's own
     * LightEstimate.getPixelIntensity() would give a number, but light estimation is
     * DISABLED in this file for a documented reason - enabling it rendered models black
     * (see the sessionConfiguration lambda) - and a diagnostic is not worth a rendering
     * regression. So we read the camera image directly: in YUV the Y plane IS luminance,
     * so the mean of Y is the measurement, and taking it costs no config change at all.
     *
     * Sampled every SAMPLE_STRIDE-th byte rather than copied wholesale, and only while
     * there is no floor yet, so this never runs during the part that has to hold 30 fps.
     * NotYetAvailableException is normal - ARCore simply has no CPU image this frame.
     *
     * @return mean luma 0-255, or -1 when unavailable.
     */
    private fun measureLuma(frame: Frame): Int {
        var image: android.media.Image? = null
        return try {
            image = frame.acquireCameraImage()
            val plane = image.planes[0]
            val buf = plane.buffer
            val rowStride = plane.rowStride
            val h = image.height
            val w = image.width
            var sum = 0L
            var n = 0
            var y = 0
            while (y < h) {
                val rowStart = y * rowStride
                var x = 0
                while (x < w) {
                    val idx = rowStart + x
                    if (idx < buf.limit()) {
                        sum += (buf.get(idx).toInt() and 0xFF)
                        n++
                    }
                    x += LUMA_SAMPLE_STRIDE
                }
                y += LUMA_SAMPLE_STRIDE
            }
            if (n == 0) -1 else (sum / n).toInt()
        } catch (_: com.google.ar.core.exceptions.NotYetAvailableException) {
            -1
        } catch (t: Throwable) {
            Log.w(TAG, "luma read failed: ${t.message}")
            -1
        } finally {
            try { image?.close() } catch (_: Throwable) {}
        }
    }

    /**
     * Apply the flash mode and CHECK IT STUCK. There is no isFlashModeSupported() in the
     * ARCore API, so support is probed with Session.isSupported(config) and the value is
     * read back off the session afterwards - a device that silently declines is a real
     * possibility and a torch we only believe we turned on is worse than no torch.
     */
    private fun setTorch(session: Session, enabled: Boolean) {
        try {
            val config = session.config
            config.flashMode = if (enabled) Config.FlashMode.TORCH else Config.FlashMode.OFF
            if (!session.isSupported(config)) {
                Log.w(TAG, "torch: FlashMode.${config.flashMode} not supported on this device")
                torchSupported = false
                return
            }
            session.configure(config)
            val actual = session.config.flashMode
            torchOn = actual == Config.FlashMode.TORCH
            Log.i(TAG, "torch: requested=$enabled readBack=$actual torchOn=$torchOn")
        } catch (t: Throwable) {
            Log.w(TAG, "torch: configure failed", t)
            torchSupported = false
        }
    }

    private fun planeCensus(session: Session, frame: Frame) {
        val now = System.nanoTime()
        if (now - lastCensusNanos < CENSUS_INTERVAL_NANOS) return
        lastCensusNanos = now
        try {
            val all = session.getAllTrackables(Plane::class.java)
            for (p in all) {
                val e = minOf(p.extentX, p.extentZ)
                if (e > (maxPlaneExtent[p] ?: 0f)) maxPlaneExtent[p] = e
            }
            val byState = all.groupingBy { it.trackingState.name }.eachCount()
            val byType = all.groupingBy { it.type.name }.eachCount()
            val mode = try {
                session.config.planeFindingMode.name
            } catch (t: Throwable) {
                "?"
            }
            val cam = frame.camera
            // SORTED BY HEIGHT, lowest first. take(6) on the raw list showed six
            // arbitrary planes out of eighteen, which hid exactly the thing being
            // looked for — whether the real floor had been found at all.
            val detail = all.sortedBy { it.centerPose.ty() }.take(6).joinToString("; ") {
                "%s/%s y=%.2f %.1fx%.1fm".format(
                    it.type.name.removePrefix("HORIZONTAL_").take(8),
                    it.trackingState.name.take(4),
                    it.centerPose.ty(),
                    it.extentX, it.extentZ,
                )
            }
            Log.i(
                TAG,
                ("PLANES n=%d mode=%s wanted=%b camState=%s why=%s camY=%.2f " +
                    "states=%s types=%s | %s")
                    .format(
                        all.size, mode, planeFindingWanted,
                        cam.trackingState.name,
                        // WHY tracking is poor, straight from ARCore. camY was seen
                        // swinging 1.2 -> 2.7 m with the phone in one place, which is
                        // divergence, not movement. Placement cannot be correct inside
                        // a coordinate frame that is not holding still, so the reason
                        // matters more than any further placement arithmetic:
                        // INSUFFICIENT_FEATURES = blank walls/floor, EXCESSIVE_MOTION =
                        // moved too fast, INSUFFICIENT_LIGHT = too dark.
                        try { cam.trackingFailureReason.name } catch (t: Throwable) { "?" },
                        cam.pose.ty(),
                        byState, byType, detail,
                    ),
            )
            // Where is he RIGHT NOW, relative to the viewer?
            //
            // A single line logged at placement time proved the feet landed on the
            // plane and still did not match what was on screen — so something moves
            // afterwards. Candidates: the anchor being re-solved as ARCore relocalises,
            // the walk translating the node, or the camera pose drifting. Logging the
            // live relationship every second is the only way to tell which, and the
            // "feetVsCam" column is the one that matches what the eye sees: positive
            // means he is ABOVE you, which is the reported symptom.
            currentModelNode?.let { mn ->
                try {
                    val bb = mn.boundingBox
                    val sc = mn.scale.y
                    val wy = mn.worldPosition.y
                    val feet = wy + (bb.center[1] - bb.halfExtent[1]) * sc
                    val head = wy + (bb.center[1] + bb.halfExtent[1]) * sc
                    val anchorY = currentAnchorNode?.worldPosition?.y
                    // GROUND TRUTH, straight from ARCore rather than from SceneView's
                    // scene graph. Every number reported so far has come from the node
                    // API and has consistently disagreed with what the viewer sees, so
                    // compare the two side by side: the anchor's own pose is what ARCore
                    // is actually tracking, and modelNode.worldPosition is what SceneView
                    // believes. If these diverge, the scene graph is the liar.
                    val arAnchorY = try {
                        currentAnchorNode?.anchor?.pose?.ty()
                    } catch (t: Throwable) {
                        null
                    }
                    val localY = try {
                        mn.position.y
                    } catch (t: Throwable) {
                        null
                    }
                    Log.i(
                        TAG,
                        "TRUTH arAnchorY=%s nodeAnchorY=%s modelLocalY=%s modelWorldY=%.3f camY=%.3f"
                            .format(
                                arAnchorY?.let { "%.3f".format(it) } ?: "-",
                                anchorY?.let { "%.3f".format(it) } ?: "-",
                                localY?.let { "%.3f".format(it) } ?: "-",
                                wy, cam.pose.ty(),
                            ),
                    )
                    onFigureGeometry?.let { cb ->
                        post { cb.invoke(feet, head, cam.pose.ty(), walkTravelled) }
                    }
                    Log.i(
                        TAG,
                        ("FIGURE feet=%.2f head=%.2f nodeY=%.2f anchorY=%s camY=%.2f " +
                            "feetVsCam=%+.2f walked=%.2fm")
                            .format(
                                feet, head, wy,
                                anchorY?.let { "%.2f".format(it) } ?: "-",
                                cam.pose.ty(),
                                feet - cam.pose.ty(),
                                walkTravelled,
                            ),
                    )
                } catch (t: Throwable) {
                    Log.w(TAG, "figure census failed", t)
                }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "plane census failed", t)
        }
    }

    /**
     * PHASE 0 — measure how expensive the scene actually is on this device.
     *
     * READ THE NUMBER IN CONTEXT: updateMode is deliberately BLOCKING, which paces
     * this loop to the ~30 fps camera rather than the 90/120 Hz display. That was
     * the fix for a thermal shutdown at Bangalore Fort. **~33 ms/frame is the
     * expected floor, not a regression** — the figure to watch is the DELTA
     * between an animated model and a static one in the same room, not the
     * absolute value.
     *
     * p95 rather than max: a single 200 ms GC pause says nothing, but a p95 that
     * drifts away from the mean is real judder a user would feel.
     */
    private fun sampleFrameTime() {
        val now = System.nanoTime()
        if (lastFrameNanos != 0L) {
            val gapMs = (now - lastFrameNanos) / 1_000_000f
            // Drop absurd gaps (app backgrounded, session paused) — they are not
            // render cost and would wreck the mean.
            lastFrameDtSec = (gapMs / 1000f).coerceIn(0f, 0.1f)
            if (gapMs in 0.5f..500f) {
                frameGapsMs[frameGapIndex] = gapMs
                frameGapIndex = (frameGapIndex + 1) % FRAME_SAMPLE_SIZE
                if (frameGapCount < FRAME_SAMPLE_SIZE) frameGapCount++
            }
        }
        lastFrameNanos = now

        if (lastFrameReportNanos == 0L) lastFrameReportNanos = now
        if (now - lastFrameReportNanos < FRAME_REPORT_INTERVAL_NANOS) return
        lastFrameReportNanos = now
        if (frameGapCount < 10) return

        val sorted = frameGapsMs.copyOf(frameGapCount).also { it.sort() }
        val mean = sorted.sum() / frameGapCount
        val p95 = sorted[((frameGapCount * 95) / 100).coerceAtMost(frameGapCount - 1)]
        val fps = if (mean > 0f) 1000f / mean else 0f
        val animated = currentModelNode?.let { it.animationCount > 0 } ?: false
        Log.i(
            TAG,
            "PHASE0 frame: mean=%.1fms p95=%.1fms fps=%.1f model=%s animated=%b"
                .format(mean, p95, fps, if (currentModelNode != null) "yes" else "no", animated),
        )
        val cb = onFrameStats ?: return
        // The two numbers that say whether ARCore is delivering anything at all. A run
        // with a correct grid pipeline and zero planes looks identical, on screen, to a
        // broken one; putting the count and ARCore's own failure reason on the banner
        // lets the viewer tell "scanning" from "dark room" from "bug" without a laptop.
        val planes = try {
            arSession?.getAllTrackables(Plane::class.java)?.count {
                it.trackingState == TrackingState.TRACKING &&
                    it.type == Plane.Type.HORIZONTAL_UPWARD_FACING
            } ?: 0
        } catch (_: Throwable) {
            0
        }
        val why = try {
            arFrame?.camera?.trackingFailureReason?.name ?: "?"
        } catch (_: Throwable) {
            "?"
        }
        post { cb.invoke(mean, p95, fps, animated, planes, why) }
    }

    /**
     * PHASE 0 — read the skeletal-animation clip inventory off a just-loaded model
     * and report it to JS.
     *
     * Diagnostic ONLY. It deliberately does not start, stop, or advance anything:
     * SceneView's ModelNode defaults `autoAnimate = true`, and ARSceneView already
     * ticks Node.onFrame(frameTimeNanos) → ModelNode.applyAnimations every frame.
     * Driving a second animator from onSessionTick — which supplies no delta time —
     * would double-advance the clip and produce a fast, juddering result that looks
     * like a rendering bug. If a clip needs selecting later, that is
     * modelNode.playAnimation(name, speed, loop), not a hand-rolled loop.
     *
     * Method signatures verified against gltfio-android-1.71.5 and
     * sceneview-4.18.0 with javap, not assumed.
     */
    /**
     * Name of the glTF animation clip to play, or null to leave SceneView's
     * `autoAnimate` default alone (which plays clip index 0 and nothing else).
     *
     * A multi-clip figure needs this: the merged Tipu model carries Idle_02,
     * Talk_with_Right_Hand_Open and Thoughtful_Walk, and index 0 is whichever the
     * exporter happened to write first — so "walk" is not reachable without naming it.
     */
    private var animationClip: String? = null

    // ── Visemes ────────────────────────────────────────────────────────────────
    //
    // The figure's mouth is seven glTF morph targets (viseme_AA, _E, _I, _O, _U,
    // _MBP, _FV) on tipu_figure_royal5.glb. There are no facial bones to drive —
    // the Meshy rig stops at Head/headfront — so morph weights are the only route.
    //
    // The track is precomputed by tools/lipsync_envelope.py and shipped as JSON, so
    // nothing here decodes or analyses audio. One viseme per 40 ms window; this ticks
    // between consecutive windows so a held vowel crossfades instead of stepping.
    //
    // TIMEBASE. The audio plays on the JS side, so JS owns the clock. It sends the
    // player's real position periodically and this interpolates between those anchors
    // with the monotonic clock. Free-running from a single "started" timestamp drifts
    // apart from the player the moment the audio stalls, buffers, or loses focus —
    // and useAudioCompletion exists precisely because those all happen.

    /**
     * How many morph targets the loaded renderable actually has.
     *
     * A COUNT and not names: names live in the glTF source data, which SceneView frees
     * immediately after loading, so reading them segfaults. See probeMorphTargets.
     */
    private var morphCount: Int = 0

    /**
     * ENTITIES whose renderable carries exactly [morphCount] morph targets.
     *
     * Entities and NOT RenderableManager instances. A Filament instance is an index
     * into a packed component array, and the manager compacts that array whenever a
     * renderable is created or destroyed - which this view does constantly: the
     * contact shadow, every AR card, the whole discovery layer. A cached instance can
     * therefore come to address a DIFFERENT renderable, and writing a seven-float
     * weight array into one that has no morph targets is an out-of-bounds write into
     * Filament's own component data. It does not crash; it corrupts, which is why the
     * figure appeared with its hands stretched into flat sheets.
     *
     * An entity id is a stable handle. The instance is resolved fresh every frame.
     */
    private var morphEntities: IntArray = IntArray(0)

    /** Scratch weight buffer, one slot per morph target on the model. */
    private var morphWeights: FloatArray = FloatArray(0)

    /** Track viseme id -> morph slot on this model, or -1 when the model lacks it. */
    private var visemeSlot: IntArray = IntArray(0)

    private var visemeIds: IntArray? = null
    private var visemeAmps: FloatArray? = null
    private var visemeWindowS: Float = 0.040f

    /** True while JS says the narration is actually sounding. */
    private var visemePlaying: Boolean = false

    /** Last position JS reported, and the monotonic instant it reported it. */
    private var visemeAnchorMs: Int = 0
    private var visemeAnchorAtNanos: Long = 0L

    /** Suppresses a repeated "this model has no visemes" warning every frame. */
    private var visemeMissWarned = false

    /**
     * This model's origin is on the ground, so a free-space anchor must be dropped to
     * the estimated floor rather than left at camera height.
     *
     * Split out from [modelTrueScale] because the two were conflated and only
     * coincidentally travelled together. True scale answers "how big is it?"; this
     * answers "where is its origin?" — and a figure needs the floor WITHOUT true
     * scale, because the Meshy rig carries a 100x unit mismatch (skeleton in cm,
     * mesh in m, one 0.01 root scale) that only `scaleToUnits` normalisation hides.
     * Turning true scale on to get the floor drop therefore rendered a 1.7 cm man.
     */
    /** Read by the view manager so the on-screen banner can say the lamp is on. */
    var torchOn = false
        private set

    private var currentShadowNode: ImageNode? = null
    private var blobShadowBitmap: android.graphics.Bitmap? = null
    @Volatile private var contactShadowEnabled = true

    /** Mean camera luma 0-255, -1 until first measured. See measureLuma(). */
    var lastLuma = -1
        private set
    private var lastLumaNanos = 0L
    private var torchSupported = true
    private var lowLightSinceNanos = 0L

    private var groundAnchored: Boolean = false

    fun setGroundAnchored(enabled: Boolean) {
        Log.i(TAG, "PROP groundAnchored=$enabled (composeView=${composeView != null})")
        if (enabled && floorDropSamples == 0) loadLearnedFloorDrop()
        groundAnchored = enabled
        // A depth-placed figure needs no plane detection and no grid. Detection is the
        // single most expensive thing ARCore does continuously, and the grid actively
        // misled the viewer: it implied they had to find a plane to place him, which is
        // exactly the dependency that was removed.
        if (enabled) {
            setPlaneFinding(false)
            planeGridState.value = false
        }
        // Show the grid for a figure: the viewer has to SEE which surface ARCore found
        // before tapping it, and whether it is the floor or a table top.
        planeGridState.value = enabled
    }

    /** Anchors with no surface under them should sit on the estimated floor. */
    private val dropAnchorToFloor: Boolean
        get() = modelTrueScale || groundAnchored

    /** A person needs room to be seen whole; a placard does not. */
    private val placeDistanceM: Float
        get() = if (groundAnchored) PLACE_DISTANCE_FIGURE_M else PLACE_DISTANCE_OBJECT_M

    // ── Root motion ─────────────────────────────────────────────────────────────
    // Every clip in the library is an IN-PLACE cycle: the legs stride but the body
    // never leaves the spot. To make the figure cross the floor, the node has to be
    // translated, and the speed has to match what the clip already implies or the
    // feet skate.
    //
    // 0.46 m/s is MEASURED, not chosen: in an in-place cycle the planted foot slides
    // backward under the body at exactly the body's ground speed, so tracking the toe
    // through its stance phase in Blender gives the answer. Left foot 0.455, right
    // 0.464 — they agree, which is the check that the number is real.
    /**
     * Camera heading (degrees about Y) at the moment the figure was placed.
     *
     * Needed because a walking figure has to be oriented RELATIVE TO THE VIEWER, and
     * an ARCore plane anchor's pose carries the plane's own yaw, which is arbitrary.
     * Left at the default the figure faced the anchor's local -Z and walked that way —
     * a direction unrelated to where anyone was standing, so he would happily walk
     * straight through the viewer and end up behind them. On device that reads as
     * "I can only see the soles of his feet in the air", because you are underneath him.
     */
    private var placementCamYawDeg: Float = 0f

    /**
     * A storytelling figure turns to the visitor; a walk-past figure is aimed across the
     * view. FACE_VIEWER is the default because standing-and-speaking is the experience.
     */
    /** Coaching state, read by the view manager onto the frame-stats event. */
    var aimState: String = AIM_OK
        private set
    /** Signed bearing to the figure: +ve = he is to the right. */
    var aimAngleDeg: Float = 0f
        private set
    private var aimCandidate: String = AIM_OK
    private var aimCandidateFrames = 0
    private var lastFwd: FloatArray? = null

    private val camYHistory = ArrayDeque<Float>()
    /** How far the floor sits below the phone, learned from depth. See learnFloorDrop(). */
    private var learnedFloorDropM = 1.45f
    private var floorDropSamples = 0

    private var driftStaging = false

    /**
     * Camera height at the moment the figure was placed, in ARCore world units.
     *
     * The reference the drift guard needs. A rolling median cannot serve: when the
     * world origin diverges STEADILY the median follows it, the excursion looks small
     * again, and the guard reports "recovered" while the camera is two metres from
     * where it started. That is exactly what put the figure off the top of the screen.
     */
    private var camYAtPlacement = Float.NaN

    /** Set once per divergence episode so the warning is not logged every frame. */
    private var divergenceWarned = false

    /** One warning per teardown, not one per node, when the engine has already gone. */
    private var nodeDestroySkipWarned = false
    private var placedAtNanos = 0L
    private var stagedDropM = 1.5f

    /** SPEAKING faces the visitor and stands; WALKING faces the path and translates. */
    @Volatile private var figureState: String = FIGURE_SPEAKING
    private var arriveClipName: String? = null
    private var walkTurnBack = false
    private var walkArcRemainingDeg = 0f
    private val walkArcRadiusM = WALK_ARC_RADIUS_M
    /** +1 turns one way, -1 the other; fixed so the arc is repeatable. */
    private val walkArcSign = 1f

    @Volatile private var faceViewer: Boolean = true
    private val faceOffsetDeg: Float
        get() = if (faceViewer) 180f else WALK_HEADING_OFFSET_DEG

    fun setFaceViewer(enabled: Boolean) {
        if (enabled == faceViewer) return
        faceViewer = enabled
        Log.i(TAG, "PROP faceViewer=$enabled")
    }

    private var walkSpeedMps = 0f
    private var walkDistanceM = 0f
    private var walkTravelled = 0f
    private var lastFrameDtSec = 0f

    fun setWalkSpeedMps(v: Float) { walkSpeedMps = if (v > 0f) v else 0f }
    fun setWalkDistanceM(v: Float) { walkDistanceM = if (v > 0f) v else 0f }

    /**
     * Slide the placed model forward along its own facing, stopping after
     * [walkDistanceM]. Zero distance means walk indefinitely.
     *
     * Bounded on purpose. This project's own notes put ARCore drift beyond roughly
     * 8 m from an anchor, so an unbounded walk would end with the figure detached
     * from the floor it started on — and indoors it would simply leave the room.
     */
    /**
     * Start the "follow me" beat: turn away from the visitor and walk.
     *
     * He is placed FACING the visitor, so his walking heading is the opposite of his
     * speaking heading - he turns his back and leads. faceViewerTick is suspended for the
     * duration, because the two are directly opposed: one turns him to the visitor every
     * frame, the other needs him pointed down the path. They fought, and facing won.
     *
     * Speed is not a preference. The clip is an in-place cycle whose planted foot slides
     * backwards at exactly the body's ground speed, measured in Blender at 0.455 m/s on
     * the left stance and 0.464 on the right. Translate at anything else and the feet
     * skate, which is the single most obvious tell that a character is fake.
     */
    fun walkPath(distanceM: Float, speedMps: Float, walkClip: String?, arriveClip: String?) {
        val node = currentModelNode ?: run {
            Log.w(TAG, "walkPath ignored - nothing placed yet")
            return
        }
        walkDistanceM = if (distanceM > 0f) distanceM else 4f
        walkSpeedMps = if (speedMps > 0f) speedMps else 0.46f
        walkTravelled = 0f
        walkArcRemainingDeg = 0f
        walkTurnBack = true
        arriveClipName = arriveClip
        // Turn his back to the visitor and walk that way.
        currentYawDeg = (currentYawDeg + 180f) % 360f
        try {
            node.rotation = Rotation(0f, currentYawDeg, 0f)
        } catch (_: Throwable) {
        }
        figureState = FIGURE_WALKING
        walkClip?.let { setAnimationClip(it) }
        Log.i(
            TAG,
            "walkPath: %.1f m at %.2f m/s heading %.0f deg (clip=%s -> %s)"
                .format(walkDistanceM, walkSpeedMps, currentYawDeg, walkClip, arriveClip),
        )
    }

    private fun advanceWalk() {
        if (walkSpeedMps <= 0f) return
        val node = currentModelNode ?: return
        var step = walkSpeedMps * lastFrameDtSec
        if (step <= 0f) return

        // WHICH WAY IS FORWARD - derived from the one thing already proven correct.
        //
        // faceViewerTick aims him with yaw = atan2(dx, dz) where d = camera - node, and
        // that demonstrably puts his FRONT toward the viewer. So for this rig:
        //     forward(theta) = (+sin theta, +cos theta)
        // This function used (-sin, -cos), inherited from the assumption that glTF
        // forward is local -Z - which does not survive this asset's export. The two are
        // exact opposites, so walkPath turned his back correctly and then translated him
        // TOWARD the viewer while his legs cycled forward: a moonwalk. The convention has
        // been wrong since the walk-across days and was never caught because he always
        // left the frame before anyone could judge the direction.
        fun forwardOf(yawDeg: Float): Pair<Float, Float> {
            val r = Math.toRadians(yawDeg.toDouble())
            return Pair(kotlin.math.sin(r).toFloat(), kotlin.math.cos(r).toFloat())
        }

        try {
            if (walkArcRemainingDeg > 0f) {
                // ARC PHASE - he turns while walking, because that is what people do.
                // Rotating on the spot made him a turret: feet planted, body spinning.
                // Turning through an arc of radius R while covering `step` metres means
                // sweeping step/R radians, so the legs keep cycling all the way round and
                // there is never a frame where a standing figure rotates.
                val sweepDeg = Math.toDegrees((step / walkArcRadiusM).toDouble()).toFloat()
                val applied = kotlin.math.min(sweepDeg, walkArcRemainingDeg)
                // Advance along the MIDPOINT heading of this frame's sweep, which keeps
                // the path a smooth curve instead of a polygon of straight hops.
                val midYaw = currentYawDeg + applied * 0.5f * walkArcSign
                val (fx, fz) = forwardOf(midYaw)
                val p = node.position
                node.position = Position(p.x + fx * step, p.y, p.z + fz * step)
                currentYawDeg = (currentYawDeg + applied * walkArcSign + 360f) % 360f
                node.rotation = Rotation(0f, currentYawDeg, 0f)
                walkArcRemainingDeg -= applied
                if (walkArcRemainingDeg <= 0f) {
                    walkSpeedMps = 0f
                    figureState = FIGURE_SPEAKING
                    arriveClipName?.let { setAnimationClip(it) }
                    Log.i(TAG, "walkPath: arc complete - now facing back, handing to faceViewer")
                }
                return
            }

            // STRAIGHT PHASE
            if (walkDistanceM > 0f && walkTravelled >= walkDistanceM) return
            if (walkDistanceM > 0f) step = kotlin.math.min(step, walkDistanceM - walkTravelled)
            val (fx, fz) = forwardOf(currentYawDeg)
            val p = node.position
            node.position = Position(p.x + fx * step, p.y, p.z + fz * step)
            walkTravelled += step

            if (walkDistanceM > 0f && walkTravelled >= walkDistanceM) {
                if (walkTurnBack) {
                    walkArcRemainingDeg = 180f
                    Log.i(
                        TAG,
                        "walkPath: %.2f m done - arcing back through 180 deg at r=%.1f m"
                            .format(walkTravelled, walkArcRadiusM),
                    )
                } else {
                    walkSpeedMps = 0f
                    figureState = FIGURE_SPEAKING
                    arriveClipName?.let { setAnimationClip(it) }
                    Log.i(TAG, "walkPath: arrived after %.2f m".format(walkTravelled))
                }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "advanceWalk failed", t)
        }
    }

    /**
     * AIM COACH - notice how the phone is being held and say something useful about it.
     *
     * Everything here is derived from data already computed each frame: the camera pose,
     * the figure's world position, ARCore's tracking failure reason, and the Y-plane luma
     * meter. No new sensors, no extra cost.
     *
     * HYSTERESIS IS THE WHOLE DESIGN. A coach that reacts to a single frame fires on every
     * hand tremor and becomes wallpaper the visitor learns to ignore, which is worse than
     * silence. A state has to hold for ENTER_FRAMES before it is announced and clear for
     * LEAVE_FRAMES before it is withdrawn, and leaving is deliberately slower than
     * entering so the message does not blink out mid-read.
     *
     * Priority order matters: a covered lens is worth saying before "you are facing the
     * wrong way", because the second is a consequence of the first and fixing the wrong
     * one wastes the visitor's patience.
     */
    private fun aimTick(frame: Frame) {
        val candidate = try {
            computeAimState(frame)
        } catch (t: Throwable) {
            Log.w(TAG, "aimTick failed", t)
            AIM_OK
        }
        if (candidate == aimCandidate) {
            aimCandidateFrames++
        } else {
            aimCandidate = candidate
            aimCandidateFrames = 1
        }
        val needed = if (candidate == AIM_OK) AIM_LEAVE_FRAMES else AIM_ENTER_FRAMES
        if (aimCandidateFrames >= needed && aimState != candidate) {
            aimState = candidate
            Log.i(TAG, "AIM %s (angle=%.0f deg)".format(aimState, aimAngleDeg))
        }
    }

    private fun computeAimState(frame: Frame): String {
        // 1. Can the camera see anything at all? Ask this first - the rest is meaningless
        //    if the lens is covered, and a covered lens is the easiest thing to fix.
        if (lastLuma in 0 until LUMA_COVERED) return AIM_COVERED

        val cam = frame.camera.pose
        val z = cam.zAxis
        var fx = -z[0]; val fy = -z[1]; var fz = -z[2]

        // 2. Is the phone being whipped around? ARCore's own verdict plus our pose delta.
        val reason = try { frame.camera.trackingFailureReason } catch (_: Throwable) { null }
        if (lastFwd != null && lastFrameDtSec > 0f) {
            val d = lastFwd!!
            val dot = (fx * d[0] + fy * d[1] + fz * d[2]).coerceIn(-1f, 1f)
            val degPerSec = Math.toDegrees(kotlin.math.acos(dot).toDouble()).toFloat() /
                lastFrameDtSec
            if (degPerSec > AIM_MAX_TURN_DEG_PER_SEC ||
                reason == TrackingFailureReason.EXCESSIVE_MOTION
            ) {
                lastFwd = floatArrayOf(fx, fy, fz)
                return AIM_TOO_FAST
            }
        }
        lastFwd = floatArrayOf(fx, fy, fz)

        // 3. IS HE ON SCREEN? This outranks how the phone is tilted.
        //
        // Pitch used to be tested here and it preempted everything: walking away with the
        // phone at waist height read as "hold it up" forever, and the off-target arrow -
        // the only message that tells you what to DO - was never reached. It was also
        // self-contradictory, since scanning ASKS the visitor to point at the floor.
        // Pitch now only gets to speak as the EXPLANATION for a target already lost.
        val node = currentModelNode ?: return AIM_OK
        val np = node.worldPosition
        var tx = np.x - cam.tx()
        var tz = np.z - cam.tz()
        val tlen = kotlin.math.sqrt(tx * tx + tz * tz)
        if (tlen < 1e-3f) return AIM_OK
        tx /= tlen; tz /= tlen
        val flen = kotlin.math.sqrt(fx * fx + fz * fz)
        if (flen < 1e-4f) return AIM_OK
        fx /= flen; fz /= flen
        val dot = (fx * tx + fz * tz).coerceIn(-1f, 1f)
        val angle = Math.toDegrees(kotlin.math.acos(dot).toDouble()).toFloat()

        // WHICH SIDE, and why the sign is negated. ARCore is right-handed, Y up, and the
        // camera looks down its own -Z. The camera's RIGHT is forward x up:
        //   F=(0,0,-1) x U=(0,1,0) = (+1,0,0)  ->  +X is to the right.
        // For a target on that right, t=(1,0) in XZ with f=(0,-1):
        //   cross_y = fz*tx - fx*tz = (-1)(1) - (0)(0) = -1
        // so the raw cross is NEGATIVE when he is on the RIGHT. aimCoach.ts reads positive
        // as "right", so the sign is flipped HERE, once, with this derivation attached -
        // the first version shipped inverted and pointed every visitor the wrong way.
        val cross = fz * tx - fx * tz
        aimAngleDeg = if (cross >= 0f) -angle else angle

        // PREDICTIVE WHILE HE IS MOVING.
        //
        // Warning after he has already left the frame is too late - the visitor has
        // missed him and has to search. While walking the threshold tightens, so the
        // arrow appears while he is still on screen and near the edge.
        val limit = if (figureState == FIGURE_WALKING) AIM_WALK_WARN_DEG else AIM_OFF_SCREEN_DEG
        if (angle <= limit) {
            // He is in view but pulling away: a different problem needing different words.
            if (figureState == FIGURE_WALKING && tlen > AIM_FOLLOW_DIST_M) return AIM_FOLLOW
            return AIM_OK
        }

        // 4. He is off screen. NOW pitch is worth mentioning, because a steeply tilted
        //    phone is the likeliest reason and "hold it up" is actionable.
        val pitchDeg = Math.toDegrees(kotlin.math.asin(fy.coerceIn(-1f, 1f)).toDouble())
            .toFloat()
        if (pitchDeg < AIM_PITCH_MIN_DEG) return AIM_TOO_LOW
        if (pitchDeg > AIM_PITCH_MAX_DEG) return AIM_TOO_HIGH
        return AIM_OFF_TARGET
    }

    /**
     * Keep the contact shadow under his feet as he walks.
     *
     * The shadow is a child of the ANCHOR, not of the model, because it has to stay flat
     * on the ground while the model turns - parent it to a rotating figure and the shadow
     * spins with him, which looks worse than no shadow at all. The cost of that choice is
     * that it does not inherit his translation either: once he walked, the shadow stayed
     * at the anchor and he arrived four metres away with nothing beneath him. That is the
     * "he floats" report - the figure was on the floor the whole time, but the only cue
     * that said so had been left behind.
     *
     * So: copy his horizontal position, keep the anchor's ground height, ignore his yaw.
     */
    private fun shadowFollowTick() {
        val shadow = currentShadowNode ?: return
        val model = currentModelNode ?: return
        try {
            val p = model.position
            val cur = shadow.position
            if (kotlin.math.abs(cur.x - p.x) < 1e-4f && kotlin.math.abs(cur.z - p.z) < 1e-4f) return
            shadow.position = Position(p.x, SHADOW_LIFT_M, p.z)
        } catch (t: Throwable) {
            Log.w(TAG, "shadowFollowTick failed", t)
        }
    }

    /**
     * DRIFT GUARD - hold the figure steady when ARCore's own pose stops being trustworthy.
     *
     * Measured on device, phone held still: the anchor was perfect (arAnchorY = -2.140 on
     * every single frame) while ARCore's estimate of its OWN camera height swung -0.58 to
     * +0.32 m in about two seconds. Nothing was wrong with the anchor or the model. The
     * camera believed it had moved, so a stationary figure appeared to sink, and as the
     * estimated distance grew he rendered smaller.
     *
     * No placement logic can fix that, because the error is in the frame of reference
     * everything else is measured against. What CAN be done is notice it and stop trusting
     * the world position while it lasts: hold the figure at the distance and drop below
     * the camera that he had when tracking was last healthy. His size and eye-line then
     * stay put through the wobble, which is what the visitor actually judges.
     *
     * Detection is a rolling median, not a mean - a median ignores the very spikes we are
     * trying to detect, so the baseline stays honest while the pose misbehaves.
     */
    private fun driftGuardTick(frame: Frame) {
        val node = currentModelNode ?: return
        if (placedAtNanos == 0L) return
        // Never re-stage in the first moments after placement. The handover is visible,
        // and doing it immediately is what made him appear, then shift, then settle.
        if (System.nanoTime() - placedAtNanos < DRIFT_ARM_DELAY_NANOS) return
        try {
            // A pose from a frame that is not TRACKING is meaningless, and acting on it
            // is how the model gets moved by a number ARCore itself does not stand behind.
            if (frame.camera.trackingState != TrackingState.TRACKING) return

            // NOT WHILE HE IS MOVING UNDER HIS OWN STEAM.
            //
            // advanceWalk writes node.position and faceViewerTick writes node.rotation in
            // the same tick this runs in. A third writer correcting HEIGHT against a
            // camera that is itself swinging turns a walk into a stagger. The walk is
            // bounded and short; whatever height error accumulates over it is corrected
            // the moment he stops.
            if (figureState == FIGURE_WALKING) return

            val cam = frame.camera.pose
            val camY = cam.ty()

            // HAS THE WORLD ORIGIN DIVERGED, OR DID THE FLOOR ESTIMATE JUST DRIFT?
            //
            // Two different faults that look identical to a rolling median. Measured in
            // the office on 2026-08-26: camY climbed -0.11 -> +2.10 in eight seconds
            // while the phone was held still and ARCore's own detected floor stayed at
            // y=-1.16 throughout. The phone did not rise two metres; the origin moved.
            //
            // A person holding a phone can change camera height by a few tens of
            // centimetres - crouch, stand, raise it overhead. Beyond that it is not a
            // person moving, it is tracking failing, and the right response is to LEAVE
            // THE MODEL WHERE IT IS. Its anchor is attached to a plane that has not
            // moved; re-seating it against a bad origin is what threw it off screen.
            if (!camYAtPlacement.isNaN()) {
                val divergence = kotlin.math.abs(camY - camYAtPlacement)
                if (divergence > DRIFT_DIVERGENCE_M) {
                    if (driftStaging) {
                        driftStaging = false   // stop riding the diverging camera
                    }
                    if (!divergenceWarned) {
                        divergenceWarned = true
                        Log.w(
                            TAG,
                            ("DRIFT diverged: camY=%.2f placedAt=%.2f delta=%.2f > %.2f " +
                                "- world origin moved, NOT the floor. Holding the figure still.")
                                .format(camY, camYAtPlacement, divergence, DRIFT_DIVERGENCE_M),
                        )
                    }
                    camYHistory.clear()
                    return
                }
                if (divergenceWarned && divergence < DRIFT_DIVERGENCE_M * 0.5f) {
                    divergenceWarned = false
                    Log.i(TAG, "DRIFT divergence cleared: camY=%.2f".format(camY))
                }
            }

            camYHistory.addLast(camY)
            while (camYHistory.size > DRIFT_WINDOW_SAMPLES) camYHistory.removeFirst()
            if (camYHistory.size < DRIFT_WINDOW_SAMPLES) return
            val median = camYHistory.sorted()[camYHistory.size / 2]

            val excursion = kotlin.math.abs(camY - median)

            // TRIGGER ON THE MEASURED FAULT ONLY.
            //
            // This used to also fire when no floor plane was tracked, and indoors planes
            // go PAUSED within seconds - the census showed it all night - so the guard
            // engaged almost immediately on every placement. Plane detection is now off
            // entirely, so the only signal left is the one that was actually measured:
            // the camera's own height wandering while the phone is still.
            val unstable = excursion > DRIFT_TOLERANCE_M

            if (unstable && !driftStaging) {
                // LATCH FROM THE MEDIAN, NOT FROM THIS FRAME.
                //
                // This frame is by definition the outlier that crossed the threshold -
                // it is the single worst sample in the window. Latching the hold offset
                // from it baked that error in for the whole episode, which is why the
                // figure could settle at a visibly wrong height and stay there. The
                // median is the same statistic the detector already trusts.
                stagedDropM = median - node.worldPosition.y
                driftStaging = true
                Log.w(
                    TAG,
                    "DRIFT unstable: camY=%.2f median=%.2f excursion=%.2f -> holding feet %.2f m below camera"
                        .format(camY, median, excursion, stagedDropM),
                )
            } else if (!unstable && driftStaging && excursion < DRIFT_RECOVER_M) {
                driftStaging = false
                Log.i(
                    TAG,
                    "DRIFT recovered: camY=%.2f median=%.2f -> world anchor again"
                        .format(camY, median),
                )
            }

            if (driftStaging) {
                // HEIGHT ONLY. The drift we measured was vertical - camY swinging 0.9 m
                // while the anchor sat perfectly still - so vertical is all that is
                // corrected. Distance and bearing stay with the world anchor on purpose:
                // depth is what sets his APPARENT SIZE, and moving him in depth is what
                // made him shrink after placement. A figure that changes size is a worse
                // artifact than one that sits a few centimetres off.
                val cur = node.worldPosition
                // Track the MEDIAN camera height, not the live one. Gluing his Y to a
                // camera that is actively wobbling is what made him ride the phone when
                // you rotated toward him and away: the rotation itself is what moves
                // ARCore's camY estimate, so following it fed the fault back in.
                val targetY = median - stagedDropM
                node.worldPosition = Position(
                    cur.x,
                    cur.y + (targetY - cur.y) * STAGE_EASE,
                    cur.z,
                )
            }
        } catch (t: Throwable) {
            Log.w(TAG, "driftGuardTick failed", t)
        }
    }

    /**
     * Keep the figure turned toward the visitor, every frame.
     *
     * Setting the heading once at placement is what left him staring at empty space as
     * soon as the visitor moved: he was aimed at where they HAD been. A person being
     * addressed turns to follow you, so the yaw has to track.
     *
     * Yaw only - never pitch or roll. Tilting a standing man to face a raised phone reads
     * as a bug instantly. Rotation is eased at a fixed degrees-per-second rate rather than
     * snapped, so he turns like a person; the shortest-arc wrap keeps him from spinning
     * the long way round when the angle crosses 180.
     */
    private fun faceViewerTick(frame: Frame) {
        if (!faceViewer) return
        // While walking he faces his path, not the visitor. Without this the two tick
        // functions fight each other every frame and he walks sideways on the spot.
        if (figureState == FIGURE_WALKING) return
        val node = currentModelNode ?: return
        try {
            val cam = frame.camera.pose
            val np = node.worldPosition
            val dx = cam.tx() - np.x
            val dz = cam.tz() - np.z
            if (dx * dx + dz * dz < FACE_MIN_DIST_SQ) return
            val target = Math.toDegrees(kotlin.math.atan2(dx.toDouble(), dz.toDouble()))
                .toFloat()
            var delta = (target - currentYawDeg + 540f) % 360f - 180f
            val maxStep = FACE_TURN_DEG_PER_SEC * lastFrameDtSec
            if (maxStep > 0f && kotlin.math.abs(delta) > maxStep) {
                delta = if (delta > 0f) maxStep else -maxStep
            }
            if (kotlin.math.abs(delta) < FACE_DEADBAND_DEG) return
            currentYawDeg = (currentYawDeg + delta + 360f) % 360f
            node.rotation = Rotation(0f, currentYawDeg, 0f)
        } catch (t: Throwable) {
            Log.w(TAG, "faceViewerTick failed", t)
        }
    }

    fun setAnimationClip(name: String?) {
        val clean = name?.takeIf { it.isNotBlank() }
        if (clean == animationClip) return
        animationClip = clean
        currentModelNode?.let { applyAnimationClip(it) }
    }

    /**
     * Play the requested clip by NAME, looping.
     *
     * Selection is by name and not by index on purpose: index order is an artefact of
     * whatever the exporter wrote first and silently changes when a clip is added, which
     * would swap a walking figure for a standing one with no error anywhere.
     */
    private fun applyAnimationClip(modelNode: ModelNode) {
        val want = animationClip ?: return
        try {
            val animator = modelNode.animator ?: return
            val count = animator.animationCount
            var index = -1
            for (i in 0 until count) {
                if (animator.getAnimationName(i) == want) { index = i; break }
            }
            if (index < 0) {
                val have = (0 until count).joinToString(", ") { animator.getAnimationName(it) ?: "" }
                Log.w(TAG, "animation clip '$want' not found; model has [$have]")
                post { onARError?.invoke("animation '$want' not on this model") }
                return
            }
            // Stop whatever autoAnimate started, else two clips drive the same bones.
            for (i in 0 until count) {
                if (i != index) try { modelNode.stopAnimation(i) } catch (_: Throwable) {}
            }
            modelNode.playAnimation(index, 1f, true)
            Log.i(TAG, "PHASE0 playing clip '$want' (index $index of $count)")
        } catch (t: Throwable) {
            Log.w(TAG, "applyAnimationClip failed", t)
        }
    }

    /**
     * Count the morph targets on a just-loaded model and bind the track to them.
     *
     * DO NOT CALL FilamentAsset.getMorphTargetNames() HERE. It was the first thing
     * this function did, and it segfaulted the app every time the journey opened:
     *
     *     F libc : Fatal signal 11 (SIGSEGV), code 2 (SEGV_ACCERR)
     *     #00 pc 000000000019f82c  libgltfio-jni.so
     *
     * glTF keeps morph-target NAMES in `mesh.extras.targetNames`, which lives in the
     * parsed SOURCE data - and SceneView's ModelLoader calls
     * `FilamentAsset.releaseSourceData()` as soon as a model finishes loading (four
     * call sites in io.github.sceneview.loaders.ModelLoader). By the time this runs
     * the names have been freed, so reading them is a use-after-free. The COUNT, by
     * contrast, comes from the renderable via `RenderableManager.getMorphTargetCount`,
     * which stays live for as long as the model does.
     *
     * So the binding is BY ORDER, not by name, and the honesty moved to build time:
     * tools/lipsync_envelope.py writes `visemeNames` in the same order the Blender
     * export writes the targets, and the count is checked against the track here. A
     * mismatch is logged loudly and the mouth left shut rather than driven wrong.
     */
    private fun probeMorphTargets(modelNode: ModelNode) {
        morphCount = 0
        morphEntities = IntArray(0)
        morphWeights = FloatArray(0)
        visemeSlot = IntArray(0)
        visemeMissWarned = false
        try {
            val rm = engine?.renderableManager ?: run {
                Log.w(TAG, "VISEME no engine yet; morph probe skipped")
                return
            }
            // renderableNodes is SceneView's own list - the same one its
            // setMorphWeights() iterates - so this asks exactly the objects that will
            // later be written to, and never the asset's freed source data.
            var count = 0
            for (node in modelNode.renderableNodes) {
                val inst = try { rm.getInstance(node.entity) } catch (t: Throwable) { 0 }
                if (inst == 0) continue
                val n = try { rm.getMorphTargetCount(inst) } catch (t: Throwable) { 0 }
                if (n > count) count = n
            }
            if (count <= 0) {
                Log.i(TAG, "VISEME model carries no morph targets (mouth will not move)")
                return
            }
            // Keep the instances that carry exactly `count` targets and write only to
            // those. ModelNode.setMorphWeights() fans out to EVERY renderable, and
            // Filament requires offset + weights.length <= that renderable's own target
            // count - so a model with a second, morph-less mesh would abort the process
            // exactly the way getMorphTargetNames just did.
            val entities = ArrayList<Int>()
            for (node in modelNode.renderableNodes) {
                val inst = try { rm.getInstance(node.entity) } catch (t: Throwable) { 0 }
                if (inst == 0) continue
                val n = try { rm.getMorphTargetCount(inst) } catch (t: Throwable) { 0 }
                if (n == count) entities.add(node.entity)
            }
            morphEntities = entities.toIntArray()
            morphCount = count
            morphWeights = FloatArray(count)
            Log.i(
                TAG,
                "VISEME model morph targets: " + count + " on " +
                    morphEntities.size + " of " + modelNode.renderableNodes.size +
                    " renderable(s)",
            )
            rebuildVisemeSlots()
        } catch (t: Throwable) {
            Log.w(TAG, "morph-target probe failed", t)
        }
    }

    /**
     * Bind the loaded track to this model's morph slots, BY ORDER.
     *
     * Called from both ends because the two arrive in either order: the track can be
     * set before the model finishes downloading, or a new model can load under a track
     * that is already playing.
     *
     * Order, not name - see probeMorphTargets for why names cannot be read at runtime
     * without crashing the process. The guard that replaces the name check is the
     * COUNT: if the asset does not carry exactly as many targets as the track expects,
     * the pairing is not trustworthy, so nothing is bound and the mouth stays shut. A
     * silently wrong mouth is worse than a still one.
     */
    private fun rebuildVisemeSlots() {
        val trackNames = visemeTrackNames
        if (morphCount <= 0 || trackNames.isEmpty()) return
        if (trackNames.size != morphCount) {
            visemeSlot = IntArray(0)
            Log.w(
                TAG,
                "VISEME track/model mismatch: track has " + trackNames.size +
                    " visemes but the model carries " + morphCount +
                    " morph targets. Mouth disabled rather than driven wrong.",
            )
            return
        }
        visemeSlot = IntArray(trackNames.size) { it }
        Log.i(TAG, "VISEME bound " + morphCount + " targets by order")
    }

    private var visemeTrackNames: Array<String> = emptyArray()

    /**
     * Load a precomputed viseme track (the JSON that lipsync_envelope.py writes).
     *
     * Null or malformed clears the track and lets the mouth relax shut, which is the
     * correct failure: a figure with a closed mouth reads as listening, whereas one
     * frozen mid-vowel reads as broken.
     */
    fun setVisemeTrack(json: String?) {
        if (json.isNullOrBlank()) {
            visemeIds = null
            visemeAmps = null
            visemeTrackNames = emptyArray()
            visemePlaying = false
            return
        }
        try {
            val o = JSONObject(json)
            val names = o.optJSONArray("visemeNames") ?: JSONArray()
            val ids = o.optJSONArray("viseme") ?: JSONArray()
            val amps = o.optJSONArray("visemeWeight") ?: JSONArray()
            val n = minOf(ids.length(), amps.length())
            if (n == 0 || names.length() == 0) {
                Log.w(TAG, "VISEME track has no frames; ignoring")
                return
            }
            visemeTrackNames = Array(names.length()) { names.optString(it, "") }
            visemeIds = IntArray(n) { ids.optInt(it, -1) }
            visemeAmps = FloatArray(n) { amps.optDouble(it, 0.0).toFloat() }
            visemeWindowS = o.optDouble("windowSeconds", 0.040).toFloat().coerceAtLeast(0.001f)
            rebuildVisemeSlots()
            Log.i(
                TAG,
                "VISEME track loaded: $n frames @ ${"%.0f".format(visemeWindowS * 1000)} ms " +
                    "(${"%.1f".format(n * visemeWindowS)}s) names=[${visemeTrackNames.joinToString(",")}]",
            )
        } catch (t: Throwable) {
            Log.w(TAG, "VISEME track parse failed", t)
            visemeIds = null
            visemeAmps = null
        }
    }

    /**
     * Re-anchor the viseme clock to the audio player's real position.
     *
     * JS sends this on play and then a few times a second. Between anchors the tick
     * advances on the monotonic clock, so a 4 Hz update is plenty and the bridge is
     * never asked to carry per-frame traffic.
     */
    fun setVisemePositionMs(positionMs: Int) {
        visemeAnchorMs = positionMs.coerceAtLeast(0)
        visemeAnchorAtNanos = System.nanoTime()
    }

    /**
     * Whether the narration is actually sounding.
     *
     * Kept separate from the position on purpose: React sets props in no guaranteed
     * order, so a combined setter would let a stale "playing" ride in on a position
     * update and keep the mouth moving through a pause. Starting playback also
     * re-stamps the anchor instant, so the time spent paused is not counted as
     * elapsed audio.
     */
    fun setVisemePlaying(playing: Boolean) {
        if (playing == visemePlaying) return
        visemePlaying = playing
        visemeAnchorAtNanos = System.nanoTime()
    }

    /**
     * Per-frame mouth update. Cheap: two array reads, a lerp, and one setMorphWeights.
     *
     * When nothing is playing the weights DECAY rather than snapping to zero — a mouth
     * that slams shut on the last syllable is the tell that this is keyframed.
     */
    private fun visemeTick() {
        val node = currentModelNode ?: return
        if (morphWeights.isEmpty()) return

        val ids = visemeIds
        val amps = visemeAmps
        if (!visemePlaying || ids == null || amps == null || ids.isEmpty()) {
            var moving = false
            for (i in morphWeights.indices) {
                if (morphWeights[i] > 0.002f) {
                    morphWeights[i] *= 0.82f
                    moving = true
                } else if (morphWeights[i] != 0f) {
                    morphWeights[i] = 0f
                    moving = true
                }
            }
            if (moving) applyMorphWeights()
            return
        }

        val elapsed = (System.nanoTime() - visemeAnchorAtNanos) / 1_000_000_000.0f
        val tSec = visemeAnchorMs / 1000.0f + elapsed
        val pos = tSec / visemeWindowS
        val i0 = kotlin.math.floor(pos).toInt()
        if (i0 >= ids.size) {
            // Past the end of the track: let it relax shut on the next tick.
            visemePlaying = false
            return
        }
        val i = i0.coerceAtLeast(0)
        val j = (i + 1).coerceAtMost(ids.size - 1)
        val frac = (pos - i).coerceIn(0f, 1f)

        java.util.Arrays.fill(morphWeights, 0f)
        addViseme(ids[i], amps[i] * (1f - frac))
        addViseme(ids[j], amps[j] * frac)
        applyMorphWeights()
    }

    private fun addViseme(trackId: Int, weight: Float) {
        if (trackId < 0 || trackId >= visemeSlot.size || weight <= 0f) return
        val slot = visemeSlot[trackId]
        if (slot < 0 || slot >= morphWeights.size) return
        morphWeights[slot] = (morphWeights[slot] + weight).coerceAtMost(1f)
    }

    private fun applyMorphWeights() {
        if (morphEntities.isEmpty() || morphWeights.isEmpty()) return
        try {
            val rm = engine?.renderableManager ?: return
            for (e in morphEntities) {
                // Resolve the instance NOW. Never cache it - see morphEntities.
                val inst = rm.getInstance(e)
                if (inst == 0) continue
                // Re-check the width before every write. This is the guard that makes
                // an out-of-bounds write structurally impossible rather than merely
                // unlikely: if this entity is not the renderable we probed, or its
                // morphing was rebuilt, the count will not match and we skip it.
                if (rm.getMorphTargetCount(inst) != morphWeights.size) continue
                rm.setMorphWeights(inst, morphWeights, 0)
            }
        } catch (t: Throwable) {
            if (!visemeMissWarned) {
                visemeMissWarned = true
                Log.w(TAG, "setMorphWeights failed; mouth disabled for this model", t)
            }
        }
    }

    private fun reportModelAnimations(modelNode: ModelNode) {
        val cb = onModelAnimations ?: return
        val names = mutableListOf<String>()
        val durations = mutableListOf<Float>()
        var count = 0
        try {
            val animator = modelNode.animator
            if (animator == null) {
                // No animator at all: the instance carries no skeleton/clips. This is
                // a real answer, not an error — report zero rather than staying silent.
                Log.i(TAG, "PHASE0 animations: animator is null (no skeleton on model)")
            } else {
                count = animator.animationCount
                for (i in 0 until count) {
                    names.add(
                        try {
                            animator.getAnimationName(i) ?: ""
                        } catch (t: Throwable) {
                            ""
                        },
                    )
                    durations.add(
                        try {
                            animator.getAnimationDuration(i)
                        } catch (t: Throwable) {
                            0f
                        },
                    )
                }
                Log.i(
                    TAG,
                    "PHASE0 animations: count=$count names=${names.joinToString(", ")} " +
                        "durations=${durations.joinToString(", ")}",
                )
            }
        } catch (t: Throwable) {
            // Never let a diagnostic take the model down — the render is the point.
            Log.w(TAG, "PHASE0 animation probe failed", t)
        }
        post { cb.invoke(count, names.toList(), durations.toList()) }
    }

    /**
     * Loads models on OUR scope so a failure is catchable.
     *
     * SceneView's `loadModelInstanceAsync` launches on its own `StandaloneCoroutine`
     * with no exception handler, so a throw inside it never passes through the
     * caller's try/catch and goes straight to the default handler. A GLB that had
     * been deleted from the device therefore KILLED THE APP the instant the figure
     * was placed — twice in a row, until Android marked the process bad. With the
     * asset now coming from CloudFront the same fate awaits a failed or truncated
     * download, so the load has to be contained rather than merely attempted.
     *
     * Dispatchers.Default matches where the library already ran this: decoding a
     * meshopt/KTX2 GLB is hundreds of milliseconds of CPU and must not sit on the
     * main thread. Children are cancelled (not the scope) in cleanup(), so an
     * in-flight load cannot resolve into a torn-down scene while the view stays
     * reusable if it is ever re-attached.
     */
    private val modelScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * The on-disk [File] a model URI points at, or null when it is remote.
     *
     * `file://…` and bare `/…` paths are both in play: the dev harness used to hand
     * over a raw sdcard path, and getOrFetchGlb() hands over a cached download.
     * Anything with a scheme we do not own (http/https/android_asset) is the loader's
     * problem, not ours.
     */
    private fun localPathOf(uri: String): File? = try {
        when {
            uri.startsWith("file://") -> File(Uri.parse(uri).path ?: return null)
            uri.startsWith("/") -> File(uri)
            else -> null
        }
    } catch (t: Throwable) {
        Log.w(TAG, "could not resolve local path for $uri", t)
        null
    }

    /**
     * CONTACT SHADOW - the single strongest cue that the figure is standing ON something.
     *
     * A figure with no shadow reads as pasted onto the camera feed no matter how good the
     * tracking is, which is the actual reason this looked unreal: days went into anchor
     * accuracy while the cue that sells it was missing entirely.
     *
     * WHY A PAINTED BLOB AND NOT A REAL SHADOW MAP. Filament casts shadows onto GEOMETRY,
     * and the real floor is a camera image, not geometry - there is nothing in the scene
     * for a shadow to land on. Ada Rose Cannon puts it exactly: "You still won't see a
     * shadow because it needs to hit something." The usual remedy is an invisible
     * shadow-catcher material, which in Filament means a compiled .filamat this build has
     * no toolchain for. A radial-gradient decal laid flat under the feet is the standard
     * mobile-AR answer: it costs one textured quad, needs no shadow pass at all (the
     * directional light's caster stays OFF, so the 47 m fort keeps its exemption and the
     * per-frame cost that was measured and rejected is not reintroduced), and at the
     * distance a visitor stands it is indistinguishable from the real thing.
     *
     * Sized off the model's own measured bounding box rather than a guessed constant,
     * because this asset's scale has already been wrong twice.
     */
    private fun attachContactShadow(anchorNode: AnchorNode, modelNode: ModelNode) {
        if (!contactShadowEnabled) return
        val matl = materialLoader ?: return
        try {
            val bb = modelNode.boundingBox
            val sc = modelNode.scale.x
            // Footprint, not silhouette: a standing person's shadow is roughly their
            // shoulder width and about half that front-to-back.
            val widthM = (bb.halfExtent[0] * 2f * sc * SHADOW_WIDTH_FRACTION)
                .coerceIn(SHADOW_MIN_M, SHADOW_MAX_M)
            val depthM = widthM * SHADOW_DEPTH_RATIO
            val bmp = blobShadowBitmap ?: buildBlobShadowBitmap().also { blobShadowBitmap = it }
            val node = ImageNode(
                materialLoader = matl,
                bitmap = bmp,
                size = Position(widthM, depthM, 0f),
            ).apply {
                // ImageNode is a PlaneNode standing in XY facing +Z; -90 deg about X lays
                // it on the ground. Lifted a few mm so depth occlusion cannot z-fight it
                // against the floor it is drawn on.
                rotation = Rotation(-90f, 0f, 0f)
                position = Position(0f, SHADOW_LIFT_M, 0f)
            }
            anchorNode.addChildNode(node)
            currentShadowNode = node
            Log.i(
                TAG,
                "contact shadow: %.2f x %.2f m at anchor+%.3f".format(widthM, depthM, SHADOW_LIFT_M),
            )
        } catch (t: Throwable) {
            Log.w(TAG, "contact shadow failed", t)
        }
    }

    /** Soft dark ellipse, opaque at the centre and transparent at the rim. */
    private fun buildBlobShadowBitmap(): android.graphics.Bitmap {
        val px = 256
        val bmp = android.graphics.Bitmap.createBitmap(
            px, px, android.graphics.Bitmap.Config.ARGB_8888,
        )
        val canvas = android.graphics.Canvas(bmp)
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
        val r = px / 2f
        paint.shader = android.graphics.RadialGradient(
            r, r, r,
            intArrayOf(
                android.graphics.Color.argb(150, 0, 0, 0),
                android.graphics.Color.argb(105, 0, 0, 0),
                android.graphics.Color.argb(40, 0, 0, 0),
                android.graphics.Color.TRANSPARENT,
            ),
            floatArrayOf(0f, 0.42f, 0.72f, 1f),
            android.graphics.Shader.TileMode.CLAMP,
        )
        canvas.drawCircle(r, r, r, paint)
        return bmp
    }

    private fun attachModel(anchorNode: AnchorNode, glbUri: String) {
        val loader = modelLoader ?: run {
            post { onARError?.invoke("AR not ready") }
            return
        }
        // Cheap pre-flight for anything already on disk. Filament's loader reports a
        // missing file by throwing off-thread, which is both fatal and uninformative;
        // asking File first turns it into a message naming the actual problem.
        localPathOf(glbUri)?.let { f ->
            if (!f.exists() || f.length() == 0L) {
                Log.e(TAG, "model file missing or empty: ${f.absolutePath}")
                post { onARError?.invoke("model file missing") }
                return
            }
        }
        try {
            modelScope.launch {
                val modelInstance = try {
                    loader.loadModelInstance(Uri.parse(glbUri).toString())
                } catch (t: Throwable) {
                    // Missing, truncated, or not a GLB at all. Any of these used to
                    // take the process down.
                    Log.e(TAG, "model load failed: $glbUri", t)
                    null
                }
                if (modelInstance == null) {
                    post { onARError?.invoke("model load failed") }
                    return@launch
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
                    if (groundAnchored) {
                        // Face him ACROSS the viewer's line of sight and walk him along
                        // that facing, so he crosses the frame at a constant distance
                        // instead of closing on the camera. Walking toward the viewer
                        // ends with the figure on top of them; walking directly away
                        // shows only his back. Across is the one heading that stays
                        // legible and lets the viewer pan to follow, which is how this
                        // is meant to be watched.
                        // FACE THE VISITOR. He is being spoken to, not walked past.
                        //
                        // The old heading was placementCamYawDeg + 90, which turns him
                        // ACROSS the line of sight - correct when he walked over the
                        // frame, wrong the moment he stands and talks, and the reason he
                        // read as "facing away or looking to the side".
                        //
                        // 180 is derived, not tuned: the model's forward is local -Z, so
                        // a yaw of t points it at (-sin t, 0, -cos t). Setting that equal
                        // to the vector BACK toward the camera gives t = atan2(fx, fz),
                        // which is exactly placementCamYawDeg + 180 (mod 360).
                        currentYawDeg =
                            (placementCamYawDeg + faceOffsetDeg + 360f) % 360f
                        Log.i(
                            TAG,
                            "figure heading %.0f deg (camera %.0f + %.0f, mode=%s)".format(
                                currentYawDeg, placementCamYawDeg, faceOffsetDeg,
                                if (faceViewer) "FACE_VIEWER" else "ACROSS",
                            ),
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
                    walkTravelled = 0f
                    placedAtNanos = System.nanoTime()
                    driftStaging = false
                    divergenceWarned = false
                    camYAtPlacement = try {
                        arFrame?.camera?.pose?.ty() ?: Float.NaN
                    } catch (t: Throwable) { Float.NaN }
                    camYHistory.clear()
                    // What size did this ACTUALLY end up? Asked, not assumed.
                    //
                    // This asset has a 100x unit mismatch baked in by Meshy (skeleton in
                    // cm under a 0.01 root scale, mesh in m), so neither the authored
                    // numbers nor the scaleToUnits target predict what lands on screen.
                    // Two rounds were lost to reasoning about it from the file instead of
                    // reading it off the node.
                    try {
                        val sz = modelNode.size
                        val wp = modelNode.worldPosition
                        // WHERE ARE HIS FEET? The node's position is not the same thing.
                        // The bounding box is offset from the origin by whatever the
                        // asset author baked in — and this asset carries an 11.7 mm
                        // ground nudge that sits ABOVE the 0.01 root scale, so SceneView's
                        // corrective x100 multiplies it into ~1.17 m of vertical offset.
                        // Log the actual world extent so the error is visible instead of
                        // inferred.
                        try {
                            val bb = modelNode.boundingBox
                            val cy = bb.center[1]
                            val hy = bb.halfExtent[1]
                            val sc = modelNode.scale.y
                            Log.i(
                                TAG,
                                ("PHASE3 feet/head: boxCenterY=%.4f halfY=%.4f scale=%.2f " +
                                    "-> feetWorldY=%.3f headWorldY=%.3f (anchorY=%.3f)")
                                    .format(
                                        cy, hy, sc,
                                        wp.y + (cy - hy) * sc,
                                        wp.y + (cy + hy) * sc,
                                        wp.y,
                                    ),
                            )
                        } catch (t: Throwable) {
                            Log.w(TAG, "bbox probe failed", t)
                        }
                        Log.i(
                            TAG,
                            ("PHASE3 model size: %.3f x %.3f x %.3f m  scale=%.4f " +
                                "trueScale=%s scaleToUnits=%.2f worldY=%.3f")
                                .format(
                                    sz.x, sz.y, sz.z,
                                    modelNode.scale.x,
                                    modelTrueScale, modelScale, wp.y,
                                ),
                        )
                    } catch (t: Throwable) {
                        Log.w(TAG, "size probe failed", t)
                    }
                    attachContactShadow(anchorNode, modelNode)
                    reportModelAnimations(modelNode)
                    probeMorphTargets(modelNode)
                    applyAnimationClip(modelNode)
                    // Model is now world-locked via its anchor — stop continuous
                    // plane finding to cut sustained CPU load / heat. Re-enabled on
                    // clearAnchor() for a re-scan.
                    //
                    // EXCEPT for a ground-standing figure, whose height may still be an
                    // assumption waiting on a real floor. See reseatOnFloor().
                    if (!groundAnchored) setPlaneFinding(false)
                    post { onAnchorPlaced?.invoke("detect_place") }
                    // Float the data placard above the model, if a card is set.
                    //
                    // POSTED, not called inline. Everything in this block runs on
                    // Dispatchers.Default (modelScope), and attachCard() destroys and
                    // rebuilds card nodes — Filament scene mutations racing the main
                    // thread's billboard loop and hitTestCards over an unsynchronised
                    // cardNodes/cardRecords. That is an independent use-after-free from
                    // the engine-teardown one destroyNodeSafely guards; both produced
                    // the same native SIGSEGV. Posting puts every card mutation on the
                    // one thread that owns the scene graph.
                    cardData?.let { json -> post { attachCard(anchorNode, json) } }
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

    /**
     * Build one card (bitmap placard, or a video card when the JSON carries
     * `video_url`) and add it to the anchor as a billboarded node.
     */
    private fun addCardNode(
        anchorNode: AnchorNode,
        json: String,
        position: Position,
        scale: Float,
    ) {
        val matl = materialLoader ?: return
        try {
            val rec = buildCardNode(matl, json, cardNodes.size, scale) ?: return
            rec.node.position = position
            anchorNode.addChildNode(rec.node)
            cardNodes.add(rec.node)
            cardRecords.add(rec)
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
        // Drop any in-flight model load. cancelChildren rather than cancel: cleanup()
        // runs twice (onDetachedFromWindow + onDropViewInstance) and cancelling the
        // SupervisorJob itself would leave the scope permanently dead.
        try {
            modelScope.coroutineContext.cancelChildren()
        } catch (_: Throwable) {
        }
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

        // PHASE 0 frame-time sampler. ~4 s of history at the BLOCKING-paced 30 fps,
        // long enough that one bad frame cannot swing the p95 on its own.
        private const val FRAME_SAMPLE_SIZE = 120
        private const val FRAME_REPORT_INTERVAL_NANOS = 1_000_000_000L
        private const val CENSUS_INTERVAL_NANOS = 1_000_000_000L

        /** How often to check whether a better floor has appeared. */
        private const val RESEAT_INTERVAL_NANOS = 500_000_000L

        /** Ignore corrections smaller than this; below it the move is not worth the jump. */
        private const val RESEAT_EPSILON_M = 0.04f

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
         * How far below the camera a plane must sit to be treated as the FLOOR.
         *
         * A phone is held roughly 1.2-1.6 m up, a desk stands about 0.75 m, so the drop
         * to a desk is ~0.5-0.85 m and the drop to the floor is ~1.2-1.6 m. 0.9 m sits
         * between the two: it rejects the desk that ARCore finds first indoors, which is
         * what put a correctly-sized 1.70 m figure at head height.
         *
         * The upper bound stops a plane glimpsed through a doorway, down a stairwell, or
         * on the floor below from dragging the figure into the basement.
         */
        /**
         * Where the figure walks, in degrees off the viewer's line of sight.
         * 0 = straight at you (ends with him on top of the camera), 180 = directly
         * away (you watch his back leave), 90 = across the frame at constant distance.
         */
        private const val WALK_HEADING_OFFSET_DEG = 90f

        /** Turn rate for facing the visitor - fast enough to follow, slow enough to read. */
        /** Turning radius for the U-turn.
         *
         * A straight-line walk cycle forced round a curve makes the feet scuff, and the
         * tighter the radius the more the legs visibly twist against the direction of
         * travel - which reads as the body distorting. Widening to 0.9 m eases that.
         * It cannot be widened much further indoors: a 180 degree arc displaces him 2R
         * sideways, so every extra centimetre of radius is two more of room needed. */
        private const val WALK_ARC_RADIUS_M = 0.9f

        const val FIGURE_SPEAKING = "SPEAKING"
        const val FIGURE_WALKING = "WALKING"

        const val AIM_OK = "OK"
        const val AIM_OFF_TARGET = "OFF_TARGET"
        const val AIM_TOO_LOW = "TOO_LOW"
        const val AIM_TOO_HIGH = "TOO_HIGH"
        const val AIM_TOO_FAST = "TOO_FAST"
        const val AIM_COVERED = "COVERED"
        const val AIM_FOLLOW = "FOLLOW"

        /** ~0.4 s at 30 fps to raise a warning, ~0.6 s to withdraw one. */
        private const val AIM_ENTER_FRAMES = 12
        private const val AIM_LEAVE_FRAMES = 18
        /** Half the horizontal field of view, near enough - past this he is off screen. */
        private const val AIM_OFF_SCREEN_DEG = 32f
        /** Tighter while he walks, so the arrow arrives BEFORE he leaves the frame. */
        private const val AIM_WALK_WARN_DEG = 22f
        /** Past this he is getting away and "follow him" is the useful instruction. */
        private const val AIM_FOLLOW_DIST_M = 6f
        /** Looking at your own feet / straight up at the ceiling. */
        private const val AIM_PITCH_MIN_DEG = -60f
        private const val AIM_PITCH_MAX_DEG = 60f
        private const val AIM_MAX_TURN_DEG_PER_SEC = 160f
        /** Below this the lens is covered, not merely in a dark room. */
        private const val LUMA_COVERED = 8

        /** ~2 s of frames at 30 fps; long enough to have a baseline, short enough to react. */
        private const val DRIFT_WINDOW_SAMPLES = 60
        /** A hand-held phone stands this far above the floor; outside is furniture or noise. */
        private const val FLOOR_DROP_MIN = 0.85f
        private const val FLOOR_DROP_MAX = 2.20f
        /** Cap the averaging window so the estimate can still follow a real change. */
        private const val FLOOR_DROP_MAX_SAMPLES = 12
        /** A card pins to a tapped surface: nearer is the visitor's own hand, farther is sky or noise. */
        private const val CARD_HIT_MIN_M = 0.35f
        private const val CARD_HIT_MAX_M = 8f
        /** How far ABOVE the phone a tapped surface may sit (a lintel, the top of a pillar). */
        private const val CARD_RISE_MAX_M = 1.0f
        /** Depth-pinned cards float this far in front of the tapped surface, towards the visitor. */
        private const val CARD_STANDOFF_M = 0.15f
        private const val PREFS_AR = "epocheye_ar"
        private const val PREF_FLOOR_DROP = "floor_drop_m"

        /** Settle time after placement before the guard may touch anything. */
        private const val DRIFT_ARM_DELAY_NANOS = 1_500_000_000L
        /** Beyond this excursion from the median the pose is not worth trusting. */
        private const val DRIFT_TOLERANCE_M = 0.35f

        /**
         * How far the camera may sit from its placement height before the guard treats
         * the world origin as diverged and stops correcting anything.
         *
         * 0.9 m is above anything a standing person does with a phone (crouch to
         * overhead is roughly 0.6 m) and far below the 2.2 m of pure divergence
         * measured indoors on a dim, featureless floor.
         */
        private const val DRIFT_DIVERGENCE_M = 0.9f
        /** Tighter than the trigger, so recovery does not flap against it. */
        private const val DRIFT_RECOVER_M = 0.18f
        /** Per-frame easing toward the staged pose - a snap would read as a pop. */
        private const val STAGE_EASE = 0.18f

        private const val FACE_TURN_DEG_PER_SEC = 140f
        /** Below this the turn is not worth doing; stops micro-jitter on a still phone. */
        private const val FACE_DEADBAND_DEG = 0.75f
        /** Standing on top of him makes the bearing meaningless - 0.35 m squared. */
        private const val FACE_MIN_DIST_SQ = 0.1225f

        /**
         * Minimum drop below the camera for a hit the viewer AIMED at.
         *
         * Deliberately small. If someone points at the ground and the ray lands on it,
         * that is the ground — arguing with them via a threshold is how a real floor hit
         * got discarded in favour of a guessed one. 25 cm only excludes a hit at or
         * above the phone itself, which cannot be floor.
         */
        /** Dark for this long before the lamp comes on - long enough to ignore a pan
         *  across one shadowed patch, short enough not to leave the viewer waiting. */
        private const val LOW_LIGHT_TORCH_DELAY_NANOS = 2_000_000_000L

        /** Every 16th pixel in both axes - ~1/256th of the frame, plenty for a mean. */
        /** Shadow footprint as a fraction of the model's measured width. */
        private const val SHADOW_WIDTH_FRACTION = 0.62f
        private const val SHADOW_DEPTH_RATIO = 0.62f
        private const val SHADOW_MIN_M = 0.35f
        private const val SHADOW_MAX_M = 3.0f
        private const val SHADOW_LIFT_M = 0.005f

        private const val LUMA_SAMPLE_STRIDE = 16

        /** ~2 Hz. A brightness reading does not need the frame rate. */
        private const val LUMA_SAMPLE_INTERVAL_NANOS = 500_000_000L
        private const val MIN_AIMED_DROP_M = 0.25f

        private const val MIN_FLOOR_DROP_M = 0.9f
        private const val MAX_FLOOR_DROP_M = 2.5f

        /**
         * How far ahead of the camera a surface-less anchor is seated.
         *
         * 1.2 m suits a small object card you lean in to read. It does NOT suit a
         * person: a phone's vertical field of view spans only about 1.4 m at that
         * range, so a 1.70 m figure does not fit on screen at all and the viewer is
         * left looking UP at a torso. On device that reads as "the model is enormous
         * and standing on my head" even when it measures exactly 1.700 m at floor
         * height — which is precisely how this was misdiagnosed twice.
         *
         * 3 m fits a standing adult with headroom (2 * 3 * tan(30 deg) = 3.4 m of
         * visible height) and is still well inside ARCore's ~8 m drift radius.
         */
        /**
         * How far in front of the viewer a standing FIGURE is placed, measured along
         * the GROUND rather than along the camera's tilted forward axis.
         *
         * 2.5 m fits a 1.7 m adult inside a phone's vertical field of view with
         * headroom (2 * 2.5 * tan(30 deg) = 2.9 m visible). Inside about 2 m a
         * life-size person cannot fit on screen at all, which reads as "enormous"
         * rather than "too close".
         */
        private const val FIGURE_DISTANCE_M = 2.5f

        /**
         * A tapped plane more than this above the session's floor is furniture.
         * 0.35 m: comfortably above ARCore's plane-height jitter (the same floor was
         * reported at -1.00 and -1.12 within seconds) and well below a desk (0.75 m).
         */
        private const val FLOOR_TOLERANCE_M = 0.35f

        /** A plane must have reached this extent (both axes) to count as a floor candidate. */
        private const val FLOOR_MIN_EXTENT_M = 0.5f

        private const val PLACE_DISTANCE_OBJECT_M = 1.2f
        private const val PLACE_DISTANCE_FIGURE_M = 3.0f

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
