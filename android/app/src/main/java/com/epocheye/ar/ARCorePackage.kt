package com.epocheye.ar

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native package that registers the ARCore native module
 * and the AR view manager.
 */
class ARCorePackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {
        return listOf(
            ARCoreModule(reactContext),
            // Site-readiness pipeline (PERMANENT) — compass heading for pre-AR guidance.
            HeadingModule(reactContext),
        )
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {
        return listOf(
            EpocheyeDetectARViewManager(reactContext),
        )
    }
}
