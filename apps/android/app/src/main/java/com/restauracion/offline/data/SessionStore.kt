package com.restauracion.offline.data

import android.content.Context
import android.provider.Settings
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class SessionStore(context: Context) {
    private val preferences = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    val deviceId: String = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"

    var accessToken: String?
        get() = preferences.getString("access_token", null)
        set(value) = preferences.edit().putString("access_token", value).apply()

    var refreshToken: String?
        get() = preferences.getString("refresh_token", null)
        set(value) = preferences.edit().putString("refresh_token", value).apply()

    var userId: String?
        get() = preferences.getString("user_id", null)
        set(value) = preferences.edit().putString("user_id", value).apply()

    var lastScreen: String?
        get() = preferences.getString("last_screen", null)
        set(value) = preferences.edit().putString("last_screen", value).apply()

    var lastProjectId: String?
        get() = preferences.getString("last_project_id", null)
        set(value) = preferences.edit().putString("last_project_id", value).apply()

    var lastFamilyId: String?
        get() = preferences.getString("last_family_id", null)
        set(value) = preferences.edit().putString("last_family_id", value).apply()

    var lastPlanId: String?
        get() = preferences.getString("last_plan_id", null)
        set(value) = preferences.edit().putString("last_plan_id", value).apply()

    val hasSession: Boolean
        get() = !accessToken.isNullOrBlank()

    fun captureDraft(planId: String, key: String): String {
        return preferences.getString(captureDraftKey(planId, key), "").orEmpty()
    }

    fun saveCaptureDraft(planId: String, key: String, value: String) {
        preferences.edit().putString(captureDraftKey(planId, key), value).apply()
    }

    private fun captureDraftKey(planId: String, key: String): String = "capture_draft_${planId}_$key"

    fun queuedSyncLogs(): List<PendingSyncLog> = runCatching {
        json.decodeFromString<List<PendingSyncLog>>(preferences.getString(SYNC_LOG_QUEUE, "[]").orEmpty())
    }.getOrDefault(emptyList())

    fun replaceQueuedSyncLogs(items: List<PendingSyncLog>) {
        preferences.edit().putString(SYNC_LOG_QUEUE, json.encodeToString(items.takeLast(MAX_SYNC_LOGS))).apply()
    }

    fun enqueueSyncLog(item: PendingSyncLog) = replaceQueuedSyncLogs(queuedSyncLogs() + item)

    fun clear() {
        preferences.edit().clear().apply()
    }

    private companion object {
        const val SYNC_LOG_QUEUE = "pending_sync_logs"
        const val MAX_SYNC_LOGS = 20
    }
}

@Serializable
data class PendingSyncLog(
    val startedAt: String,
    val finishedAt: String,
    val status: String,
    val details: Map<String, String>
)
