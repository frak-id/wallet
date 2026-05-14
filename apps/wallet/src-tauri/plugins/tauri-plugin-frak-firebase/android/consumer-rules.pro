# Keep frak-firebase plugin classes for Tauri bridge reflection.
-keep class com.plugin.frak_firebase.** { *; }

# Keep Firebase Messaging classes (FCM service + token receiver).
-keep class com.google.firebase.messaging.** { *; }

# Crashlytics auto-applies its own consumer rules via the firebase-crashlytics-gradle
# plugin at the app level — no manual rules needed here.
