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
        PlanFamilyCounterpartEntity::class
    ],
    version = 5,
    exportSchema = false
)
abstract class RestauracionDatabase : RoomDatabase() {
    abstract fun catalogDao(): CatalogDao
    abstract fun planDao(): PlanDao
}
