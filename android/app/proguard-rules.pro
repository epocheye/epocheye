# Add project specific ProGuard rules here.

# ─── React Native ────────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# ─── React Native New Architecture (Fabric / TurboModules) ───────────────────
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ─── Reanimated worklets ─────────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.worklets.** { *; }
-dontwarn com.swmansion.reanimated.**

# ─── Firebase ────────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─── ARCore / SceneView ──────────────────────────────────────────────────────
-keep class com.google.ar.** { *; }
-keep class io.github.sceneview.** { *; }
-dontwarn com.google.ar.**
-dontwarn io.github.sceneview.**

# ─── Razorpay ────────────────────────────────────────────────────────────────
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**

# ─── TensorFlow Lite (fast-tflite) ───────────────────────────────────────────
-keep class org.tensorflow.** { *; }
-keep class com.mrousavy.tflite.** { *; }
-dontwarn org.tensorflow.**

# ─── Vision Camera ───────────────────────────────────────────────────────────
-keep class com.mrousavy.camera.** { *; }
-dontwarn com.mrousavy.camera.**

# ─── Skia ────────────────────────────────────────────────────────────────────
-keep class com.shopify.reactnative.skia.** { *; }
-dontwarn com.shopify.reactnative.skia.**

# ─── Notifee ─────────────────────────────────────────────────────────────────
-keep class io.invertase.notifee.** { *; }
-dontwarn io.invertase.notifee.**

# ─── General Android ─────────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception
