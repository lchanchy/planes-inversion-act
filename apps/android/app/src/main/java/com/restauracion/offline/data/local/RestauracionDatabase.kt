package com.restauracion.offline.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        ProjectEntity::class,
        FamilyEntity::class,
        MunicipalityEntity::class,
        VillageEntity::class,
        PropertyEntity::class,
        ActivityCatalogEntity::class,
        MaterialCatalogEntity::class,
        CounterpartCatalogEntity::class,
        OperationalPlanEntity::class,
        PlanActivityEntity::class,
        PlanProjectMaterialEntity::class,
        PlanFamilyCounterpartEntity::class,
        MaterialDeliveryEntity::class,
        MaterialDeliveryItemEntity::class,
        PendingMaterialDeletionEntity::class,
        // Modulo Economia Familiar (Fase 8)
        EconomiaEquipoEntity::class,
        EconomiaEncuestadorEntity::class,
        EconomiaRondaEntity::class,
        EconomiaCategoriaEntity::class,
        EconomiaProductoEntity::class,
        EconomiaTipoApoyoEntity::class,
        EconomiaTipoPagoEntity::class,
        EconomiaLugarVentaEntity::class,
        EconomiaFamiliaEntity::class,
        EconomiaEncuestaEntity::class,
        EconomiaEncuestaApoyoEntity::class,
        EconomiaEncuestaPagoEntity::class,
        EconomiaEncuestaProductoEntity::class,
        EconomiaProductoLugarVentaEntity::class
    ],
    version = 10,
    exportSchema = false
)
abstract class RestauracionDatabase : RoomDatabase() {
    abstract fun catalogDao(): CatalogDao
    abstract fun planDao(): PlanDao
    abstract fun economiaDao(): EconomiaDao
}
