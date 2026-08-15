package com.restauracion.offline.data

import android.content.Context
import com.restauracion.offline.BuildConfig
import java.time.Instant

class CrashDiagnostics(context: Context) {
    private val preferences = context.getSharedPreferences("crash_diagnostics", Context.MODE_PRIVATE)

    fun install() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            val trace = error.stackTrace.take(8).joinToString("\n")
            val report = "${Instant.now()} · ${BuildConfig.VERSION_NAME} · ${error.javaClass.simpleName}: " +
                "${error.message.orEmpty()}\n$trace"
            preferences.edit().putString(LAST_CRASH, report.take(MAX_REPORT_LENGTH)).commit()
            previous?.uncaughtException(thread, error)
        }
    }

    fun consumeLastCrash(): String? {
        val report = preferences.getString(LAST_CRASH, null) ?: return null
        preferences.edit().remove(LAST_CRASH).apply()
        return "La app se cerró inesperadamente la vez anterior. Diagnóstico local:\n$report"
    }

    private companion object {
        const val LAST_CRASH = "last_crash"
        const val MAX_REPORT_LENGTH = 4_000
    }
}
