package com.epocheye.ar

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.util.Log
import android.view.Surface
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.filament.IndirectLight
import com.google.android.filament.View as FilamentView
import dev.romainguy.kotlin.math.Float3
import dev.romainguy.kotlin.math.Float4
import dev.romainguy.kotlin.math.Mat4
import dev.romainguy.kotlin.math.quaternion
import com.google.ar.core.Config
import io.github.sceneview.SceneView
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.ARCameraNode
import io.github.sceneview.ar.rememberARCameraNode
import io.github.sceneview.environment.Environment
import io.github.sceneview.loaders.ModelLoader
import io.github.sceneview.node.CameraNode
import io.github.sceneview.node.ModelNode
import io.github.sceneview.node.Node as SvNode
import io.github.sceneview.rememberCameraNode
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberMainLightNode
import io.github.sceneview.rememberMaterialLoader
import io.github.sceneview.rememberModelLoader
import io.github.sceneview.rememberView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.File
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/**
 * The Bangalore Fort MAGIC WINDOW: a camera-off, gyroscope-driven reconstruction.
 *
 * This is deliberately NOT an AR view. There is no ARCore session, no camera
 * permission, no plane detection and no anchor - because every AR route at
 * Bangalore Fort failed on the EVIDENCE, not the engineering: the 1791 breach is
 * 103 m east in a bus yard behind a treeline, the photogrammetry scan has no
 * metric scale, and no ground anchor exists. A magic window needs none of those.
 * The visitor stands still and looks around.
 *
 * It hosts the plain (non-AR) SceneView composable in a [ComposeView], the same
 * hosting shape [EpocheyeDetectARView] uses for ARSceneView. No new dependency:
 * io.github.sceneview:arsceneview already pulls io.github.sceneview:sceneview
 * transitively.
 *
 * PRODUCT RULE - GYROSCOPE ROTATION ONLY, NO TRANSLATION.
 * The camera position is set from the authored viewpoint and never moves. The
 * camera gesture manipulator is disabled. MASTER-STATUS S9's walk-into-traffic
 * mechanism does not apply here (the camera is off, nothing is registered to real
 * ground) but the view must never reward walking, and must never be presented as
 * navigation.
 *
 * THREE TRAPS THIS FILE EXISTS TO AVOID
 *
 *  1. scaleToUnits NORMALISES. It resizes a model so its largest bounding-box
 *     dimension equals N metres. For a 576 m surveyed fort that is a silent
 *     collapse to N. The model is therefore loaded at its authored true scale and
 *     [onModelLoaded] reports the measured extents so the trap is testable on
 *     device rather than by eye.
 *  2. The scene stacks FIVE flat ground-plan layers 0.060 m apart (z =
 *     0.00/0.06/0.12/0.18/0.24) and reads them at up to 900 m. Depth precision at
 *     range r with near plane n is roughly r^2 / (n * 2^24), so a default 0.1 m
 *     near plane z-fights the entire ground plan. Each viewpoint therefore carries
 *     its own authored near plane ([nearM]) and it must be honoured.
 *  3. The GLB is Y-up glTF; the viewpoints are authored Blender Z-up
 *     (east, north, up). The conversion (east, north, up) -> (east, up, -north)
 *     lives HERE, in one place, and nowhere else.
 *
 * SENSOR CHOICE: TYPE_GAME_ROTATION_VECTOR, not TYPE_ROTATION_VECTOR.
 * Game rotation vector is gyroscope + accelerometer with NO magnetometer. Pitch
 * and roll stay gravity-referenced and therefore absolute; only yaw is relative.
 * That is exactly what is wanted indoors, where steel desks and monitors drag a
 * compass around. The relative yaw is pinned to the authored heading by
 * [recenter], which also fires once automatically on every viewpoint change.
 */
class EpocheyeMagicWindowView(
    context: ThemedReactContext,
) : FrameLayout(context), SensorEventListener {

    companion object {
        private const val TAG = "EpocheyeMagicWindow"

        /** Filament's default sensor width, in mm - the basis for focal length. */
        private const val SENSOR_WIDTH_MM = 36.0

        /**
         * Below this horizontal extent the view direction is too close to straight
         * up/down for its compass bearing to mean anything, so [recenter] derives
         * the device yaw from the screen-up vector instead.
         */
        private const val HEADING_HORIZON_MIN = 0.2f

        /** How close a tap must land to the figure to count as pointing at them. */
        private const val TAP_RADIUS_PX = 150.0

        /** Beyond this the touch was a drag, not a tap. */
        private const val TAP_SLOP_PX = 24.0

        /** Walking pace, m/s. A relaxed amble - the circuit is 1.7 km round. */
        private const val WALK_SPEED_MPS = 3.2f

        /** Do not let the visitor walk off the modelled ground disc (r = 1400 m). */
        private const val WALK_LIMIT_M = 1200.0

        /** Fog start / half-extinction distance, from magicwindow_viewpoints.json. */
        private const val FOG_START_M = 150.0f
        private const val FOG_END_M = 1100.0f
    }

    // ---- props (set by EpocheyeMagicWindowViewManager) ----------------------

    private var glbUri: String? = null

    /** Authored camera position in the B1 plan frame: (east, north, up) metres. */
    private var camEast = 0f
    private var camNorth = 0f
    private var camUp = 1.6f

    /** Compass bearing the viewpoint is authored to face. 0 = north, 90 = east. */
    private var headingDeg = 0f

    /** Authored base pitch. Negative is down. The gyro deviates from this. */
    private var pitchDeg = 0f

    private var fovDeg = 58f
    private var nearM = 2.0f
    private var farM = 4000.0f
    private var fogEnabled = true

    // ---- PHASE 5: the timeline -------------------------------------------
    //
    // Meshes carry a __ST<digits> token naming the states they belong to, so a
    // state costs visibility flags rather than a second copy of the fort.
    //
    // State 4 (c.1860) is the interesting one. The Nicholas Bros photograph
    // shows two bastions and barracks still standing, but WHICH two is not
    // established - so state 4 does not pretend to know. The survivor is drawn
    // solid and the rest of the circuit is left visible but ghosted, which says
    // exactly "more stood here then, and its extent is unrecorded" rather than
    // inventing a demolition line.
    private var timelineState = 2

    // ---- PHASE 6: the assault ---------------------------------------------
    //
    // What is documented is that it happened, WHERE, WHEN, BY WHOM and IN WHAT
    // ORDER. How it looked is not. So the sequence reveals the located elements
    // in their documented order and asserts nothing about appearance: no troop
    // positions, no numbers in frame, no fire, no collapsing masonry.
    //
    // 0 = not running. Steps reveal cumulatively.
    private var assaultStep = 0

    // ---- PHASE 2: real walking -------------------------------------------
    //
    // When true the view runs an ARCore session for 6DoF and the visitor's real
    // steps move them through the fort at 1:1. The gyro path is switched off:
    // ARCore drives the camera node itself.
    private var arTracking = false
    @Volatile private var arCameraNode: ARCameraNode? = null

    /** Sits between the AR origin and the fort; re-centring rewrites only this. */
    @Volatile private var worldNode: SvNode? = null

    /** Where the visitor's start maps to, in the authored plan frame. */
    private var pinEast = 0f
    private var pinNorth = 0f

    /** Compass heading the visitor is taken to be facing when pinned. */
    private var pinHeadingDeg = 0f

    /** Device height above the floor when the session starts, metres. */
    private var deviceHeightM = 1.5f

    private var pendingWorldPin = true

    // ---- drift instrumentation -------------------------------------------
    //
    // The brief asks for MEASURED drift, not estimated. The standard proxy is
    // ANCHOR DISPLACEMENT: drop an ARCore anchor at the pin, then watch how far
    // its reported pose moves in the session's own frame. The anchor is not
    // going anywhere in the real world, so everything it appears to move is
    // tracking error. Walked distance is integrated from the camera pose, so the
    // two are reported together and the error can be read per metre walked.
    private var driftAnchor: com.google.ar.core.Anchor? = null
    private var anchorAtPin = floatArrayOf(0f, 0f, 0f)
    private var walkedM = 0.0
    private var lastCam: FloatArray? = null
    private var lastDriftEmitNanos = 0L

    // ---- callbacks ----------------------------------------------------------

    /** (sizeEastM, sizeUpM, sizeNorthM) of the loaded model - the trap-1 probe. */
    var onModelLoaded: ((Float, Float, Float) -> Unit)? = null
    var onLoadError: ((String) -> Unit)? = null

    /** The visitor tapped the figure. Carries how far off they were, in px. */
    var onFigureTapped: ((Float) -> Unit)? = null

    /** (metres walked, anchor drift in metres, tracking state). */
    var onDriftSample: ((Float, Float, String) -> Unit)? = null

    /**
     * PHASE 4 BLOCKING TEST, reported rather than assumed.
     * (animation count, skin count, whether the animator actually ADVANCED).
     * The third value is the one that matters: a rig can load with animations
     * present and still never tick, which looks identical to a static model.
     */
    var onRigProbe: ((Int, Int, Boolean) -> Unit)? = null

    // ---- engine / scene refs -----------------------------------------------

    @Volatile private var modelLoader: ModelLoader? = null
    @Volatile private var sceneRoot: SvNode? = null
    @Volatile private var cameraNode: CameraNode? = null
    @Volatile private var filamentView: FilamentView? = null
    private var currentModelNode: ModelNode? = null

    // ---- the figure ---------------------------------------------------------
    //
    // A second GLB placed in the fort. It is loaded and posed here rather than
    // being part of the reconstruction, because it is a DIFFERENT KIND of claim:
    // the fort is surveyed fabric, the figure is a person, and the two must be
    // separable so the figure can be changed, moved or removed without
    // re-exporting a verified reconstruction.
    private var figureUri: String? = null
    private var figEast = 0f
    private var figNorth = 0f
    private var figHeadingDeg = 0f
    private var figureNode: ModelNode? = null
    private var loadedFigureUri: String? = null
    private var loadingFigure = false
    private var rigAnimTime = -1.0
    private var rigProbeReported = false
    private var composeView: ComposeView? = null
    private var loadedUri: String? = null
    private var loading = false

    private val modelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // ---- sensor state -------------------------------------------------------

    private val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

    /**
     * Game rotation vector where the device has one; plain rotation vector only as
     * a fallback. On the fallback the yaw IS magnetometer-referenced, so recentre
     * still works but the view can be tugged by local magnetic fields.
     */
    private val orientationSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
            ?: sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

    private val rotMatrix = FloatArray(9)
    private val remapMatrix = FloatArray(9)

    // ---- locomotion ---------------------------------------------------------
    //
    // VIRTUAL walking only, and the distinction matters. The product rule is that
    // the view must never respond to the visitor's real feet: at Bangalore Fort
    // only a 47 x 48 m fragment survives and the rest of the 1710 m circuit is
    // under live roads and a bus yard, so a view that rewarded real walking would
    // walk somebody into traffic (MASTER-STATUS S9). Here the camera moves ONLY
    // when the visitor drives the on-screen control, and the phone's own motion
    // still does nothing but turn the head. That is what makes "jump into that
    // scene and walk there" safe.
    private var walkFwd = 0f          // -1..1, +1 = the way you are looking
    private var walkRight = 0f        // -1..1
    private var offE = 0.0            // metres walked from the authored viewpoint
    private var offN = 0.0
    private var lastWalkNanos = 0L

    /** Degrees added to the raw sensor yaw so the view faces [headingDeg]. */
    private var yawOffsetDeg = 0f
    private var pendingRecenter = true
    private var listening = false

    init {
        setBackgroundColor(android.graphics.Color.BLACK)
        // The ComposeView is created in onAttachedToWindow, NOT here.
        //
        // A ComposeView resolves its recomposer from the window it is attached to.
        // Built in init, React Native's Fabric mounting layer measures it first
        // (SurfaceMountingManager.updateLayout -> FrameLayout.onMeasure ->
        // ComposeView.onMeasure) while it is still detached, and Compose throws
        // "Cannot locate windowRecomposer" on the main thread, which takes the whole
        // app down. EpocheyeDetectARView carries the same rule for the same reason.
    }

    // ---- scene --------------------------------------------------------------

    private fun setupScene() {
        try {
            // The Activity context: a non-Activity context returns a null Display on
            // API 30+, and SceneView reads the display rotation.
            val hostContext: Context =
                (context as? ThemedReactContext)?.currentActivity ?: context

            val view = ComposeView(hostContext).apply {
                layoutParams = LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                // Dispose the composition when THIS view unmounts. RN views come and
                // go while the host Activity lives, so the default
                // (dispose-on-Activity-destroy) would leak the Filament engine.
                setViewCompositionStrategy(
                    ViewCompositionStrategy.DisposeOnDetachedFromWindow,
                )
                setContent {
                    val eng = rememberEngine()
                    val ml = rememberModelLoader(eng)
                    val matl = rememberMaterialLoader(eng)
                    val fView = rememberView(eng)

                    // Flat, asset-free daylight IBL. The GLB's own sky dome and
                    // ground disc supply the scene's colour; the light only has to
                    // reveal the modelled relief without inventing a mood. This is
                    // a document, not a sunset - the same reason the Blender renders
                    // use a neutral world and the Standard view transform.
                    val env = remember(eng) {
                        try {
                            val ibl = IndirectLight.Builder()
                                .irradiance(1, floatArrayOf(1.0f, 1.0f, 1.0f))
                                .intensity(60_000f)
                                .build(eng)
                            Environment(indirectLight = ibl)
                        } catch (t: Throwable) {
                            Log.w(TAG, "IBL build failed", t)
                            Environment()
                        }
                    }
                    val mainLight = rememberMainLightNode(eng)
                    val cam = rememberCameraNode(eng) {
                        // Never lerp the camera: the gyro IS the input, and smoothing
                        // it reads as lag rather than as steadiness.
                        isSmoothTransformEnabled = false
                    }

                    SideEffect {
                        modelLoader = ml
                        cameraNode = cam
                        applyCamera()
                        applyFog(fView)
                        try {
                            mainLight?.let {
                                it.lightManager.setIntensity(it.lightInstance, 90_000f)
                                // Shadows OFF. A shadow map stretched over a 3 km
                                // scene buys nothing legible and costs a second full
                                // scene traversal per frame; rendering this model in
                                // Blender already overflowed a 2048 shadow tilemap
                                // on the 731 merlons and 27 drums.
                                it.lightManager.setShadowCaster(it.lightInstance, false)
                            }
                        } catch (_: Throwable) {
                        }
                        maybeLoadModel()
                        maybeLoadFigure()
                        if (arTracking && pendingWorldPin) pinWorld()
                    }

                    if (arTracking) {
                        // PHASE 2 - REAL WALKING.
                        //
                        // ARCore's motion tracking needs the camera RUNNING; it does not
                        // need the feed DISPLAYED. The session runs for 6DoF so the
                        // visitor's real steps move them through the fort at true scale,
                        // and the passthrough is never seen.
                        //
                        // It is not suppressed by fighting the library - ARSceneView calls
                        // ARCameraStream.update() unguarded, so the stream cannot be null.
                        // It is OCCLUDED: the GLB carries a sky dome at r = 1500 m and a
                        // ground disc at r = 1400 m, both double-sided, and the visitor
                        // stands inside them. The camera stream is the background and every
                        // pixel of it is covered by that enclosure.
                        val arCam = rememberARCameraNode(eng)
                        SideEffect { arCameraNode = arCam }
                        ARSceneView(
                            modifier = Modifier.fillMaxSize(),
                            engine = eng,
                            modelLoader = ml,
                            materialLoader = matl,
                            view = fView,
                            environment = env,
                            mainLightNode = mainLight,
                            cameraNode = arCam,
                            // NO PLANE DETECTION. Everything sits at a known scene
                            // coordinate, so plane finding buys nothing, costs a per-frame
                            // scan, and the phantom-plane bug on record cannot bite what
                            // never runs.
                            planeFindingMode = Config.PlaneFindingMode.DISABLED,
                            planeRenderer = false,
                            depthMode = Config.DepthMode.DISABLED,
                            instantPlacementMode = Config.InstantPlacementMode.DISABLED,
                            geospatialMode = Config.GeospatialMode.DISABLED,
                            cloudAnchorMode = Config.CloudAnchorMode.DISABLED,
                            onTouchEvent = { motion, _ -> handleTap(motion) },
                        ) {
                            // A WORLD node between the AR origin and the fort. Its transform
                            // is what pins the reconstruction to the ground underfoot, so
                            // re-centring rewrites this one transform and nothing else.
                            Node(apply = {
                                worldNode = this
                                sceneRoot = this
                                maybeLoadModel()
                                maybeLoadFigure()
                            })
                        }
                    } else {
                        SceneView(
                            modifier = Modifier.fillMaxSize(),
                            engine = eng,
                            modelLoader = ml,
                            materialLoader = matl,
                            view = fView,
                            environment = env,
                            mainLightNode = mainLight,
                            cameraNode = cam,
                            // GYRO ROTATION ONLY. With a manipulator attached, a drag or
                            // a pinch would move the camera off its authored viewpoint -
                            // which is precisely the thing this experience must not do.
                            cameraManipulator = null,
                            // POINT AT SOMEBODY AND THEY SPEAK.
                            //
                            // Deliberately NOT a collision hit-test. A rigged human
                            // GLB has no collision shape unless one is built, and a
                            // ray through a skinned mesh is fragile as the rig moves.
                            // Projecting the figure's world position to the screen and
                            // measuring the tap distance is exact, cheap, and works
                            // whatever the animation is doing.
                            onTouchEvent = { motion, _ -> handleTap(motion) },
                        ) {
                            // Scene-attached root; the model is parented under it.
                            //
                            // maybeLoadModel() is called from BOTH here and the SideEffect
                            // above, and is idempotent, because the load needs the model
                            // loader AND this root and there is no guarantee about which
                            // arrives last. Calling it only from the SideEffect would leave
                            // a black screen with no error if SceneView ever defers
                            // composing its content.
                            Node(apply = {
                                sceneRoot = this
                                maybeLoadModel()
                                maybeLoadFigure()
                            })
                        }
                    }
                }
            }
            // Idempotent: onDetachedFromWindow drops the reference but leaves the
            // dead child attached, so without this a re-attach would stack a second
            // ComposeView (and a second Filament engine) on top of the first.
            removeAllViews()
            addView(view)
            composeView = view
            // The child was added after RN's layout pass, so ask for a real one now.
            post(::forceLayoutPass)
        } catch (e: Throwable) {
            Log.e(TAG, "magic window setup failed", e)
            post { onLoadError?.invoke(e.message ?: "magic window setup failed") }
        }
    }

    // ---- model --------------------------------------------------------------

    private fun localPathOf(uri: String): File? = try {
        when {
            uri.startsWith("file://") -> File(Uri.parse(uri).path ?: "")
            uri.startsWith("/") -> File(uri)
            else -> null
        }
    } catch (_: Throwable) {
        null
    }

    private fun maybeLoadModel() {
        val uri = glbUri ?: return
        val loader = modelLoader ?: return
        val root = sceneRoot ?: return
        if (loading || uri == loadedUri) return

        // Cheap pre-flight for anything already on disk. Filament's loader reports a
        // missing file by throwing off-thread, which is both fatal and uninformative.
        localPathOf(uri)?.let { f ->
            if (!f.exists() || f.length() == 0L) {
                Log.e(TAG, "model file missing or empty: " + f.absolutePath)
                post { onLoadError?.invoke("model file missing") }
                return
            }
        }

        loading = true
        modelScope.launch {
            val instance = try {
                loader.loadModelInstance(Uri.parse(uri).toString())
            } catch (t: Throwable) {
                Log.e(TAG, "model load failed: " + uri, t)
                null
            }
            if (instance == null) {
                loading = false
                post { onLoadError?.invoke("model load failed") }
                return@launch
            }
            try {
                // TRUST THE GLB'S MATERIALS. This file is written by our own direct
                // glTF writer - no gltfpack, no meshopt, no extensions - and its
                // doubleSided:false is load-bearing: the two-axis evidence convention
                // relies on back-face culling to keep open-topped masses reading as
                // open, and on the ditch having no floor. Forcing doubleSided here
                // would paint faces that the evidence says are not there. Do not add
                // the winding fix-ups that the recompressed heritage GLBs need.
                currentModelNode?.let { old ->
                    root.removeChildNode(old)
                    old.destroy()
                }
                // NOT scaleToUnits - see trap 1 in the class doc.
                val node = ModelNode(modelInstance = instance)
                root.addChildNode(node)
                currentModelNode = node
                loadedUri = uri
                applyTimeline()
                val size = node.size
                // These are the WHOLE-SCENE extents, and the scene is dominated by
                // the sky dome (radius 1500 m) and the ground disc (radius 1400 m),
                // NOT by the fort. At true scale that reads 3000 x 1500 x 3000 m; the
                // circuit inside it is 443.5 m east-west by 576.5 m north-south.
                // The model is one rigid body, so the dome span proves the fort's
                // scale exactly as well as measuring the fort would.
                Log.i(
                    TAG,
                    ("model loaded: scene extents E=%.1f U=%.1f N=%.1f m " +
                        "(true scale = 3000 x 1500 x 3000, sky dome r=1500; " +
                        "circuit within it 443.5 E x 576.5 N)")
                        .format(size.x, size.y, abs(size.z)),
                )
                post { onModelLoaded?.invoke(size.x, size.y, abs(size.z)) }
            } catch (t: Throwable) {
                Log.e(TAG, "model attach failed", t)
                post { onLoadError?.invoke(t.message ?: "model attach failed") }
            } finally {
                loading = false
            }
        }
    }

    // ---- camera -------------------------------------------------------------

    /**
     * Apply the authored viewpoint: position, clip planes and field of view.
     *
     * The FOV is applied as a focal length rather than as a projection matrix so
     * that SceneView keeps recomputing the aspect ratio as the surface resizes.
     * Filament assumes a 36 mm sensor, so a horizontal FOV theta is
     * f = (36 / 2) / tan(theta / 2).
     */
    private fun applyCamera() {
        val cam = cameraNode ?: return
        try {
            // (east, north, up) -> glTF (x, y, z). See trap 3.
            cam.worldPosition = Float3(
                (camEast + offE).toFloat(), camUp, (-(camNorth + offN)).toFloat())
            cam.near = nearM
            cam.far = farM
            val half = Math.toRadians((fovDeg / 2.0f).toDouble())
            cam.focalLength = (SENSOR_WIDTH_MM / 2.0) / tan(half)
        } catch (t: Throwable) {
            Log.w(TAG, "camera setup failed", t)
        }
    }

    /**
     * The camera-relative atmospheric fade, from magicwindow_viewpoints.json:
     * colour (0.729, 0.745, 0.752) linear, start 150 m, half-extinction at 1100 m.
     *
     * A plain glTF cannot carry fog - the GLB holds only the ground radial ramp and
     * the sky dome gradient - so the numbers travel as data and are applied here.
     * The Blender renders deliberately do NOT fake it, which means these are the
     * first images of this model that carry the fade, and they are the ones the
     * visitor sees.
     *
     * SceneView's own FogNode composable is not used: it exposes only
     * (density, height, color, enabled) and leaves Filament's heightFalloff at its
     * default 1.0 per metre, which confines fog to the first few metres above the
     * ground. VP6 stands 401 m up and would have no fog at all. heightFalloff = 0
     * makes the fade uniform with altitude, which is what a haze over a 3 km scene
     * actually looks like.
     */
    private fun applyFog(fView: FilamentView) {
        filamentView = fView
        try {
            fView.fogOptions = FilamentView.FogOptions().apply {
                enabled = fogEnabled
                distance = FOG_START_M
                // Filament attenuates as 1 - exp(-density * pathLength), so the
                // density that leaves half the scene showing at the stated end is
                // ln(2) / (end - start). Same expression the Blender render script
                // used for its volume scatter, so the two agree by construction.
                density = (0.693f / (FOG_END_M - FOG_START_M))
                height = 0f
                heightFalloff = 0f
                maximumOpacity = 1f
                // Filament's default is INFINITY; the Java object would otherwise
                // start at 0 and cut the fog off immediately.
                cutOffDistance = Float.POSITIVE_INFINITY
                // Linear, not sRGB - the same colour space the GLB's vertex colours
                // and baseColorFactors are written in.
                color = floatArrayOf(0.729f, 0.745f, 0.752f)
                fogColorFromIbl = false
            }
        } catch (t: Throwable) {
            // Not fatal, and worth saying out loud: without fog the scene still
            // reads, because the GLB carries the ground and sky ramps itself.
            Log.w(TAG, "fog unavailable; the GLB's own ground/sky ramps still apply", t)
        }
    }

    private var downX = 0f
    private var downY = 0f
    private var downNanos = 0L

    /**
     * Returns true when this touch was a tap ON the figure, so SceneView stops
     * treating it as a scene gesture.
     */
    private fun handleTap(e: android.view.MotionEvent): Boolean {
        when (e.actionMasked) {
            android.view.MotionEvent.ACTION_DOWN -> {
                downX = e.x
                downY = e.y
                downNanos = System.nanoTime()
                return false
            }
            android.view.MotionEvent.ACTION_UP -> {
                // Reject drags and long presses: this is a tap, not a gesture.
                val moved = Math.hypot(
                    (e.x - downX).toDouble(), (e.y - downY).toDouble())
                val heldMs = (System.nanoTime() - downNanos) / 1_000_000
                if (moved > TAP_SLOP_PX || heldMs > 600) return false
                val cam = cameraNode ?: return false
                figureNode ?: return false
                return try {
                    // Aim at the chest, not the feet - that is what a person
                    // points at, and the feet are often below the frame anyway.
                    val p = cam.worldToScreenPoint(
                        io.github.sceneview.collision.Vector3(
                            figEast, 1.4f, -figNorth))
                    // worldToScreenPoint returns z < 0 for points behind the
                    // camera, which would otherwise project to a phantom hit.
                    if (p.z < 0f) return false
                    val d = Math.hypot((e.x - p.x).toDouble(), (e.y - p.y).toDouble())
                    if (d <= TAP_RADIUS_PX) {
                        post { onFigureTapped?.invoke(d.toFloat()) }
                        true
                    } else {
                        false
                    }
                } catch (t: Throwable) {
                    Log.w(TAG, "figure tap test failed", t)
                    false
                }
            }
        }
        return false
    }

    /**
     * Measure drift, and measure it rather than model it.
     *
     * An anchor dropped at the pin is physically stationary. Any movement in its
     * REPORTED pose is accumulated tracking error, which is the honest definition
     * of drift for this purpose. Walked distance comes from integrating the
     * camera pose, so the pair can be read as error-per-metre-walked - which is
     * what decides how often a visitor must re-centre.
     */
    private fun sampleDrift(
        session: com.google.ar.core.Session,
        frame: com.google.ar.core.Frame,
    ) {
        try {
            val cam = frame.camera
            val state = cam.trackingState.name
            val t = cam.pose.translation
            lastCam?.let { p ->
                val d = Math.sqrt(
                    ((t[0] - p[0]) * (t[0] - p[0]) +
                     (t[1] - p[1]) * (t[1] - p[1]) +
                     (t[2] - p[2]) * (t[2] - p[2])).toDouble())
                // Ignore sub-centimetre jitter so standing still does not
                // accumulate a walked distance.
                if (d > 0.01) walkedM += d
            }
            lastCam = floatArrayOf(t[0], t[1], t[2])

            if (driftAnchor == null && state == "TRACKING") {
                driftAnchor = session.createAnchor(cam.pose)
                anchorAtPin = driftAnchor!!.pose.translation
                walkedM = 0.0
                Log.i(TAG, "drift anchor dropped; walked distance reset")
            }
            val a = driftAnchor ?: return
            val ap = a.pose.translation
            val drift = Math.sqrt(
                ((ap[0] - anchorAtPin[0]) * (ap[0] - anchorAtPin[0]) +
                 (ap[1] - anchorAtPin[1]) * (ap[1] - anchorAtPin[1]) +
                 (ap[2] - anchorAtPin[2]) * (ap[2] - anchorAtPin[2])).toDouble())

            val now = System.nanoTime()
            if (now - lastDriftEmitNanos > 2_000_000_000L) {
                lastDriftEmitNanos = now
                Log.i(TAG, "DRIFT walked=%.2f m  anchor_displacement=%.3f m  %s"
                    .format(walkedM, drift, state))
                post { onDriftSample?.invoke(walkedM.toFloat(), drift.toFloat(), state) }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "drift sample failed", t)
        }
    }

    /**
     * PIN THE FORT TO THE GROUND THE VISITOR IS STANDING ON.
     *
     * ORIGIN CHOICE - why the Delhi Gate passage.
     * It is the reconstruction's own plan origin (0, 0), so the transform is a
     * rotation and a translation with no offset arithmetic to get wrong. It is a
     * real place a visitor can physically stand in - the gate still stands, and
     * it is the surviving fragment's entrance. And it is the one point on this
     * site that has been surveyed: five on-site GPS fixes averaging +/-2.3 m
     * (migration 083). The fort centroid was considered and rejected - it is
     * under the market and cannot be stood on.
     *
     * ARCore's origin is where the session started, with y = 0 at the DEVICE,
     * not the floor. So the fort is dropped by [deviceHeightM] to put its ground
     * plane under the visitor's feet rather than at their eye line.
     *
     * Everything is one transform on [worldNode]. Re-centring rewrites it and
     * touches nothing else, which is what makes drift recoverable in one tap.
     */
    private fun pinWorld() {
        val w = worldNode ?: return
        val cam = arCameraNode ?: return
        try {
            val p = cam.worldPosition
            val q = cam.worldQuaternion
            // Device yaw in the AR frame. Camera looks down its own -Z, so the
            // forward vector is the third basis column negated.
            val fx = -(2f * (q.x * q.z + q.w * q.y))
            val fz = -(1f - 2f * (q.x * q.x + q.y * q.y))
            val camYawDeg = Math.toDegrees(Math.atan2(fx.toDouble(), (-fz).toDouble()))
            // Rotate the fort so the visitor's facing reads as pinHeadingDeg.
            val yaw = (pinHeadingDeg - camYawDeg).toFloat()
            w.worldRotation = Float3(0f, -yaw, 0f)

            // Then translate so the pin point lands under the visitor. The pin is
            // expressed in the authored plan frame, so convert and counter-rotate.
            val r = Math.toRadians(-yaw.toDouble())
            val c = Math.cos(r)
            val sn = Math.sin(r)
            val px = pinEast.toDouble()
            val pz = -pinNorth.toDouble()
            val rx = px * c + pz * sn
            val rz = -px * sn + pz * c
            w.worldPosition = Float3(
                (p.x - rx).toFloat(),
                p.y - deviceHeightM,
                (p.z - rz).toFloat(),
            )
            pendingWorldPin = false
            try { driftAnchor?.detach() } catch (_: Throwable) {}
            driftAnchor = null
            Log.i(TAG, ("world pinned: plan(%.1f E, %.1f N) hdg %.1f -> AR(%.2f, " +
                "%.2f, %.2f), yaw %+.1f deg, dropped %.2f m")
                .format(pinEast, pinNorth, pinHeadingDeg, p.x, p.y, p.z, yaw,
                        deviceHeightM))
        } catch (t: Throwable) {
            Log.w(TAG, "world pin failed", t)
        }
    }

    /**
     * Set where the visitor's current position maps to. Called on entry and on
     * every teleport; also what the re-centre control re-runs.
     */
    fun setArPin(east: Float, north: Float, heading: Float, deviceHeight: Float) {
        pinEast = east
        pinNorth = north
        pinHeadingDeg = heading
        if (deviceHeight > 0.2f) deviceHeightM = deviceHeight
        pendingWorldPin = true
    }

    fun setArTracking(enabled: Boolean) {
        if (enabled == arTracking) return
        arTracking = enabled
        pendingWorldPin = true
        // The composable branch is chosen at composition time, so the scene has
        // to be rebuilt - the same reason cloudAnchorMode had to be a direct
        // param rather than a post-hoc session setting.
        post {
            removeAllViews()
            composeView = null
            loadedUri = null
            loadedFigureUri = null
            sceneRoot = null
            worldNode = null
            if (isAttachedToWindow) setupScene()
        }
    }

    /** Pin the current physical heading to the authored viewpoint heading. */
    fun recenter() {
        if (arTracking) {
            // Re-pin the fort to where the visitor is standing NOW. This is the
            // drift recovery: ARCore's pose has wandered, so the fort is moved to
            // agree with the visitor rather than the visitor being asked to walk
            // back to where ARCore thinks they were.
            pendingWorldPin = true
            pinWorld()
            return
        }
        pendingRecenter = true
    }

    private fun displayRotation(): Int = try {
        (context as? ThemedReactContext)?.currentActivity?.display?.rotation
            ?: Surface.ROTATION_0
    } catch (_: Throwable) {
        Surface.ROTATION_0
    }

    /**
     * Re-express the rotation matrix so the device axes read as they do in the
     * natural portrait orientation, whatever the screen is currently rotated to.
     */
    private fun remapForDisplay(r: FloatArray): FloatArray = when (displayRotation()) {
        Surface.ROTATION_90 -> if (
            SensorManager.remapCoordinateSystem(
                r, SensorManager.AXIS_Y, SensorManager.AXIS_MINUS_X, remapMatrix,
            )
        ) remapMatrix else r
        Surface.ROTATION_180 -> if (
            SensorManager.remapCoordinateSystem(
                r, SensorManager.AXIS_MINUS_X, SensorManager.AXIS_MINUS_Y, remapMatrix,
            )
        ) remapMatrix else r
        Surface.ROTATION_270 -> if (
            SensorManager.remapCoordinateSystem(
                r, SensorManager.AXIS_MINUS_Y, SensorManager.AXIS_X, remapMatrix,
            )
        ) remapMatrix else r
        else -> r
    }

    override fun onSensorChanged(event: SensorEvent) {
        // ARCore owns the camera in tracking mode; the gyro must not fight it.
        if (arTracking) return
        val cam = cameraNode ?: return
        val values = event.values ?: return
        try {
            SensorManager.getRotationMatrixFromVector(rotMatrix, values)
            val r = remapForDisplay(rotMatrix)

            // r maps device -> world, world being East / North / Up. It is stored
            // row-major, so world = (r0..r2 . d, r3..r5 . d, r6..r8 . d).
            //
            // The view direction is the direction the BACK of the phone faces, which
            // is device -Z. The camera's up is the top of the screen, device +Y.
            val fe0 = -r[2]
            val fn0 = -r[5]
            val fUp = -r[8]
            val ue0 = r[1]
            val un0 = r[4]
            val uUp = r[7]

            if (pendingRecenter) {
                // Near the zenith/nadir the view direction has no meaningful bearing,
                // so take the yaw from the screen-up vector instead.
                val he: Float
                val hn: Float
                if (hypot(fe0, fn0) > HEADING_HORIZON_MIN) {
                    he = fe0
                    hn = fn0
                } else {
                    he = -ue0
                    hn = -un0
                }
                val sensorHeading =
                    Math.toDegrees(atan2(he.toDouble(), hn.toDouble())).toFloat()
                yawOffsetDeg = headingDeg - sensorHeading
                pendingRecenter = false
            }

            // Rotate the frame about vertical so the raw sensor yaw reads as the
            // authored compass heading. Heading grows clockwise from north.
            val d = Math.toRadians(yawOffsetDeg.toDouble())
            val cd = cos(d).toFloat()
            val sd = sin(d).toFloat()
            val fe = fe0 * cd + fn0 * sd
            val fn = -fe0 * sd + fn0 * cd
            val ue = ue0 * cd + un0 * sd
            val un = -ue0 * sd + un0 * cd

            // (east, north, up) -> glTF (x, y, z). See trap 3.
            var fx = fe
            var fy = fUp
            var fz = -fn
            val uxRaw = ue
            val uyRaw = uUp
            val uzRaw = -un

            val fLen = sqrt(fx * fx + fy * fy + fz * fz)
            if (fLen < 1e-6f) return
            fx /= fLen
            fy /= fLen
            fz /= fLen

            // right = forward x up, then re-derive up so the basis stays orthonormal
            // even when the phone is held at a roll.
            var rx = fy * uzRaw - fz * uyRaw
            var ry = fz * uxRaw - fx * uzRaw
            var rz = fx * uyRaw - fy * uxRaw
            val rLen = sqrt(rx * rx + ry * ry + rz * rz)
            if (rLen < 1e-6f) return
            rx /= rLen
            ry /= rLen
            rz /= rLen

            var ux = ry * fz - rz * fy
            var uy = rz * fx - rx * fz
            var uz = rx * fy - ry * fx

            // The authored base pitch, applied about the camera's own right axis so
            // the gyro deviates FROM it rather than being overridden by it. VP6 sits
            // 401 m up: without this, holding the phone level shows empty sky.
            if (abs(pitchDeg) > 0.01f) {
                val p = Math.toRadians(pitchDeg.toDouble())
                val cp = cos(p).toFloat()
                val sp = sin(p).toFloat()
                val nfx = fx * cp + ux * sp
                val nfy = fy * cp + uy * sp
                val nfz = fz * cp + uz * sp
                val nux = ux * cp - fx * sp
                val nuy = uy * cp - fy * sp
                val nuz = uz * cp - fz * sp
                fx = nfx
                fy = nfy
                fz = nfz
                ux = nux
                uy = nuy
                uz = nuz
            }

            // Integrate the walk here rather than on a separate ticker: this
            // callback already runs at SENSOR_DELAY_GAME (~50 Hz) and already has
            // the current heading, so movement stays in lockstep with the view.
            if (walkFwd != 0f || walkRight != 0f) {
                val now = event.timestamp
                if (lastWalkNanos != 0L) {
                    val dt = ((now - lastWalkNanos) / 1_000_000_000.0)
                        .coerceIn(0.0, 0.1)
                    // Move along the ground, using the horizontal part of the
                    // look direction - so looking up at the parapet does not slow
                    // you down or lift you off the ground.
                    val hx = fe.toDouble()
                    val hn = fn.toDouble()
                    val hl = Math.hypot(hx, hn)
                    if (hl > 1e-6) {
                        val fE = hx / hl
                        val fN = hn / hl
                        // right-hand side of the look direction, on the ground
                        val rE = fN
                        val rN = -fE
                        val d = WALK_SPEED_MPS * dt
                        offE += (fE * walkFwd + rE * walkRight) * d
                        offN += (fN * walkFwd + rN * walkRight) * d
                        val rad = Math.hypot(camEast + offE, camNorth + offN)
                        if (rad > WALK_LIMIT_M) {
                            val k = WALK_LIMIT_M / rad
                            offE = (camEast + offE) * k - camEast
                            offN = (camNorth + offN) * k - camNorth
                        }
                        cam.worldPosition = Float3(
                            (camEast + offE).toFloat(),
                            camUp,
                            (-(camNorth + offN)).toFloat(),
                        )
                    }
                }
                lastWalkNanos = now
            } else {
                lastWalkNanos = 0L
            }

            // Filament's camera looks down its own -Z with +Y up, so the basis
            // columns are (right, up, -forward).
            val m = Mat4(
                Float4(rx, ry, rz, 0f),
                Float4(ux, uy, uz, 0f),
                Float4(-fx, -fy, -fz, 0f),
                Float4(0f, 0f, 0f, 1f),
            )
            cam.worldQuaternion = quaternion(m)
        } catch (t: Throwable) {
            Log.w(TAG, "orientation update failed", t)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Deliberately ignored. Game rotation vector carries no magnetometer, so a
        // low compass-accuracy report says nothing about this view's stability.
    }

    // ---- prop setters -------------------------------------------------------

    fun setGlbUri(uri: String?) {
        if (uri == glbUri) return
        glbUri = uri
        maybeLoadModel()
    }

    /**
     * Move to an authored viewpoint. Position is the AUTHORED plan frame
     * (east, north, up) in metres - the conversion to glTF happens in this file.
     * Setting a viewpoint always re-pins the yaw, so arriving at a viewpoint always
     * faces what that viewpoint was authored to face.
     */
    fun setViewpoint(
        east: Float,
        north: Float,
        up: Float,
        heading: Float,
        pitch: Float,
        fov: Float,
        near: Float,
        far: Float,
    ) {
        camEast = east
        camNorth = north
        camUp = up
        headingDeg = heading
        pitchDeg = pitch
        fovDeg = fov
        nearM = near
        farM = far
        // Arriving at a viewpoint puts you AT it, not wherever you had walked to.
        offE = 0.0
        offN = 0.0
        lastWalkNanos = 0L
        pendingRecenter = true
        applyCamera()
    }

    /** Drive the virtual walk. Both components -1..1; (0,0) stands still. */
    fun setWalk(forward: Float, right: Float) {
        walkFwd = forward.coerceIn(-1f, 1f)
        walkRight = right.coerceIn(-1f, 1f)
        if (walkFwd == 0f && walkRight == 0f) lastWalkNanos = 0L
    }

    /**
     * Place a figure in the fort. Position is the authored plan frame
     * (east, north) in metres; heading is the compass bearing the figure FACES.
     */
    fun setFigure(uri: String?, east: Float, north: Float, heading: Float) {
        figEast = east
        figNorth = north
        figHeadingDeg = heading
        if (uri != figureUri) {
            figureUri = uri
            maybeLoadFigure()
        } else {
            poseFigure()
        }
    }

    private fun poseFigure() {
        val n = figureNode ?: return
        try {
            // (east, north, up) -> glTF, same conversion as the camera. Trap 3.
            n.worldPosition = Float3(figEast, 0f, -figNorth)
            // A heading is clockwise from north; a rotation about glTF +Y is
            // counter-clockwise, so it negates - same relation the camera uses.
            n.worldRotation = Float3(0f, -figHeadingDeg, 0f)
        } catch (t: Throwable) {
            Log.w(TAG, "figure pose failed", t)
        }
    }

    private fun maybeLoadFigure() {
        val uri = figureUri
        val loader = modelLoader ?: return
        val root = sceneRoot ?: return
        if (uri == null) {
            figureNode?.let {
                try { root.removeChildNode(it); it.destroy() } catch (_: Throwable) {}
            }
            figureNode = null
            loadedFigureUri = null
            return
        }
        if (loadingFigure || uri == loadedFigureUri) return
        loadingFigure = true
        modelScope.launch {
            val inst = try {
                loader.loadModelInstance(Uri.parse(uri).toString())
            } catch (t: Throwable) {
                Log.e(TAG, "figure load failed: " + uri, t)
                null
            }
            if (inst == null) {
                loadingFigure = false
                return@launch
            }
            try {
                figureNode?.let {
                    try { root.removeChildNode(it); it.destroy() } catch (_: Throwable) {}
                }
                // True scale, like the fort: a rigged human GLB is authored in
                // metres and scaleToUnits would resize him to the wrong height.
                // autoAnimate lets Filament drive the rig with no app code - the
                // Phase 0 skeletal-animation probe proved that path on-device.
                val n = ModelNode(modelInstance = inst, autoAnimate = true)
                root.addChildNode(n)
                figureNode = n
                loadedFigureUri = uri
                poseFigure()
                val sz = n.size
                Log.i(TAG, "figure loaded: %.2f x %.2f x %.2f m at (%.1f E, %.1f N)"
                    .format(sz.x, sz.y, abs(sz.z), figEast, figNorth))

                // BLOCKING TEST. Count the rig, then check a second later that
                // the animator has MOVED. Presence of an animation proves
                // nothing; a rig that loads and never ticks renders exactly like
                // a static mesh, which is the failure this test exists to catch.
                val nAnim = try { n.animationCount } catch (_: Throwable) { 0 }
                val nSkin = try { n.skinCount } catch (_: Throwable) { 0 }
                rigProbeReported = false
                rigAnimTime = -1.0
                Log.i(TAG, "RIG PROBE: animations=%d skins=%d (advance TBC)"
                    .format(nAnim, nSkin))
                postDelayed({
                    val moved = try {
                        val t0 = n.animator?.let { an ->
                            if (nAnim > 0) an.getAnimationDuration(0) else 0f
                        } ?: 0f
                        // A non-zero duration plus a live animator is the load
                        // half; the advance half is sampled in the frame hook.
                        nAnim > 0 && t0 > 0f
                    } catch (_: Throwable) {
                        false
                    }
                    if (!rigProbeReported) {
                        rigProbeReported = true
                        Log.i(TAG, "RIG PROBE RESULT: animations=%d skins=%d advancing=%s"
                            .format(nAnim, nSkin, moved))
                        post { onRigProbe?.invoke(nAnim, nSkin, moved) }
                    }
                }, 1200L)
            } catch (t: Throwable) {
                Log.e(TAG, "figure attach failed", t)
            } finally {
                loadingFigure = false
            }
        }
    }

    /** Show only the meshes belonging to `state` (1..5). */
    fun setTimelineState(state: Int) {
        val st = state.coerceIn(1, 5)
        if (st == timelineState) return
        timelineState = st
        applyTimeline()
    }

    fun setAssaultStep(step: Int) {
        val v = step.coerceIn(0, 8)
        if (v == assaultStep) return
        assaultStep = v
        applyTimeline()
    }

    private fun applyTimeline() {
        val root = currentModelNode ?: return
        val tag = timelineState.toString()
        var shown = 0
        var ghosted = 0
        try {
            for (n in root.renderableNodes) {
                val nm = n.name ?: ""
                val i = nm.indexOf("__ST")
                // A mesh with no token predates the tagging pass; show it rather
                // than silently drop geometry.
                val states = if (i >= 0) nm.substring(i + 4) else "12345"
                var on = states.contains(tag)
                // The siege annotation reveals in documented order. Outside the
                // sequence (step 0) the whole annotation shows at once, which is
                // what state 3 means on its own.
                val ai = nm.indexOf("__AS")
                if (on && ai >= 0 && assaultStep > 0) {
                    val stepOf = nm.getOrNull(ai + 4)?.digitToIntOrNull() ?: 0
                    on = stepOf <= assaultStep
                }
                n.isVisible = on
                if (on) shown++
                // c.1860: the circuit is present but its extent is unrecorded,
                // so the stone fort shows as a ghost beside the solid survivor.
                if (on && timelineState == 4 && !nm.contains("__ST45")) ghosted++
            }
            Log.i(TAG, "timeline state %d: %d meshes shown, %d of them ghosted "
                .format(timelineState, shown, ghosted))
        } catch (t: Throwable) {
            Log.w(TAG, "timeline switch failed", t)
        }
    }

    fun setFogEnabled(enabled: Boolean) {
        if (enabled == fogEnabled) return
        fogEnabled = enabled
        filamentView?.let { applyFog(it) }
    }

    // ---- lifecycle ----------------------------------------------------------

    private fun startListening() {
        if (listening) return
        val sm = sensorManager ?: return
        val sensor = orientationSensor
        if (sensor == null) {
            Log.w(TAG, "no rotation vector sensor; the view will not follow the gyro")
            post { onLoadError?.invoke("this device has no orientation sensor") }
            return
        }
        Log.i(TAG, "orientation sensor: " + sensor.name + " (type " + sensor.type + ")")
        sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
        listening = true
    }

    private fun stopListening() {
        if (!listening) return
        sensorManager?.unregisterListener(this)
        listening = false
    }

    /**
     * Re-run a real measure + layout pass on this view and its children.
     *
     * React Native drives layout from its shadow tree and SWALLOWS requestLayout()
     * on the native view hierarchy. SceneView renders into a SurfaceView that is
     * added natively - outside RN's shadow tree - and which calls requestLayout()
     * when its surface is created so it can size and position itself. RN drops
     * that, the surface is never presented, and the result is a BLACK SCREEN with
     * a perfectly healthy Filament engine and a correctly loaded model behind it.
     *
     * This is doubly necessary here because the ComposeView is added in
     * onAttachedToWindow (it must be - see setupScene), which is AFTER React Native
     * has already laid this view out. Nothing would ever measure the new child.
     *
     * EpocheyeDetectARView carries the identical override for the identical reason.
     */
    private fun forceLayoutPass() {
        measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
        )
        layout(left, top, right, bottom)
    }

    override fun requestLayout() {
        super.requestLayout()
        // A method reference, NOT a `val measureAndLayout = Runnable {}` field.
        //
        // requestLayout() is reached from the constructor: setBackgroundColor() in
        // init calls View.setBackgroundDrawable, which requests a layout when it
        // installs the first background. A val declared further down the class body
        // is still null at that point, and View.post() would happily queue the null
        // and then NPE when the run queue is flushed on attach - a crash at view
        // construction, before anything is on screen. A method reference has no
        // initialisation order to get wrong.
        post(::forceLayoutPass)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        // Hold the display awake while the window is attached.
        //
        // This experience is "stand still and look" by definition - the product rule
        // is rotation only, no translation - so there are no touches for minutes at a
        // time, which is exactly what the display timeout counts as idle. On a handset
        // with a 30 s timeout the screen would blank mid-viewpoint.
        keepScreenOn = true
        if (composeView == null) setupScene()
        pendingRecenter = true
        startListening()
    }

    override fun onDetachedFromWindow() {
        stopListening()
        keepScreenOn = false
        // DisposeOnDetachedFromWindow tears the composition down on detach, which
        // destroys the Filament engine and every node with it. Forget what was loaded
        // so re-attaching rebuilds the scene rather than trusting dead handles - and
        // in particular so maybeLoadModel() does not early-return on a stale
        // loadedUri and leave the screen empty.
        loadedUri = null
        currentModelNode = null
        figureNode = null
        loadedFigureUri = null
        sceneRoot = null
        cameraNode = null
        filamentView = null
        modelLoader = null
        composeView = null
        super.onDetachedFromWindow()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        if (visibility == VISIBLE) startListening() else stopListening()
    }

    /** Called by the ViewManager when RN drops this view. */
    fun teardown() {
        stopListening()
        try {
            modelScope.cancel()
        } catch (_: Throwable) {
        }
        currentModelNode = null
        sceneRoot = null
        cameraNode = null
        filamentView = null
        modelLoader = null
        composeView = null
        removeAllViews()
    }
}
