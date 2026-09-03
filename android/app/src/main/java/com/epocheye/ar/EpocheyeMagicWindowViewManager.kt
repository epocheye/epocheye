package com.epocheye.ar

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * React Native ViewManager for [EpocheyeMagicWindowView] - the camera-off,
 * gyroscope-driven Bangalore Fort reconstruction.
 *
 * Props:
 *   - glbUri:     the reconstruction to show (resolved JS-side by glbSource.ts)
 *   - viewpoint:  the authored viewpoint, applied ATOMICALLY as one map. Deliberately
 *                 not eight separate props: React Native applies props in an
 *                 unspecified order, so a split viewpoint could momentarily combine
 *                 VP6's 401 m altitude with VP1's 2 m near plane. Keys:
 *                 { east, north, up, heading, pitch, fov, near, far } - all metres
 *                 and degrees, in the authored B1 plan frame (east, north, up).
 *   - fogEnabled: the 150-1100 m atmospheric fade (default true)
 *
 * Commands (UIManager.dispatchViewManagerCommand):
 *   - 'recenter'  - pin the phone's current physical heading to the authored
 *                   heading of the active viewpoint. This is the whole reason the
 *                   view reads a magnetometer-free sensor: indoors, a compass is
 *                   dragged around by steel, so the yaw is relative and the visitor
 *                   re-pins it whenever they want.
 *
 * Events:
 *   - onModelLoaded { sizeEastM, sizeUpM, sizeNorthM } - the measured extents of the
 *                   loaded GLB. This is a TEST, not telemetry: SceneView's
 *                   scaleToUnits normalises, and a fort that arrives at 0.5 m instead
 *                   of ~576 m has to be caught by a number rather than by eye.
 *   - onLoadError  { message }
 */
class EpocheyeMagicWindowViewManager(
    private val reactContext: ReactApplicationContext,
) : SimpleViewManager<EpocheyeMagicWindowView>() {

    companion object {
        private const val COMMAND_RECENTER = "recenter"
    }

    override fun getName(): String = "EpocheyeMagicWindowView"

    override fun createViewInstance(
        context: ThemedReactContext,
    ): EpocheyeMagicWindowView {
        val view = EpocheyeMagicWindowView(context)

        view.onModelLoaded = { east, up, north ->
            val event = Arguments.createMap().apply {
                putDouble("sizeEastM", east.toDouble())
                putDouble("sizeUpM", up.toDouble())
                putDouble("sizeNorthM", north.toDouble())
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onModelLoaded", event)
        }
        view.onCameraDebug = {
            fx, fy, fz, px, py, pz, rot, branch, moved, minY, maxY ->
            val event = Arguments.createMap().apply {
                putDouble("fwdX", fx.toDouble())
                putDouble("fwdY", fy.toDouble())
                putDouble("fwdZ", fz.toDouble())
                putDouble("posX", px.toDouble())
                putDouble("posY", py.toDouble())
                putDouble("posZ", pz.toDouble())
                putInt("displayRotation", rot)
                putString("remapBranch", branch)
                putBoolean("movedOnRotate", moved)
                putDouble("modelMinY", minY.toDouble())
                putDouble("modelMaxY", maxY.toDouble())
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onCameraDebug", event)
        }
        view.onHeading = { deg ->
            val event = Arguments.createMap().apply {
                putDouble("headingDeg", deg.toDouble())
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onHeading", event)
        }
        view.onFigureTapped = { distancePx ->
            val event = Arguments.createMap().apply {
                putDouble("distancePx", distancePx.toDouble())
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onFigureTapped", event)
        }
        view.onDriftSample = { walked, drift, state ->
            val event = Arguments.createMap().apply {
                putDouble("walkedM", walked.toDouble())
                putDouble("driftM", drift.toDouble())
                putString("tracking", state)
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onDriftSample", event)
        }
        view.onRigProbe = { animations, skins, advancing ->
            val event = Arguments.createMap().apply {
                putInt("animations", animations)
                putInt("skins", skins)
                putBoolean("advancing", advancing)
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onRigProbe", event)
        }
        view.onLoadError = { message ->
            val event = Arguments.createMap().apply { putString("message", message) }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onLoadError", event)
        }
        return view
    }

    override fun onDropViewInstance(view: EpocheyeMagicWindowView) {
        view.teardown()
        super.onDropViewInstance(view)
    }

    @ReactProp(name = "glbUri")
    fun setGlbUri(view: EpocheyeMagicWindowView, uri: String?) {
        view.setGlbUri(uri)
    }

    /**
     * Virtual walk vector, {forward, right}, each -1..1.
     *
     * A prop rather than a command because it is continuous: the visitor holds a
     * direction and the native side integrates it at sensor rate. Sending discrete
     * move commands over the bridge would stutter.
     */
    @ReactProp(name = "walk")
    fun setWalk(view: EpocheyeMagicWindowView, walk: ReadableMap?) {
        if (walk == null) {
            view.setWalk(0f, 0f)
            return
        }
        val f = if (walk.hasKey("forward")) walk.getDouble("forward").toFloat() else 0f
        val r = if (walk.hasKey("right")) walk.getDouble("right").toFloat() else 0f
        view.setWalk(f, r)
    }

    /**
     * A figure standing in the scene: {uri, east, north, up, heading}.
     * `up` is the floor level in metres and defaults to 0, which is the fort's
     * only floor; the palace needs it because its darbar hall is at 2.60 m.
     *
     * Atomic, like `viewpoint`, and for the same reason - a half-applied figure
     * could momentarily put one person at another's position.
     */
    /**
     * The card to hang beside the figure, as the same JSON EpocheyeArCardRenderer
     * reads elsewhere: { title, meta, body, accent }.
     *
     * A PROP RATHER THAN A COMMAND, unlike placeCardsAtScreenPoint on the AR
     * view. That one has to be a command because it carries a touch point that
     * only exists at the moment of the tap. This carries no event - it is a
     * piece of state, "the card that is currently showing" - and a prop
     * re-applies itself if the view is recreated, where a missed command would
     * simply be lost.
     */
    @ReactProp(name = "figureCard")
    fun setFigureCard(view: EpocheyeMagicWindowView, json: String?) {
        view.setFigureCard(json)
    }

    @ReactProp(name = "figure")
    fun setFigure(view: EpocheyeMagicWindowView, fig: ReadableMap?) {
        if (fig == null) {
            view.setFigure(null, 0f, 0f, 0f, 0f)
            return
        }
        fun f(k: String) = if (fig.hasKey(k)) fig.getDouble(k).toFloat() else 0f
        view.setFigure(
            if (fig.hasKey("uri")) fig.getString("uri") else null,
            f("east"), f("north"), f("up"), f("heading"),
        )
    }

    /**
     * PHASE 2. Run an ARCore session for 6DoF so the visitor's real steps move
     * them through the fort at 1:1. The camera feed is never displayed - it is
     * occluded by the GLB's own sky dome and ground disc.
     */
    @ReactProp(name = "arTracking", defaultBoolean = false)
    fun setArTracking(view: EpocheyeMagicWindowView, enabled: Boolean) {
        view.setArTracking(enabled)
    }

    /**
     * Where the visitor's current position maps to: {east, north, heading,
     * deviceHeight}. Atomic, like `viewpoint` - a half-applied pin would put the
     * fort at one place and face it another way.
     */
    @ReactProp(name = "arPin")
    fun setArPin(view: EpocheyeMagicWindowView, pin: ReadableMap?) {
        if (pin == null) return
        fun f(k: String, d: Double) =
            if (pin.hasKey(k)) pin.getDouble(k).toFloat() else d.toFloat()
        view.setArPin(f("east", 0.0), f("north", 0.0), f("heading", 0.0),
                      f("deviceHeight", 1.5))
    }

    /** PHASE 5: which documented state of the fort to show (1..5). */
    @ReactProp(name = "timelineState", defaultInt = 2)
    fun setTimelineState(view: EpocheyeMagicWindowView, state: Int) {
        view.setTimelineState(state)
    }

    /** PHASE 6: which step of the documented 1791 sequence to reveal (0 = off). */
    @ReactProp(name = "assaultStep", defaultInt = 0)
    fun setAssaultStep(view: EpocheyeMagicWindowView, step: Int) {
        view.setAssaultStep(step)
    }

    @ReactProp(name = "fogEnabled", defaultBoolean = true)
    fun setFogEnabled(view: EpocheyeMagicWindowView, enabled: Boolean) {
        view.setFogEnabled(enabled)
    }

    /**
     * Linear RGB sky for scenes whose GLB carries no dome. Omit it and the model
     * supplies its own sky, which is what Bangalore Fort does.
     */
    @ReactProp(name = "skyColor")
    fun setSkyColor(view: EpocheyeMagicWindowView, c: ReadableArray?) {
        view.setSkyColor(
            if (c == null || c.size() < 3) null
            else floatArrayOf(
                c.getDouble(0).toFloat(),
                c.getDouble(1).toFloat(),
                c.getDouble(2).toFloat(),
            ),
        )
    }

    /** Per-scene exposure. 1.0 leaves the fort's lighting untouched. */
    @ReactProp(name = "lightScale", defaultFloat = 1.0f)
    fun setLightScale(view: EpocheyeMagicWindowView, v: Float) {
        view.setLightScale(v)
    }

    /**
     * Per-scene fog, metres: [start, halfExtinction]. A 140 m interior and a
     * 3 km fort cannot share one distance — see EpocheyeMagicWindowView.setFog.
     */
    @ReactProp(name = "fog")
    fun setFog(view: EpocheyeMagicWindowView, fog: ReadableArray?) {
        if (fog == null || fog.size() < 2) return
        view.setFog(fog.getDouble(0).toFloat(), fog.getDouble(1).toFloat())
    }

    @ReactProp(name = "viewpoint")
    fun setViewpoint(view: EpocheyeMagicWindowView, vp: ReadableMap?) {
        if (vp == null) return
        fun f(key: String, fallback: Double): Float =
            if (vp.hasKey(key)) vp.getDouble(key).toFloat() else fallback.toFloat()
        view.setViewpoint(
            east = f("east", 0.0),
            north = f("north", 0.0),
            up = f("up", 1.6),
            heading = f("heading", 0.0),
            pitch = f("pitch", 0.0),
            fov = f("fov", 58.0),
            // Defaults chosen to be SAFE, not neutral: 2 m is the tightest near plane
            // any authored ground viewpoint uses, and anything smaller z-fights the
            // stacked ground-plan layers at range.
            near = f("near", 2.0),
            far = f("far", 4000.0),
        )
    }

    override fun getCommandsMap(): Map<String, Int> = mapOf(COMMAND_RECENTER to 1)

    override fun receiveCommand(
        view: EpocheyeMagicWindowView,
        commandId: String?,
        args: ReadableArray?,
    ) {
        when (commandId) {
            COMMAND_RECENTER, "1" -> view.recenter()
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onModelLoaded", MapBuilder.of("registrationName", "onModelLoaded"))
            .put("onLoadError", MapBuilder.of("registrationName", "onLoadError"))
            .put("onFigureTapped", MapBuilder.of("registrationName", "onFigureTapped"))
            .put("onDriftSample", MapBuilder.of("registrationName", "onDriftSample"))
            .put("onRigProbe", MapBuilder.of("registrationName", "onRigProbe"))
            .put("onCameraDebug", MapBuilder.of("registrationName", "onCameraDebug"))
            .put("onHeading", MapBuilder.of("registrationName", "onHeading"))
            .build()
    }
}
