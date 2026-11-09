buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:9.3.1")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.10")
        classpath("com.google.gms:google-services:4.4.2")
        classpath("com.google.firebase:firebase-crashlytics-gradle:3.0.2")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// tauri-plugin-share 2.0.5 and tauri-plugin-safe-area-insets 0.1.0 pin compileSdk 34, which AGP 9's AAR metadata check rejects.
subprojects {
    afterEvaluate {
        extensions.findByType<com.android.build.api.dsl.LibraryExtension>()?.apply {
            if ((compileSdk ?: 0) < 36) compileSdk = 36
        }
    }
}

tasks.register("clean").configure {
    delete("build")
}

