package com.epocheye.ar

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * React Native ViewManager for [EpocheyeDetectARView] (the detect→place stack).
 *
 * Props:
 *   - glbUri:     model to place
 *   - modelScale: scaleToUnits for the placed model (default 0.5)
 *
 * Commands (UIManager.dispatchViewManagerCommand):
 *   - 'placeAtScreenPoint' [x, y]  — hit-test that screen point, anchor the GLB
 *   - 'clearAnchor'                — remove the placed model
 *   - 'nudgeYaw' [deg]             — rotate the placed model about Y
 *   - 'captureFrame'               — emit onFrameCaptured(file:// uri)
 */
class EpocheyeDetectARViewManager(
    private val reactContext: ReactApplicationContext,
) : SimpleViewManager<EpocheyeDetectARView>() {

    override fun getName(): String = "EpocheyeDetectARView"

    override fun createViewInstance(
        context: ThemedReactContext,
    ): EpocheyeDetectARView {
        val view = EpocheyeDetectARView(context)

        view.onARReady = {
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onARReady", null)
        }
        view.onPlaneDetected = {
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onPlaneDetected", null)
        }
        view.onTrackingState = { state ->
            val event = Arguments.createMap().apply { putString("state", state) }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onTrackingState", event)
        }
        view.onAnchorPlaced = { label ->
            val event = Arguments.createMap().apply { putString("label", label) }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onAnchorPlaced", event)
        }
        view.onARError = { error ->
            val event = Arguments.createMap().apply { putString("error", error) }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onARError", event)
        }
        view.onFrameCaptured = { uri ->
            val event = Arguments.createMap().apply { putString("uri", uri) }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onFrameCaptured", event)
        }
        // ADMIN-HARNESS (REMOVE AFTER KONARK) — on-screen readouts for untethered testing.
        view.onVpsResult = { result, message ->
            val event = Arguments.createMap().apply {
                putString("result", result)
                message?.let { putString("message", it) }
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onVpsResult", event)
        }
        // ADMIN-HARNESS (REMOVE AFTER KONARK)
        view.onGeospatialState = { earthState, trackingState, lat, lon, horiz, alt, vert, yaw ->
            val event = Arguments.createMap().apply {
                putString("earthState", earthState)
                putString("trackingState", trackingState)
                lat?.let { putDouble("latitude", it) }
                lon?.let { putDouble("longitude", it) }
                horiz?.let { putDouble("horizontalAccuracy", it) }
                alt?.let { putDouble("altitude", it) }
                vert?.let { putDouble("verticalAccuracy", it) }
                yaw?.let { putDouble("orientationYawAccuracy", it) }
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onGeospatialState", event)
        }
        // Site-readiness pipeline (PERMANENT) — geospatial anchor capture/place.
        view.onGeospatialAnchorEvent = { phase, state, message, lat, lng, alt, qx, qy, qz, qw, horiz, yaw ->
            val event = Arguments.createMap().apply {
                putString("phase", phase)
                putString("state", state)
                message?.let { putString("message", it) }
                lat?.let { putDouble("lat", it) }
                lng?.let { putDouble("lng", it) }
                alt?.let { putDouble("alt", it) }
                qx?.let { putDouble("qx", it) }
                qy?.let { putDouble("qy", it) }
                qz?.let { putDouble("qz", it) }
                qw?.let { putDouble("qw", it) }
                horiz?.let { putDouble("horizontalAccuracy", it) }
                yaw?.let { putDouble("orientationYawAccuracy", it) }
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onGeospatialAnchorEvent", event)
        }
        view.onElementTapped = { id, kind, payload ->
            val event = Arguments.createMap().apply {
                putString("id", id)
                putString("kind", kind)
                payload?.let { putString("payload", it) }
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onElementTapped", event)
        }
        view.onCloudAnchorEvent = { phase, state, cloudAnchorId, quality, message ->
            val event = Arguments.createMap().apply {
                putString("phase", phase)
                putString("state", state)
                cloudAnchorId?.let { putString("cloudAnchorId", it) }
                quality?.let { putString("quality", it) }
                message?.let { putString("message", it) }
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onCloudAnchorEvent", event)
        }

        return view
    }

    @ReactProp(name = "glbUri")
    fun setGlbUri(view: EpocheyeDetectARView, uri: String?) {
        view.setGlbUri(uri)
    }

    @ReactProp(name = "modelScale", defaultFloat = 0.5f)
    fun setModelScale(view: EpocheyeDetectARView, scale: Float) {
        view.setModelScale(scale)
    }

    @ReactProp(name = "cardData")
    fun setCardData(view: EpocheyeDetectARView, json: String?) {
        view.setCardData(json)
    }

    @ReactProp(name = "cloudAnchorsEnabled", defaultBoolean = false)
    fun setCloudAnchorsEnabled(view: EpocheyeDetectARView, enabled: Boolean) {
        view.setCloudAnchorsEnabled(enabled)
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    @ReactProp(name = "depthArmed", defaultBoolean = false)
    fun setDepthArmed(view: EpocheyeDetectARView, enabled: Boolean) {
        view.setDepthArmed(enabled)
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    @ReactProp(name = "depthOcclusionEnabled", defaultBoolean = false)
    fun setDepthOcclusionEnabled(view: EpocheyeDetectARView, enabled: Boolean) {
        view.setDepthOcclusionEnabled(enabled)
    }

    /** True-to-life sizing for surveyed reconstructions — see setModelTrueScale. */
    @ReactProp(name = "modelTrueScale", defaultBoolean = false)
    fun setModelTrueScale(view: EpocheyeDetectARView, enabled: Boolean) {
        view.setModelTrueScale(enabled)
    }

    // ADMIN-HARNESS (REMOVE AFTER KONARK)
    @ReactProp(name = "geospatialEnabled", defaultBoolean = false)
    fun setGeospatialEnabled(view: EpocheyeDetectARView, enabled: Boolean) {
        view.setGeospatialEnabled(enabled)
    }

    override fun getCommandsMap(): Map<String, Int> {
        return MapBuilder.builder<String, Int>()
            .put("placeAtScreenPoint", CMD_PLACE_AT_SCREEN_POINT)
            .put("placeFromDetection", CMD_PLACE_FROM_DETECTION)
            .put("placeCardsOnly", CMD_PLACE_CARDS_ONLY)
            .put("placeInFront", CMD_PLACE_IN_FRONT)
            .put("clearAnchor", CMD_CLEAR_ANCHOR)
            .put("nudgeYaw", CMD_NUDGE_YAW)
            .put("nudgeModel", CMD_NUDGE_MODEL)
            .put("resetAlignment", CMD_RESET_ALIGNMENT)
            .put("captureFrame", CMD_CAPTURE_FRAME)
            .put("hostCloudAnchor", CMD_HOST_CLOUD_ANCHOR)
            .put("resolveCloudAnchor", CMD_RESOLVE_CLOUD_ANCHOR)
            .put("checkVps", CMD_CHECK_VPS)
            .put("captureGeospatialPose", CMD_CAPTURE_GEO_POSE)
            .put("placeGeospatialAnchor", CMD_PLACE_GEO_ANCHOR)
            .put("placeDiscoveryCards", CMD_PLACE_DISCOVERY_CARDS)
            .put("setTapTargets", CMD_SET_TAP_TARGETS)
            .build()
    }

    @Deprecated("Old arch RN command dispatch", ReplaceWith("receiveCommand(view, commandId.toString(), args)"))
    override fun receiveCommand(
        view: EpocheyeDetectARView,
        commandId: Int,
        args: ReadableArray?,
    ) {
        when (commandId) {
            CMD_PLACE_AT_SCREEN_POINT -> {
                val x = args?.getDouble(0)?.toFloat() ?: return
                val y = args?.getDouble(1)?.toFloat() ?: return
                view.placeAtScreenPoint(x, y)
            }
            CMD_PLACE_FROM_DETECTION -> {
                val nx = args?.getDouble(0)?.toFloat() ?: return
                val ny = args?.getDouble(1)?.toFloat() ?: return
                view.placeFromDetection(nx, ny)
            }
            CMD_PLACE_CARDS_ONLY -> {
                val nx = args?.getDouble(0)?.toFloat() ?: return
                val ny = args?.getDouble(1)?.toFloat() ?: return
                val cards = args.getString(2) ?: return
                view.placeCardsOnly(nx, ny, cards)
            }
            CMD_PLACE_DISCOVERY_CARDS -> {
                val cards = args?.getString(0) ?: return
                view.placeDiscoveryCards(cards)
            }
            CMD_SET_TAP_TARGETS -> {
                val targets = args?.getString(0) ?: return
                view.setTapTargets(targets)
            }
            CMD_PLACE_IN_FRONT -> view.placeInFront()
            CMD_CLEAR_ANCHOR -> view.clearAnchor()
            CMD_NUDGE_MODEL -> {
                val dx = args?.getDouble(0)?.toFloat() ?: return
                val dy = args.getDouble(1).toFloat()
                val dz = args.getDouble(2).toFloat()
                view.nudgeModel(dx, dy, dz)
            }
            CMD_RESET_ALIGNMENT -> view.resetAlignment()
            CMD_NUDGE_YAW -> {
                val deg = args?.getDouble(0)?.toFloat() ?: return
                view.nudgeYaw(deg)
            }
            CMD_CAPTURE_FRAME -> view.captureFrame()
            CMD_HOST_CLOUD_ANCHOR -> {
                val ttlDays = args?.getDouble(0)?.toInt() ?: 365
                view.hostCloudAnchor(ttlDays)
            }
            CMD_RESOLVE_CLOUD_ANCHOR -> {
                val id = args?.getString(0) ?: return
                view.resolveCloudAnchor(id)
            }
            CMD_CHECK_VPS -> {
                val lat = args?.getDouble(0) ?: return
                val lng = args?.getDouble(1) ?: return
                view.checkVps(lat, lng)
            }
            CMD_CAPTURE_GEO_POSE -> view.captureGeospatialPose()
            CMD_PLACE_GEO_ANCHOR -> {
                val lat = args?.getDouble(0) ?: return
                val lng = args?.getDouble(1) ?: return
                val alt = args?.getDouble(2) ?: return
                view.placeGeospatialAnchor(
                    lat, lng, alt,
                    args.getDouble(3).toFloat(),
                    args.getDouble(4).toFloat(),
                    args.getDouble(5).toFloat(),
                    args.getDouble(6).toFloat(),
                )
            }
        }
    }

    override fun receiveCommand(
        view: EpocheyeDetectARView,
        commandId: String?,
        args: ReadableArray?,
    ) {
        when (commandId) {
            "placeAtScreenPoint" -> {
                val x = args?.getDouble(0)?.toFloat() ?: return
                val y = args?.getDouble(1)?.toFloat() ?: return
                view.placeAtScreenPoint(x, y)
            }
            "placeFromDetection" -> {
                val nx = args?.getDouble(0)?.toFloat() ?: return
                val ny = args?.getDouble(1)?.toFloat() ?: return
                view.placeFromDetection(nx, ny)
            }
            "placeCardsOnly" -> {
                val nx = args?.getDouble(0)?.toFloat() ?: return
                val ny = args?.getDouble(1)?.toFloat() ?: return
                val cards = args.getString(2) ?: return
                view.placeCardsOnly(nx, ny, cards)
            }
            "placeInFront" -> view.placeInFront()
            "clearAnchor" -> view.clearAnchor()
            "nudgeYaw" -> {
                val deg = args?.getDouble(0)?.toFloat() ?: return
                view.nudgeYaw(deg)
            }
            "nudgeModel" -> {
                val dx = args?.getDouble(0)?.toFloat() ?: return
                val dy = args.getDouble(1).toFloat()
                val dz = args.getDouble(2).toFloat()
                view.nudgeModel(dx, dy, dz)
            }
            "resetAlignment" -> view.resetAlignment()
            "captureFrame" -> view.captureFrame()
            "hostCloudAnchor" -> {
                val ttlDays = args?.getDouble(0)?.toInt() ?: 365
                view.hostCloudAnchor(ttlDays)
            }
            "resolveCloudAnchor" -> {
                val id = args?.getString(0) ?: return
                view.resolveCloudAnchor(id)
            }
            "checkVps" -> {
                val lat = args?.getDouble(0) ?: return
                val lng = args?.getDouble(1) ?: return
                view.checkVps(lat, lng)
            }
            "placeDiscoveryCards" -> {
                val cards = args?.getString(0) ?: return
                view.placeDiscoveryCards(cards)
            }
            "setTapTargets" -> {
                val targets = args?.getString(0) ?: return
                view.setTapTargets(targets)
            }
            "captureGeospatialPose" -> view.captureGeospatialPose()
            "placeGeospatialAnchor" -> {
                val lat = args?.getDouble(0) ?: return
                val lng = args?.getDouble(1) ?: return
                val alt = args?.getDouble(2) ?: return
                view.placeGeospatialAnchor(
                    lat, lng, alt,
                    args.getDouble(3).toFloat(),
                    args.getDouble(4).toFloat(),
                    args.getDouble(5).toFloat(),
                    args.getDouble(6).toFloat(),
                )
            }
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onARReady", MapBuilder.of("registrationName", "onARReady"))
            .put("onPlaneDetected", MapBuilder.of("registrationName", "onPlaneDetected"))
            .put("onTrackingState", MapBuilder.of("registrationName", "onTrackingState"))
            .put("onAnchorPlaced", MapBuilder.of("registrationName", "onAnchorPlaced"))
            .put("onARError", MapBuilder.of("registrationName", "onARError"))
            .put("onFrameCaptured", MapBuilder.of("registrationName", "onFrameCaptured"))
            .put("onCloudAnchorEvent", MapBuilder.of("registrationName", "onCloudAnchorEvent"))
            // ADMIN-HARNESS (REMOVE AFTER KONARK)
            .put("onVpsResult", MapBuilder.of("registrationName", "onVpsResult"))
            .put("onGeospatialState", MapBuilder.of("registrationName", "onGeospatialState"))
            .put("onGeospatialAnchorEvent", MapBuilder.of("registrationName", "onGeospatialAnchorEvent"))
            .put("onElementTapped", MapBuilder.of("registrationName", "onElementTapped"))
            .build()
    }

    override fun onDropViewInstance(view: EpocheyeDetectARView) {
        view.cleanup()
        super.onDropViewInstance(view)
    }

    companion object {
        private const val CMD_PLACE_AT_SCREEN_POINT = 1
        private const val CMD_PLACE_FROM_DETECTION = 2
        private const val CMD_CLEAR_ANCHOR = 3
        private const val CMD_NUDGE_YAW = 4
        private const val CMD_NUDGE_MODEL = 90
        private const val CMD_RESET_ALIGNMENT = 91
        private const val CMD_CAPTURE_FRAME = 5
        private const val CMD_PLACE_IN_FRONT = 6
        private const val CMD_PLACE_CARDS_ONLY = 7
        private const val CMD_HOST_CLOUD_ANCHOR = 8
        private const val CMD_RESOLVE_CLOUD_ANCHOR = 9
        private const val CMD_CHECK_VPS = 10
        private const val CMD_CAPTURE_GEO_POSE = 11
        private const val CMD_PLACE_GEO_ANCHOR = 12
        private const val CMD_PLACE_DISCOVERY_CARDS = 13
        private const val CMD_SET_TAP_TARGETS = 14
    }
}
