package com.restauracion.offline

import android.app.Application
import com.restauracion.offline.data.AppContainer

class RestauracionApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
