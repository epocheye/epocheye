package com.epocheye.ar

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * React Native native module exposing ARCore availability checks.
 * Called from TypeScript via NativeModules.ARCoreModule.
 */
class ARCoreModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ARCoreModule"

    @ReactMethod
    fun isAvailable(promise: Promise) {
        try {
            val available = ARCoreUtils.isAvailable(reactApplicationContext)
            promise.resolve(available)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isInstalled(promise: Promise) {
        try {
            val installed = ARCoreUtils.isInstalled(reactApplicationContext)
            promise.resolve(installed)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
