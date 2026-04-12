package com.epocheye.ar

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * React Native ViewManager that exposes [EpocheyeARView] as a native component.
 *
 * Usage from TypeScript:
 *   <EpocheyeARView
 *     identificationName="Konark Sun Temple"
 *     identificationPeriod="13th Century"
 *     identificationSignificance="..."
 *     identificationFact="..."
 *     arEnabled={true}
 *     onARReady={() => {}}
 *     onCardTapped={() => {}}
 *     onARError={(e) => console.warn(e.nativeEvent.error)}
 *   />
 */
class EpocheyeARViewManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<EpocheyeARView>() {

    override fun getName(): String = "EpocheyeARView"

    override fun createViewInstance(context: ThemedReactContext): EpocheyeARView {
        val view = EpocheyeARView(context)

        // Wire up event emitters to React Native
        view.onARReady = {
            val emitter = reactContext.getJSModule(RCTEventEmitter::class.java)
            emitter.receiveEvent(view.id, "onARReady", null)
        }
        view.onCardTapped = {
            val emitter = reactContext.getJSModule(RCTEventEmitter::class.java)
            emitter.receiveEvent(view.id, "onCardTapped", null)
        }
        view.onARError = { error ->
            val emitter = reactContext.getJSModule(RCTEventEmitter::class.java)
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putString("error", error)
            }
            emitter.receiveEvent(view.id, "onARError", event)
        }

        return view
    }

    @ReactProp(name = "identificationName")
    fun setIdentificationName(view: EpocheyeARView, name: String?) {
        view.identificationName = name
        view.updateIdentification()
    }

    @ReactProp(name = "identificationPeriod")
    fun setIdentificationPeriod(view: EpocheyeARView, period: String?) {
        view.identificationPeriod = period
    }

    @ReactProp(name = "identificationSignificance")
    fun setIdentificationSignificance(view: EpocheyeARView, significance: String?) {
        view.identificationSignificance = significance
    }

    @ReactProp(name = "identificationFact")
    fun setIdentificationFact(view: EpocheyeARView, fact: String?) {
        view.identificationFact = fact
    }

    @ReactProp(name = "arEnabled")
    fun setArEnabled(view: EpocheyeARView, enabled: Boolean) {
        view.setArEnabled(enabled)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onARReady", MapBuilder.of("registrationName", "onARReady"))
            .put("onCardTapped", MapBuilder.of("registrationName", "onCardTapped"))
            .put("onARError", MapBuilder.of("registrationName", "onARError"))
            .build()
    }

    override fun onDropViewInstance(view: EpocheyeARView) {
        view.cleanup()
        super.onDropViewInstance(view)
    }
}
