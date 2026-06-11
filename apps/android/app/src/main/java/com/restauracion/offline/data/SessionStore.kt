package com.restauracion.offline.data

import android.content.Context

class SessionStore(context: Context) {
    private val preferences = context.getSharedPreferences("session", Context.MODE_PRIVATE)

    var accessToken: String?
        get() = preferences.getString("access_token", null)
        set(value) = preferences.edit().putString("access_token", value).apply()

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

    fun clear() {
        preferences.edit().clear().apply()
    }
}
