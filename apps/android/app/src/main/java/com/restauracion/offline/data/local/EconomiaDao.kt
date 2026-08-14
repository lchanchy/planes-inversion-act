package com.restauracion.offline.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

// DAO del modulo Economia Familiar. Mismos patrones que CatalogDao/PlanDao:
// - catalogos: replace() atomico (deleteAll + upsert) para purgar lo eliminado en la web.
// - captura: pending*() por SyncState para el push; upsert/update/delete locales.
@Dao
interface EconomiaDao {

    // ---------- Catalogos (lectura) ----------
    @Query("select * from economia_equipos where activo = 1 order by orden, nombre")
    fun equipos(): Flow<List<EconomiaEquipoEntity>>

    @Query("select * from economia_encuestadores where activo = 1 order by nombre")
    fun encuestadores(): Flow<List<EconomiaEncuestadorEntity>>

    @Query("select * from economia_rondas where activo = 1 order by orden, nombre")
    fun rondas(): Flow<List<EconomiaRondaEntity>>

    @Query("select * from economia_categorias where activo = 1 order by orden, nombre")
    fun categorias(): Flow<List<EconomiaCategoriaEntity>>

    @Query("select * from economia_productos where activo = 1 order by orden, nombre")
    fun productos(): Flow<List<EconomiaProductoEntity>>

    @Query("select * from economia_productos where activo = 1 and categoriaId = :categoriaId order by orden, nombre")
    fun productosPorCategoria(categoriaId: String): Flow<List<EconomiaProductoEntity>>

    @Query("select * from economia_tipos_apoyo where activo = 1 order by orden, nombre")
    fun tiposApoyo(): Flow<List<EconomiaTipoApoyoEntity>>

    @Query("select * from economia_tipos_pago where activo = 1 order by orden, nombre")
    fun tiposPago(): Flow<List<EconomiaTipoPagoEntity>>

    @Query("select * from economia_lugares_venta where activo = 1 order by orden, nombre")
    fun lugaresVenta(): Flow<List<EconomiaLugarVentaEntity>>

    // Familias marcadas para economia en un proyecto (para el selector de la encuesta).
    @Query("select * from economia_familias where projectId = :projectId and activo = 1")
    fun familiasEconomia(projectId: String): Flow<List<EconomiaFamiliaEntity>>

    // ---------- Catalogos (escritura) ----------
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertEquipos(items: List<EconomiaEquipoEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertEncuestadores(items: List<EconomiaEncuestadorEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertRondas(items: List<EconomiaRondaEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCategorias(items: List<EconomiaCategoriaEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProductos(items: List<EconomiaProductoEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTiposApoyo(items: List<EconomiaTipoApoyoEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTiposPago(items: List<EconomiaTipoPagoEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLugaresVenta(items: List<EconomiaLugarVentaEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertFamiliasEconomia(items: List<EconomiaFamiliaEntity>)

    @Query("delete from economia_equipos")
    suspend fun deleteAllEquipos()

    @Query("delete from economia_encuestadores")
    suspend fun deleteAllEncuestadores()

    @Query("delete from economia_rondas")
    suspend fun deleteAllRondas()

    @Query("delete from economia_categorias")
    suspend fun deleteAllCategorias()

    @Query("delete from economia_productos")
    suspend fun deleteAllProductos()

    @Query("delete from economia_tipos_apoyo")
    suspend fun deleteAllTiposApoyo()

    @Query("delete from economia_tipos_pago")
    suspend fun deleteAllTiposPago()

    @Query("delete from economia_lugares_venta")
    suspend fun deleteAllLugaresVenta()

    @Query("delete from economia_familias")
    suspend fun deleteAllFamiliasEconomia()

    // Reemplazo atomico de cada catalogo (purga lo eliminado en la web).
    @Transaction
    suspend fun replaceEquipos(items: List<EconomiaEquipoEntity>) { deleteAllEquipos(); upsertEquipos(items) }

    @Transaction
    suspend fun replaceEncuestadores(items: List<EconomiaEncuestadorEntity>) { deleteAllEncuestadores(); upsertEncuestadores(items) }

    @Transaction
    suspend fun replaceRondas(items: List<EconomiaRondaEntity>) { deleteAllRondas(); upsertRondas(items) }

    @Transaction
    suspend fun replaceCategorias(items: List<EconomiaCategoriaEntity>) { deleteAllCategorias(); upsertCategorias(items) }

    @Transaction
    suspend fun replaceProductos(items: List<EconomiaProductoEntity>) { deleteAllProductos(); upsertProductos(items) }

    @Transaction
    suspend fun replaceTiposApoyo(items: List<EconomiaTipoApoyoEntity>) { deleteAllTiposApoyo(); upsertTiposApoyo(items) }

    @Transaction
    suspend fun replaceTiposPago(items: List<EconomiaTipoPagoEntity>) { deleteAllTiposPago(); upsertTiposPago(items) }

    @Transaction
    suspend fun replaceLugaresVenta(items: List<EconomiaLugarVentaEntity>) { deleteAllLugaresVenta(); upsertLugaresVenta(items) }

    @Transaction
    suspend fun replaceFamiliasEconomia(items: List<EconomiaFamiliaEntity>) { deleteAllFamiliasEconomia(); upsertFamiliasEconomia(items) }

    // ---------- Encuestas (captura local) ----------
    @Query("select * from economia_encuestas where projectId = :projectId order by fecha desc")
    fun encuestas(projectId: String): Flow<List<EconomiaEncuestaEntity>>

    // Bandeja de salida: todas las encuestas locales (offline y sincronizadas).
    @Query("select * from economia_encuestas order by fecha desc")
    fun allEncuestas(): Flow<List<EconomiaEncuestaEntity>>

    // Descarga de encuestas del servidor (para saber que monitoreos ya tiene cada familia).
    // IGNORE: no pisa una encuesta capturada localmente que aun esta pendiente de subir.
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertEncuestasIfNew(items: List<EconomiaEncuestaEntity>)
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertApoyosIfNew(items: List<EconomiaEncuestaApoyoEntity>)
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertPagosIfNew(items: List<EconomiaEncuestaPagoEntity>)
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertProductosIfNew(items: List<EconomiaEncuestaProductoEntity>)
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertLugaresIfNew(items: List<EconomiaProductoLugarVentaEntity>)

    // Refleja el estado de revision del servidor solo en encuestas ya sincronizadas
    // (no pisa una edicion local pendiente).
    @Query("update economia_encuestas set estado = :estado where id = :id and syncState = 'SYNCED'")
    suspend fun updateSyncedEncuestaEstado(id: String, estado: String)

    // Encuesta devuelta en la web: se reactiva como pendiente/offline para editar y reenviar.
    @Query("update economia_encuestas set estado = 'devuelta', syncState = 'PENDING_SYNC' where id = :id and syncState = 'SYNCED'")
    suspend fun markEncuestaDevuelta(id: String)

    @Query("select * from economia_encuestas where familyId = :familyId order by fecha desc")
    fun encuestasForFamily(familyId: String): Flow<List<EconomiaEncuestaEntity>>

    @Query("select * from economia_encuestas where id = :id limit 1")
    fun encuesta(id: String): Flow<EconomiaEncuestaEntity?>

    @Query("select * from economia_encuestas where id = :id limit 1")
    suspend fun encuestaById(id: String): EconomiaEncuestaEntity?

    // Encuesta existente de una familia en una ronda (unica por familia+ronda en el servidor).
    @Query("select * from economia_encuestas where familyId = :familyId and rondaId = :rondaId limit 1")
    suspend fun encuestaForFamilyRonda(familyId: String, rondaId: String): EconomiaEncuestaEntity?

    @Query("select * from economia_encuesta_apoyos where encuestaId = :encuestaId")
    fun apoyos(encuestaId: String): Flow<List<EconomiaEncuestaApoyoEntity>>

    @Query("select * from economia_encuesta_apoyos where encuestaId = :encuestaId")
    suspend fun apoyosOnce(encuestaId: String): List<EconomiaEncuestaApoyoEntity>

    @Query("select * from economia_encuesta_pagos where encuestaId = :encuestaId")
    fun pagos(encuestaId: String): Flow<List<EconomiaEncuestaPagoEntity>>

    @Query("select * from economia_encuesta_pagos where encuestaId = :encuestaId")
    suspend fun pagosOnce(encuestaId: String): List<EconomiaEncuestaPagoEntity>

    @Query("select * from economia_encuesta_productos where encuestaId = :encuestaId")
    fun productosEncuesta(encuestaId: String): Flow<List<EconomiaEncuestaProductoEntity>>

    @Query("select * from economia_encuesta_productos where encuestaId = :encuestaId")
    suspend fun productosEncuestaOnce(encuestaId: String): List<EconomiaEncuestaProductoEntity>

    @Query("select * from economia_producto_lugares_venta where encuestaProductoId = :encuestaProductoId")
    fun lugaresDeProducto(encuestaProductoId: String): Flow<List<EconomiaProductoLugarVentaEntity>>

    @Query("select * from economia_producto_lugares_venta where encuestaProductoId = :encuestaProductoId")
    suspend fun lugaresDeProductoOnce(encuestaProductoId: String): List<EconomiaProductoLugarVentaEntity>

    // ---------- Escritura de captura ----------
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertEncuesta(item: EconomiaEncuestaEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertApoyo(item: EconomiaEncuestaApoyoEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPago(item: EconomiaEncuestaPagoEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProducto(item: EconomiaEncuestaProductoEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLugarProducto(item: EconomiaProductoLugarVentaEntity)

    @Update
    suspend fun updateEncuesta(item: EconomiaEncuestaEntity)

    @Update
    suspend fun updateApoyo(item: EconomiaEncuestaApoyoEntity)

    @Update
    suspend fun updatePago(item: EconomiaEncuestaPagoEntity)

    @Update
    suspend fun updateProducto(item: EconomiaEncuestaProductoEntity)

    @Update
    suspend fun updateLugarProducto(item: EconomiaProductoLugarVentaEntity)

    @Query("delete from economia_encuestas where id = :id")
    suspend fun deleteEncuesta(id: String)

    @Query("delete from economia_encuesta_apoyos where id = :id")
    suspend fun deleteApoyo(id: String)

    @Query("delete from economia_encuesta_pagos where id = :id")
    suspend fun deletePago(id: String)

    @Query("delete from economia_encuesta_productos where id = :id")
    suspend fun deleteProducto(id: String)

    @Query("delete from economia_producto_lugares_venta where id = :id")
    suspend fun deleteLugarProducto(id: String)

    @Query("delete from economia_encuesta_apoyos where encuestaId = :encuestaId")
    suspend fun deleteApoyosForEncuesta(encuestaId: String)

    @Query("delete from economia_encuesta_pagos where encuestaId = :encuestaId")
    suspend fun deletePagosForEncuesta(encuestaId: String)

    @Query("delete from economia_producto_lugares_venta where encuestaProductoId = :encuestaProductoId")
    suspend fun deleteLugaresForProducto(encuestaProductoId: String)

    @Query("delete from economia_encuesta_productos where encuestaId = :encuestaId")
    suspend fun deleteProductosForEncuesta(encuestaId: String)

    @Query("delete from economia_producto_lugares_venta where encuestaProductoId in (select id from economia_encuesta_productos where encuestaId = :encuestaId)")
    suspend fun deleteLugaresForEncuesta(encuestaId: String)

    // ---------- Pendientes de sincronizar (push, en orden de FK) ----------
    @Query("select * from economia_encuestas where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingEncuestas(): List<EconomiaEncuestaEntity>

    @Query("select * from economia_encuesta_apoyos where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingApoyos(): List<EconomiaEncuestaApoyoEntity>

    @Query("select * from economia_encuesta_pagos where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingPagos(): List<EconomiaEncuestaPagoEntity>

    @Query("select * from economia_encuesta_productos where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingProductos(): List<EconomiaEncuestaProductoEntity>

    @Query("select * from economia_producto_lugares_venta where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingLugaresProducto(): List<EconomiaProductoLugarVentaEntity>
}
