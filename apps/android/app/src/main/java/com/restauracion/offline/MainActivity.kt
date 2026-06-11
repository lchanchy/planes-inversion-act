package com.restauracion.offline

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.restauracion.offline.ui.RestauracionApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as RestauracionApplication).container
        setContent {
            RestauracionApp(container = container)
        }
    }
}
