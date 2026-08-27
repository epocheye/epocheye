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
            // Gives the magic window's figures a voice, using Android's own
            // TextToSpeech. No new dependency: the platform has shipped it since
            // API 4, and the lines being spoken still change as the evidence
            // does, so synthesis beats pre-rendered audio that would drift.
            SpeechModule(reactContext),
        )
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {
        return listOf(
            EpocheyeDetectARViewManager(reactContext),
            // Camera-off, gyro-driven reconstruction (Bangalore Fort magic window).
            // Shares this package because it shares the SceneView/Filament stack,
            // but it opens no ARCore session and needs no camera permission.
            EpocheyeMagicWindowViewManager(reactContext),
        )
    }
}
