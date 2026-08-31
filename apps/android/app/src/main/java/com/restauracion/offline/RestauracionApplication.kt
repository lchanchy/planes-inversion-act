package com.restauracion.offline

import android.app.Application
import com.restauracion.offline.data.AppContainer
import com.restauracion.offline.data.CrashDiagnostics

class RestauracionApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        val crashDiagnostics = CrashDiagnostics(this).also { it.install() }
        container = AppContainer(this, crashDiagnostics)
    }
}
