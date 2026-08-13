package com.restauracion.offline.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

// ==========================================================================
// Modulo Economia Familiar (Fase 8): encuesta offline de ingresos economicos.
// Aislado del flujo de planes/entregas. Reutiliza families/municipalities/villages
// ya existentes (no duplica territorio ni familias).
//
// Catalogos: se descargan del servidor y se REEMPLAZAN (igual que activity/material
// catalog) para purgar lo eliminado en la web. No llevan SyncState.
// Captura: lleva SyncState (Room es la fuente de verdad; la red es best-effort).
// ==========================================================================

// --- Catalogos ---

@Entity(tableName = "economia_equipos")
data class EconomiaEquipoEntity(
    @PrimaryKey val id: String,
    val codigo: String,
    val nombre: String,
    val orden: Int,
    val activo: Boolean
)

@Entity(tableName = "economia_encuestadores")
data class EconomiaEncuestadorEntity(
    @PrimaryKey val id: String,
    val nombre: String,
    val activo: Boolean
)

@Entity(tableName = "economia_rondas")
data class EconomiaRondaEntity(
    @PrimaryKey val id: String,
    val codigo: String,
    val nombre: String,
    val orden: Int,
    val activo: Boolean
)

@Entity(tableName = "economia_categorias")
data class EconomiaCategoriaEntity(
    @PrimaryKey val id: String,
    val codigo: String,
    val nombre: String,
    val orden: Int,
    val activo: Boolean
)

@Entity(tableName = "economia_productos")
data class EconomiaProductoEntity(
    @PrimaryKey val id: String,
    val categoriaId: String,
    val codigo: String,
    val nombre: String,
    val esPecuario: Boolean,
    val unidadBase: String,          // kg | animal
    val orden: Int,
    val activo: Boolean
)

@Entity(tableName = "economia_tipos_apoyo")
data class EconomiaTipoApoyoEntity(
    @PrimaryKey val id: String,
    val codigo: String,
    val nombre: String,
    val orden: Int,
    val activo: Boolean
)

@Entity(tableName = "economia_tipos_pago")
data class EconomiaTipoPagoEntity(
    @PrimaryKey val id: String,
    val codigo: String,
    val nombre: String,
    val orden: Int,
    val activo: Boolean
)

@Entity(tableName = "economia_lugares_venta")
data class EconomiaLugarVentaEntity(
    @PrimaryKey val id: String,
    val codigo: String,
    val nombre: String,
    val orden: Int,
    val activo: Boolean
)

// Marcador de familias que participan en Economia Familiar (apunta a la familia real).
// Se descarga para saber que familias ofrecer en el selector de la encuesta.
@Entity(tableName = "economia_familias")
data class EconomiaFamiliaEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val familyId: String,
    val activo: Boolean,
    val notas: String?
)

// --- Captura ---

@Entity(tableName = "economia_encuestas")
data class EconomiaEncuestaEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val projectId: String,
    val familyId: String,
    val rondaId: String,
    val equipoId: String?,
    val encuestadorId: String?,
    val fecha: String,                       // ISO yyyy-MM-dd
    val cambioNumPersonas: Boolean?,
    val personasNinos: Int?,
    val personasAdolescentes: Int?,
    val personasJovenes: Int?,
    val personasAdultos: Int?,
    val personasMayores: Int?,
    val recibeApoyoGobierno: Boolean?,
    val recibeOtrosPagos: Boolean?,
    val valorJornal: Double?,
    val estado: String = "completada",       // borrador | completada
    val observaciones: String?,
    val syncState: SyncState = SyncState.PENDING_SYNC,
    val lastError: String? = null
)

@Entity(tableName = "economia_encuesta_apoyos")
data class EconomiaEncuestaApoyoEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val encuestaId: String,
    val projectId: String,
    val familyId: String,
    val tipoApoyoId: String,
    val valorMensual: Double?,
    val nombreLibre: String?,
    val syncState: SyncState = SyncState.PENDING_SYNC
)

@Entity(tableName = "economia_encuesta_pagos")
data class EconomiaEncuestaPagoEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val encuestaId: String,
    val projectId: String,
    val familyId: String,
    val tipoPagoId: String,
    val valorMensual: Double?,
    val syncState: SyncState = SyncState.PENDING_SYNC
)

@Entity(tableName = "economia_encuesta_productos")
data class EconomiaEncuestaProductoEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val encuestaId: String,
    val projectId: String,
    val familyId: String,
    val productoId: String?,                 // null si es "otro" producto libre
    val nombreOtro: String?,
    val unidad: String?,                     // g | kg | litro | unidad (para "otro")
    val esPecuario: Boolean = false,
    val temporalidad: String?,               // pecuario: diario..anual
    val cantidadProducida: Double?,
    val consumo: Double?,
    val vendido: Double?,
    val motivoNoVenta: String?,
    val precioUnitario: Double?,
    val apoyoAct: Boolean?,
    val syncState: SyncState = SyncState.PENDING_SYNC
)

@Entity(tableName = "economia_producto_lugares_venta")
data class EconomiaProductoLugarVentaEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val encuestaProductoId: String,
    val projectId: String,
    val familyId: String,
    val lugarVentaId: String,
    val nombreLibre: String?,
    val syncState: SyncState = SyncState.PENDING_SYNC
)
