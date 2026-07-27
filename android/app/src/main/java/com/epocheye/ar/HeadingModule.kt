package com.epocheye.ar

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Site-readiness pipeline (PERMANENT product feature): device compass heading for
 * pre-AR "walk to the viewing station" guidance (bearing + turn cues), used
 * before the AR session — and thus ARCore Earth yaw — is available.
 *
 * Reads TYPE_ROTATION_VECTOR (fused accelerometer + gyroscope + magnetometer),
 * derives the azimuth, and applies magnetic declination (from the caller's
 * lat/lng via GeomagneticField) so `heading` is TRUE-north degrees, matching
 * bearingBetween() which is computed from lat/lng. Emits "EpocheyeHeading"
 * { heading, magneticHeading, accuracy } throttled to ~15 Hz. Android-only
 * (matches the ARCore/SceneView platform).
 */
class HeadingModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), SensorEventListener {

    private val sensorManager =
        reactContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val rotationSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

    private var declinationDeg = 0f
    private var accuracy = 0
    private var lastEmitMs = 0L
    private val rotMatrix = FloatArray(9)
    private val orientation = FloatArray(3)

    override fun getName() = "EpocheyeHeading"

    /**
     * Begin emitting heading. lat/lng/alt fix the magnetic declination correction
     * for this location; heading then reads in TRUE-north degrees.
     */
    @ReactMethod
    fun start(latitude: Double, longitude: Double, altitude: Double) {
        declinationDeg = try {
            GeomagneticField(
                latitude.toFloat(),
                longitude.toFloat(),
                altitude.toFloat(),
                System.currentTimeMillis(),
            ).declination
        } catch (_: Throwable) {
            0f
        }
        val sm = sensorManager ?: return
        val sensor = rotationSensor ?: return
        sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI)
    }

    @ReactMethod
    fun stop() {
        sensorManager?.unregisterListener(this)
    }

    // Required no-ops so a JS NativeEventEmitter over this module doesn't warn.
    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
        val now = System.currentTimeMillis()
        if (now - lastEmitMs < 66) return // ~15 Hz
        lastEmitMs = now
        try {
            SensorManager.getRotationMatrixFromVector(rotMatrix, event.values)
            SensorManager.getOrientation(rotMatrix, orientation)
            var magnetic = Math.toDegrees(orientation[0].toDouble())
            if (magnetic < 0) magnetic += 360.0
            var trueHeading = magnetic + declinationDeg
            trueHeading = ((trueHeading % 360.0) + 360.0) % 360.0
            val map = Arguments.createMap().apply {
                putDouble("heading", trueHeading)
                putDouble("magneticHeading", magnetic)
                putInt("accuracy", accuracy)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("EpocheyeHeading", map)
        } catch (_: Throwable) {
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, acc: Int) {
        accuracy = acc
    }

    override fun invalidate() {
        stop()
        super.invalidate()
    }
}
