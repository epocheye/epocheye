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
 * React Native ViewManager for [EpocheyeGeospatialARView].
 *
 * Usage from TypeScript:
 *   <EpocheyeGeospatialARView
 *     anchorsJson={JSON.stringify([...])}
 *     onARReady={() => {}}
 *     onEarthState={(e) => log(e.nativeEvent.state)}     // 'TRACKING' | 'LOST:<state>'
 *     onAnchorPlaced={(e) => log(e.nativeEvent.label)}
 *     onGeospatialPose={(e) => log(e.nativeEvent)}        // {lat, lng, altitude, heading}
 *     onARError={(e) => log(e.nativeEvent.error)}
 *   />
 *
 * Imperative commands (dispatch via UIManager.dispatchViewManagerCommand):
 *   - 'requestPoseSnapshot' — emits onGeospatialPose with the current Earth pose
 *   - 'addRuntimeAnchor'    — args: [jsonEntry: string]; appends an anchor at runtime
 *
 * Anchors must be JSON-stringified (RN bridges can't pass nested arrays
 * efficiently to view props in old-arch). Each entry: { label, glb_uri,
 * lat, lng, altitude?, heading_deg? }.
 */
class EpocheyeGeospatialARViewManager(
    private val reactContext: ReactApplicationContext,
) : SimpleViewManager<EpocheyeGeospatialARView>() {

    override fun getName(): String = "EpocheyeGeospatialARView"

    override fun createViewInstance(
        context: ThemedReactContext,
    ): EpocheyeGeospatialARView {
        val view = EpocheyeGeospatialARView(context)

        view.onARReady = {
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onARReady", null)
        }
        view.onEarthState = { state ->
            val event = Arguments.createMap().apply { putString("state", state) }
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onEarthState", event)
        }
        view.onAnchorPlaced = { label ->
            val event = Arguments.createMap().apply { putString("label", label) }
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onAnchorPlaced", event)
        }
        view.onARError = { error ->
            val event = Arguments.createMap().apply { putString("error", error) }
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onARError", event)
        }
        view.onGeospatialPose = { lat, lng, altitude, heading ->
            val event = Arguments.createMap().apply {
                putDouble("lat", lat)
                putDouble("lng", lng)
                putDouble("altitude", altitude)
                putDouble("heading_deg", heading)
            }
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onGeospatialPose", event)
        }

        return view
    }

    @ReactProp(name = "anchorsJson")
    fun setAnchorsJson(view: EpocheyeGeospatialARView, json: String?) {
        view.setAnchorsJson(json)
    }

    override fun getCommandsMap(): Map<String, Int> {
        return MapBuilder.of(
            "requestPoseSnapshot", CMD_REQUEST_POSE_SNAPSHOT,
            "addRuntimeAnchor", CMD_ADD_RUNTIME_ANCHOR,
        )
    }

    @Deprecated("Old arch RN command dispatch", ReplaceWith("receiveCommand(view, commandId.toString(), args)"))
    override fun receiveCommand(
        view: EpocheyeGeospatialARView,
        commandId: Int,
        args: ReadableArray?,
    ) {
        when (commandId) {
            CMD_REQUEST_POSE_SNAPSHOT -> view.requestPoseSnapshot()
            CMD_ADD_RUNTIME_ANCHOR -> {
                val entry = args?.getString(0)
                view.addRuntimeAnchor(entry)
            }
        }
    }

    override fun receiveCommand(
        view: EpocheyeGeospatialARView,
        commandId: String?,
        args: ReadableArray?,
    ) {
        when (commandId) {
            "requestPoseSnapshot" -> view.requestPoseSnapshot()
            "addRuntimeAnchor" -> {
                val entry = args?.getString(0)
                view.addRuntimeAnchor(entry)
            }
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onARReady", MapBuilder.of("registrationName", "onARReady"))
            .put("onEarthState", MapBuilder.of("registrationName", "onEarthState"))
            .put("onAnchorPlaced", MapBuilder.of("registrationName", "onAnchorPlaced"))
            .put("onARError", MapBuilder.of("registrationName", "onARError"))
            .put("onGeospatialPose", MapBuilder.of("registrationName", "onGeospatialPose"))
            .build()
    }

    override fun onDropViewInstance(view: EpocheyeGeospatialARView) {
        view.cleanup()
        super.onDropViewInstance(view)
    }

    companion object {
        private const val CMD_REQUEST_POSE_SNAPSHOT = 1
        private const val CMD_ADD_RUNTIME_ANCHOR = 2
    }
}
