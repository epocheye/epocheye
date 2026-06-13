package com.epocheye

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // On devices without Google Play Services for AR or with a broken
          // ARCore install, instantiating ARCorePackage can throw at class-load
          // time — that kills ReactHost and presents as a silent crash.
          try {
            add(com.epocheye.ar.ARCorePackage())
          } catch (t: Throwable) {
            Log.e("MainApplication", "ARCorePackage skipped", t)
          }
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Scale the UI up on tablets (phones untouched) BEFORE React initializes, so
    // RN reads the phone-like dp width and the layout fills the larger screen.
    ScreenScaling.applyAndSyncReactNative(this)
    loadReactNative(this)
  }
}
