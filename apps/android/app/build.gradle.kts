import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

val defaultSupabaseUrl = "https://xvmgmsexzibdqptmvzdn.supabase.co"

val localProperties = Properties().apply {
    val candidateFiles = listOf(
        rootProject.file("local.properties"),
        project.file("../local.properties"),
        project.file("local.properties")
    ).distinctBy { it.absolutePath }

    candidateFiles.firstOrNull { it.exists() }?.inputStream()?.use { stream ->
        load(stream)
    }
}

fun secretProperty(name: String): String {
    return localProperties.getProperty(name)?.trim()
        ?: providers.gradleProperty(name).orNull
        ?: providers.environmentVariable(name).orNull
        ?: ""
}

fun escapedBuildConfigString(value: String): String {
    return value.replace("\\", "\\\\").replace("\"", "\\\"")
}

android {
    namespace = "com.restauracion.offline"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.restauracion.offline"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        val supabaseUrl = secretProperty("SUPABASE_URL").ifBlank { defaultSupabaseUrl }
        val supabaseAnonKey = secretProperty("SUPABASE_ANON_KEY")
        val allowLocalHttp = secretProperty("ALLOW_LOCAL_HTTP").equals("true", ignoreCase = true)

        require(supabaseUrl.startsWith("https://") || (allowLocalHttp && supabaseUrl.startsWith("http://"))) {
            "SUPABASE_URL debe usar https://. Para pruebas locales debug use ALLOW_LOCAL_HTTP=true. Valor actual: $supabaseUrl"
        }
        require(supabaseAnonKey.startsWith("eyJ")) {
            "SUPABASE_ANON_KEY no fue leida desde local.properties o no es la Legacy anon key. Revise apps/android/local.properties."
        }

        // URL del aplicativo web (Vercel). Opcional: si esta vacia, la app no pide la
        // generacion del acta firmada y todo lo demas sigue funcionando igual.
        val webAppUrl = secretProperty("WEB_APP_URL")

        buildConfigField("String", "SUPABASE_URL", "\"${escapedBuildConfigString(supabaseUrl)}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${escapedBuildConfigString(supabaseAnonKey)}\"")
        buildConfigField("String", "WEB_APP_URL", "\"${escapedBuildConfigString(webAppUrl)}\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    val roomVersion = "2.6.1"
    val ktorVersion = "2.3.12"

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-okhttp:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    testImplementation(kotlin("test"))

    debugImplementation("androidx.compose.ui:ui-tooling")
}
