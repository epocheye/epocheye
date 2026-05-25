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
 * React Native ViewManager for [EpocheyePlaneARView].
 *
 * Usage from TypeScript:
 *   <EpocheyePlaneARView
 *     glbUri="https://.../duck.glb"
 *     onARReady={() => {}}
 *     onPlaneDetected={() => {}}
 *     onAnchorPlaced={(e) => log(e.nativeEvent.label)}
 *     onARError={(e) => log(e.nativeEvent.error)}
 *   />
 *
 * Imperative commands (dispatch via UIManager.dispatchViewManagerCommand):
 *   - 'performHitTest' — args: [screenX: number, screenY: number]; ray-casts
 *                        onto detected planes and anchors the GLB on a hit.
 *                        Replaces any previously placed model.
 *   - 'clearAnchor'    — removes the current anchor + model.
 */
class EpocheyePlaneARViewManager(
    private val reactContext: ReactApplicationContext,
) : SimpleViewManager<EpocheyePlaneARView>() {

    override fun getName(): String = "EpocheyePlaneARView"

    override fun createViewInstance(
        context: ThemedReactContext,
    ): EpocheyePlaneARView {
        val view = EpocheyePlaneARView(context)

        view.onARReady = {
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onARReady", null)
        }
        view.onPlaneDetected = {
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onPlaneDetected", null)
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

        return view
    }

    @ReactProp(name = "glbUri")
    fun setGlbUri(view: EpocheyePlaneARView, uri: String?) {
        view.setGlbUri(uri)
    }

    override fun getCommandsMap(): Map<String, Int> {
        return MapBuilder.of(
            "performHitTest", CMD_PERFORM_HIT_TEST,
            "clearAnchor", CMD_CLEAR_ANCHOR,
        )
    }

    @Deprecated("Old arch RN command dispatch", ReplaceWith("receiveCommand(view, commandId.toString(), args)"))
    override fun receiveCommand(
        view: EpocheyePlaneARView,
        commandId: Int,
        args: ReadableArray?,
    ) {
        when (commandId) {
            CMD_PERFORM_HIT_TEST -> {
                val x = args?.getDouble(0)?.toFloat() ?: return
                val y = args?.getDouble(1)?.toFloat() ?: return
                view.performHitTest(x, y)
            }
            CMD_CLEAR_ANCHOR -> view.clearAnchor()
        }
    }

    override fun receiveCommand(
        view: EpocheyePlaneARView,
        commandId: String?,
        args: ReadableArray?,
    ) {
        when (commandId) {
            "performHitTest" -> {
                val x = args?.getDouble(0)?.toFloat() ?: return
                val y = args?.getDouble(1)?.toFloat() ?: return
                view.performHitTest(x, y)
            }
            "clearAnchor" -> view.clearAnchor()
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onARReady", MapBuilder.of("registrationName", "onARReady"))
            .put("onPlaneDetected", MapBuilder.of("registrationName", "onPlaneDetected"))
            .put("onAnchorPlaced", MapBuilder.of("registrationName", "onAnchorPlaced"))
            .put("onARError", MapBuilder.of("registrationName", "onARError"))
            .build()
    }

    override fun onDropViewInstance(view: EpocheyePlaneARView) {
        view.cleanup()
        super.onDropViewInstance(view)
    }

    companion object {
        private const val CMD_PERFORM_HIT_TEST = 1
        private const val CMD_CLEAR_ANCHOR = 2
    }
}
