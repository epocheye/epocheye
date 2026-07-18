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

    override fun getCommandsMap(): Map<String, Int> {
        return MapBuilder.builder<String, Int>()
            .put("placeAtScreenPoint", CMD_PLACE_AT_SCREEN_POINT)
            .put("placeFromDetection", CMD_PLACE_FROM_DETECTION)
            .put("placeCardsOnly", CMD_PLACE_CARDS_ONLY)
            .put("placeInFront", CMD_PLACE_IN_FRONT)
            .put("clearAnchor", CMD_CLEAR_ANCHOR)
            .put("nudgeYaw", CMD_NUDGE_YAW)
            .put("captureFrame", CMD_CAPTURE_FRAME)
            .put("hostCloudAnchor", CMD_HOST_CLOUD_ANCHOR)
            .put("resolveCloudAnchor", CMD_RESOLVE_CLOUD_ANCHOR)
            .put("checkKonarkVps", CMD_CHECK_KONARK_VPS)
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
            CMD_PLACE_IN_FRONT -> view.placeInFront()
            CMD_CLEAR_ANCHOR -> view.clearAnchor()
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
            CMD_CHECK_KONARK_VPS -> view.checkKonarkVps()
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
            "captureFrame" -> view.captureFrame()
            "hostCloudAnchor" -> {
                val ttlDays = args?.getDouble(0)?.toInt() ?: 365
                view.hostCloudAnchor(ttlDays)
            }
            "resolveCloudAnchor" -> {
                val id = args?.getString(0) ?: return
                view.resolveCloudAnchor(id)
            }
            "checkKonarkVps" -> view.checkKonarkVps()
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
        private const val CMD_CAPTURE_FRAME = 5
        private const val CMD_PLACE_IN_FRONT = 6
        private const val CMD_PLACE_CARDS_ONLY = 7
        private const val CMD_HOST_CLOUD_ANCHOR = 8
        private const val CMD_RESOLVE_CLOUD_ANCHOR = 9
        private const val CMD_CHECK_KONARK_VPS = 10
    }
}
