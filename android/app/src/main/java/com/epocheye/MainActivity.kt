package com.epocheye

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Discard Android's saved fragment state on relaunch.
   *
   * React Navigation owns the navigation stack in JavaScript, so there is nothing
   * in the Android fragment state worth restoring — but the OS tries anyway, and
   * react-native-screens cannot rebuild a ScreenStackFragment from a cold
   * process. Observed on-device 2026-08-10:
   *
   *   FATAL EXCEPTION: main
   *   Unable to instantiate fragment com.swmansion.rnscreens.ScreenStackFragment
   *     at FragmentManager.restoreSaveStateInternal
   *
   * It kills the app during onCreate, BEFORE any JS runs, so no error boundary or
   * crash handler can catch it and the user just sees the app vanish on open.
   * This matters most exactly where it is least recoverable: an AR session is
   * memory-hungry, so Android is far more likely to kill the process at a site —
   * and then the app would refuse to reopen.
   *
   * Passing null is the documented react-native-screens fix.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "epocheye"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
