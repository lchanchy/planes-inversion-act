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

    private val migration5To6 = object : Migration(5, 6) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS material_deliveries (
                    id TEXT NOT NULL PRIMARY KEY,
                    projectId TEXT NOT NULL,
                    familyId TEXT NOT NULL,
                    operationalPlanId TEXT NOT NULL,
                    deliveryDate TEXT NOT NULL,
                    status TEXT NOT NULL,
                    observations TEXT,
                    registeredBy TEXT,
                    familySignature TEXT,
                    technicianSignature TEXT,
                    syncState TEXT NOT NULL,
                    lastError TEXT
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS material_delivery_items (
                    id TEXT NOT NULL PRIMARY KEY,
                    materialDeliveryId TEXT NOT NULL,
                    projectId TEXT NOT NULL,
                    familyId TEXT NOT NULL,
                    operationalPlanId TEXT NOT NULL,
                    planActivityId TEXT NOT NULL,
                    activityId TEXT,
                    planProjectMaterialId TEXT NOT NULL,
                    materialId TEXT,
                    provisionalMaterialId TEXT,
                    materialName TEXT NOT NULL,
                    unit TEXT NOT NULL,
                    approvedQuantity REAL NOT NULL,
                    deliveredQuantity REAL NOT NULL,
                    observations TEXT,
                    syncState TEXT NOT NULL
                )
                """.trimIndent()
            )
        }
    }

    private val migration6To7 = object : Migration(6, 7) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("CREATE TABLE IF NOT EXISTS pending_material_deletions (id TEXT NOT NULL PRIMARY KEY)")
        }
    }

    // Fase 8: modulo Economia Familiar. Solo agrega tablas nuevas; no toca nada existente.
    private val migration7To8 = object : Migration(7, 8) {
        override fun migrate(db: SupportSQLiteDatabase) {
            // Catalogos
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_equipos (id TEXT NOT NULL PRIMARY KEY, codigo TEXT NOT NULL, nombre TEXT NOT NULL, orden INTEGER NOT NULL, activo INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_encuestadores (id TEXT NOT NULL PRIMARY KEY, nombre TEXT NOT NULL, activo INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_rondas (id TEXT NOT NULL PRIMARY KEY, codigo TEXT NOT NULL, nombre TEXT NOT NULL, orden INTEGER NOT NULL, activo INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_categorias (id TEXT NOT NULL PRIMARY KEY, codigo TEXT NOT NULL, nombre TEXT NOT NULL, orden INTEGER NOT NULL, activo INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_productos (id TEXT NOT NULL PRIMARY KEY, categoriaId TEXT NOT NULL, codigo TEXT NOT NULL, nombre TEXT NOT NULL, esPecuario INTEGER NOT NULL, unidadBase TEXT NOT NULL, orden INTEGER NOT NULL, activo INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_tipos_apoyo (id TEXT NOT NULL PRIMARY KEY, codigo TEXT NOT NULL, nombre TEXT NOT NULL, orden INTEGER NOT NULL, activo INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_tipos_pago (id TEXT NOT NULL PRIMARY KEY, codigo TEXT NOT NULL, nombre TEXT NOT NULL, orden INTEGER NOT NULL, activo INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_lugares_venta (id TEXT NOT NULL PRIMARY KEY, codigo TEXT NOT NULL, nombre TEXT NOT NULL, orden INTEGER NOT NULL, activo INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE IF NOT EXISTS economia_familias (id TEXT NOT NULL PRIMARY KEY, projectId TEXT NOT NULL, familyId TEXT NOT NULL, activo INTEGER NOT NULL, notas TEXT)")
            // Captura
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS economia_encuestas (
                    id TEXT NOT NULL PRIMARY KEY,
                    projectId TEXT NOT NULL,
                    familyId TEXT NOT NULL,
                    rondaId TEXT NOT NULL,
                    equipoId TEXT,
                    encuestadorId TEXT,
                    fecha TEXT NOT NULL,
                    cambioNumPersonas INTEGER,
                    personasNinos INTEGER,
                    personasAdolescentes INTEGER,
                    personasJovenes INTEGER,
                    personasAdultos INTEGER,
                    personasMayores INTEGER,
                    recibeApoyoGobierno INTEGER,
                    recibeOtrosPagos INTEGER,
                    valorJornal REAL,
                    estado TEXT NOT NULL,
                    observaciones TEXT,
                    syncState TEXT NOT NULL,
                    lastError TEXT
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS economia_encuesta_apoyos (
                    id TEXT NOT NULL PRIMARY KEY,
                    encuestaId TEXT NOT NULL,
                    projectId TEXT NOT NULL,
                    familyId TEXT NOT NULL,
                    tipoApoyoId TEXT NOT NULL,
                    valorMensual REAL,
                    nombreLibre TEXT,
                    syncState TEXT NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS economia_encuesta_pagos (
                    id TEXT NOT NULL PRIMARY KEY,
                    encuestaId TEXT NOT NULL,
                    projectId TEXT NOT NULL,
                    familyId TEXT NOT NULL,
                    tipoPagoId TEXT NOT NULL,
                    valorMensual REAL,
                    syncState TEXT NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS economia_encuesta_productos (
                    id TEXT NOT NULL PRIMARY KEY,
                    encuestaId TEXT NOT NULL,
                    projectId TEXT NOT NULL,
                    familyId TEXT NOT NULL,
                    productoId TEXT,
                    nombreOtro TEXT,
                    unidad TEXT,
                    esPecuario INTEGER NOT NULL,
                    temporalidad TEXT,
                    cantidadProducida REAL,
                    consumo REAL,
                    vendido REAL,
                    motivoNoVenta TEXT,
                    precioUnitario REAL,
                    apoyoAct INTEGER,
                    syncState TEXT NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS economia_producto_lugares_venta (
                    id TEXT NOT NULL PRIMARY KEY,
                    encuestaProductoId TEXT NOT NULL,
                    projectId TEXT NOT NULL,
                    familyId TEXT NOT NULL,
                    lugarVentaId TEXT NOT NULL,
                    nombreLibre TEXT,
                    syncState TEXT NOT NULL
                )
                """.trimIndent()
            )
        }
    }

    private val database = Room.databaseBuilder(
        context,
        RestauracionDatabase::class.java,
        "restauracion_offline.db"
    ).addMigrations(migration1To2, migration2To3, migration3To4, migration4To5, migration5To6, migration6To7, migration7To8).build()

    val sessionStore = SessionStore(context)

    private val remote = SupabaseRestClient(
        baseUrl = BuildConfig.SUPABASE_URL,
        anonKey = BuildConfig.SUPABASE_ANON_KEY,
        sessionStore = sessionStore,
        webAppUrl = BuildConfig.WEB_APP_URL
    )

    val repository = RestauracionRepository(
        db = database,
        remote = remote,
        sessionStore = sessionStore
    )
}
