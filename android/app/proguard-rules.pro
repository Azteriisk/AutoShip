# Proguard rules for AutoShip Clover Android Application

# Keep Clover SDK models and remote interfaces
-keep class com.clover.sdk.** { *; }
-dontwarn com.clover.sdk.**

# Keep Retrofit and Gson models
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.autoship.clover.data.model.** { *; }
-keepclassmembers class com.autoship.clover.data.model.** { *; }

# OkHttp & Retrofit rules
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
