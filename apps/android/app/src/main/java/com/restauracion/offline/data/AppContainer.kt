package com.restauracion.offline.data

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.restauracion.offline.BuildConfig
import com.restauracion.offline.data.local.RestauracionDatabase
import com.restauracion.offline.data.remote.SupabaseRestClient
import com.restauracion.offline.data.repository.RestauracionRepository

class AppContainer(context: Context) {
    private val migration1To2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS counterpart_catalog (
                    id TEXT NOT NULL PRIMARY KEY,
                    projectId TEXT,
                    name TEXT NOT NULL,
                    contributionType TEXT NOT NULL,
                    suggestedUnit TEXT NOT NULL,
                    active INTEGER NOT NULL
                )
                """.trimIndent()
            )
        }
    }

    private val migration2To3 = object : Migration(2, 3) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("CREATE TABLE IF NOT EXISTS municipalities (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS villages (id TEXT NOT NULL PRIMARY KEY, municipalityId TEXT NOT NULL, name TEXT NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS properties (id TEXT NOT NULL PRIMARY KEY, familyId TEXT NOT NULL, propertyName TEXT, totalAreaHa REAL)")
        }
    }

    private val migration3To4 = object : Migration(3, 4) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE plan_family_counterparts ADD COLUMN vegetalIndicatorGroup TEXT")
        }
    }

    private val migration4To5 = object : Migration(4, 5) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE material_catalog ADD COLUMN vegetalIndicatorGroup TEXT")
        }
    }

    private val database = Room.databaseBuilder(
        context,
        RestauracionDatabase::class.java,
        "restauracion_offline.db"
    ).addMigrations(migration1To2, migration2To3, migration3To4, migration4To5).build()

    private val sessionStore = SessionStore(context)

    private val remote = SupabaseRestClient(
        baseUrl = BuildConfig.SUPABASE_URL,
        anonKey = BuildConfig.SUPABASE_ANON_KEY,
        sessionStore = sessionStore
    )

    val repository = RestauracionRepository(
        db = database,
        remote = remote,
        sessionStore = sessionStore
    )
}
