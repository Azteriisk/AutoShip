import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.autoship.clover"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.autoship.clover"
        minSdk = 25 // Supports Clover Station 2018 (API 25), Clover Flex 2/3/4, Clover Mini 2/3/4, Station Duo/Solo
        targetSdk = 28 // Clover POS OS Native Target (enables pure V1 JAR signature scheme)
        versionCode = 2
        versionName = "1.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Default backend API URL pointing to the production deployment
        buildConfigField("String", "DEFAULT_BACKEND_URL", "\"https://autoship.azterisk.net/\"")
    }

    signingConfigs {
        create("cloverRelease") {
            val localProps = Properties().apply {
                val propFile = rootProject.file("local.properties")
                if (propFile.exists()) {
                    FileInputStream(propFile).use { load(it) }
                }
            }
            val keyStoreFilePath = System.getenv("AUTOSHIP_KEYSTORE_PATH")
                ?: localProps.getProperty("autoship.keystore.path")
                ?: "autoship-release.jks"
            val storePass = System.getenv("AUTOSHIP_KEYSTORE_PASSWORD")
                ?: localProps.getProperty("autoship.keystore.password")
                ?: ""
            val alias = System.getenv("AUTOSHIP_KEY_ALIAS")
                ?: localProps.getProperty("autoship.key.alias")
                ?: "autoship"
            val keyPass = System.getenv("AUTOSHIP_KEY_PASSWORD")
                ?: localProps.getProperty("autoship.key.password")
                ?: storePass

            val kFile = file(keyStoreFilePath)
            if (kFile.exists() && storePass.isNotBlank()) {
                storeFile = kFile
                storePassword = storePass
                keyAlias = alias
                keyPassword = keyPass
            }
            enableV1Signing = true
            enableV2Signing = false
            enableV3Signing = false
            enableV4Signing = false
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("cloverRelease")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("cloverRelease")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Clover Android SDK
    implementation("com.clover.sdk:clover-android-sdk:341")

    // AndroidX & Material Components
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.fragment:fragment-ktx:1.6.2")

    // Architecture Components & Lifecycle
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Retrofit 2 & OkHttp 3
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Unit Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("io.mockk:mockk:1.13.9")
    testImplementation("androidx.arch.core:core-testing:2.2.0")
}
