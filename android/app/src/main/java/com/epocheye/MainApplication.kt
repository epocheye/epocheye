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
    // Resolve a downloaded OTA bundle to load instead of the packaged one.
    // Returns null (→ packaged bundle) unless a valid confirmed/pending OTA
    // bundle exists for this binary's runtime version. Fail-safe: any error
    // resolving falls back to the packaged bundle.
    val otaBundlePath =
      try {
        com.epocheye.ota.OtaBundle.resolveBundlePath(applicationContext)
      } catch (t: Throwable) {
        Log.e("MainApplication", "OTA resolve failed, using packaged bundle", t)
        null
      }

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
          add(com.epocheye.ota.OtaPackage())
              // Screen recorder for shareable AR clips. Wrapped like ARCorePackage:
              // a registration failure must degrade the feature, not the app.
              try {
                add(com.epocheye.record.ScreenRecordPackage())
              } catch (t: Throwable) {
                android.util.Log.e("MainApplication", "ScreenRecordPackage skipped", t)
              }
        },
      jsBundleFilePath = otaBundlePath,
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
