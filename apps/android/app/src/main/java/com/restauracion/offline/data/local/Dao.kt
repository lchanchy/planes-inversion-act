package com.restauracion.offline.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface CatalogDao {
    @Query("select * from projects order by name")
    fun projects(): Flow<List<ProjectEntity>>

    @Query("select * from families where projectId = :projectId order by familyCode")
    fun families(projectId: String): Flow<List<FamilyEntity>>

    @Query("select * from municipalities order by name")
    fun municipalities(): Flow<List<MunicipalityEntity>>

    @Query("select * from villages order by name")
    fun villages(): Flow<List<VillageEntity>>

    @Query("select * from properties")
    fun properties(): Flow<List<PropertyEntity>>

    @Query("select * from activity_catalog where active = 1 and (projectId = :projectId or projectId is null) order by name")
    fun activities(projectId: String): Flow<List<ActivityCatalogEntity>>

    @Query("select * from material_catalog where active = 1 and (projectId = :projectId or projectId is null) order by name")
    fun materials(projectId: String): Flow<List<MaterialCatalogEntity>>

    @Query("select * from counterpart_catalog where active = 1 and (projectId = :projectId or projectId is null) order by name")
    fun counterparts(projectId: String): Flow<List<CounterpartCatalogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProjects(items: List<ProjectEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertFamilies(items: List<FamilyEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMunicipalities(items: List<MunicipalityEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertVillages(items: List<VillageEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProperties(items: List<PropertyEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertActivities(items: List<ActivityCatalogEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMaterials(items: List<MaterialCatalogEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCounterparts(items: List<CounterpartCatalogEntity>)

    @Query("delete from activity_catalog")
    suspend fun deleteAllActivities()

    @Query("delete from material_catalog")
    suspend fun deleteAllMaterials()

    @Query("delete from counterpart_catalog")
    suspend fun deleteAllCounterparts()

    // Reemplazo atomico: purga las entradas que ya no estan vigentes en el servidor
    // para que el tecnico no pueda seleccionar catalogos eliminados en planes nuevos.
    @Transaction
    suspend fun replaceActivities(items: List<ActivityCatalogEntity>) {
        deleteAllActivities()
        upsertActivities(items)
    }

    @Transaction
    suspend fun replaceMaterials(items: List<MaterialCatalogEntity>) {
        deleteAllMaterials()
        upsertMaterials(items)
    }

    @Transaction
    suspend fun replaceCounterparts(items: List<CounterpartCatalogEntity>) {
        deleteAllCounterparts()
        upsertCounterparts(items)
    }
}

@Dao
interface PlanDao {
    @Query("select * from operational_plans order by planDate desc")
    fun plans(): Flow<List<OperationalPlanEntity>>

    @Query("select * from operational_plans where projectId = :projectId order by planDate desc")
    fun sentPlans(projectId: String): Flow<List<OperationalPlanEntity>>

    @Query("select * from operational_plans where id = :id limit 1")
    fun plan(id: String): Flow<OperationalPlanEntity?>

    @Query("select * from operational_plans where familyId = :familyId and status in ('draft','returned') order by planDate desc limit 1")
    suspend fun editablePlanForFamily(familyId: String): OperationalPlanEntity?

    @Query("SELECT * FROM operational_plans WHERE familyId = :familyId ORDER BY version DESC LIMIT 1")
    suspend fun latestPlanForFamily(familyId: String): OperationalPlanEntity?

    @Query("SELECT MAX(version) FROM operational_plans WHERE familyId = :familyId")
    suspend fun maxVersionForFamily(familyId: String): Int?

    @Query("select * from operational_plans where id = :id limit 1")
    suspend fun planById(id: String): OperationalPlanEntity?

    @Query("select * from plan_activities where planId = :planId")
    fun activities(planId: String): Flow<List<PlanActivityEntity>>

    @Query("select * from plan_activities where planId = :planId")
    suspend fun activitiesForPlan(planId: String): List<PlanActivityEntity>

    @Query("select * from plan_project_materials where planActivityId = :planActivityId")
    suspend fun materialsForActivity(planActivityId: String): List<PlanProjectMaterialEntity>

    @Query("select * from plan_family_counterparts where planActivityId = :planActivityId")
    suspend fun counterpartsForActivity(planActivityId: String): List<PlanFamilyCounterpartEntity>

    @Query("select * from plan_activities where id = :id limit 1")
    suspend fun activityById(id: String): PlanActivityEntity?

    @Query("select * from plan_activities where planId = :planId and activityId = :activityId limit 1")
    suspend fun activityByCatalog(planId: String, activityId: String): PlanActivityEntity?

    @Query("select * from plan_project_materials where planActivityId = :activityId")
    fun materials(activityId: String): Flow<List<PlanProjectMaterialEntity>>

    @Query("select m.* from plan_project_materials m inner join plan_activities a on a.id = m.planActivityId where a.planId = :planId")
    fun materialsForPlan(planId: String): Flow<List<PlanProjectMaterialEntity>>

    @Query("select * from plan_family_counterparts where planActivityId = :activityId")
    fun counterparts(activityId: String): Flow<List<PlanFamilyCounterpartEntity>>

    @Query("select c.* from plan_family_counterparts c inner join plan_activities a on a.id = c.planActivityId where a.planId = :planId")
    fun counterpartsForPlan(planId: String): Flow<List<PlanFamilyCounterpartEntity>>

    @Query("select * from operational_plans where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingPlans(): List<OperationalPlanEntity>

    @Query("select * from plan_activities where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingActivities(): List<PlanActivityEntity>

    @Query("select * from plan_project_materials where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingMaterials(): List<PlanProjectMaterialEntity>

    @Query("select * from plan_family_counterparts where syncState in ('PENDING_SYNC','ERROR','CONFLICT')")
    suspend fun pendingCounterparts(): List<PlanFamilyCounterpartEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPlan(item: OperationalPlanEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertActivity(item: PlanActivityEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMaterial(item: PlanProjectMaterialEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCounterpart(item: PlanFamilyCounterpartEntity)

    @Update
    suspend fun updatePlan(item: OperationalPlanEntity)

    @Update
    suspend fun updateActivity(item: PlanActivityEntity)

    @Update
    suspend fun updateMaterial(item: PlanProjectMaterialEntity)

    @Update
    suspend fun updateCounterpart(item: PlanFamilyCounterpartEntity)

    @Query("delete from operational_plans where id = :id")
    suspend fun deletePlan(id: String)

    @Query("delete from plan_activities where id = :id")
    suspend fun deleteActivity(id: String)

    @Query("delete from plan_project_materials where id = :id")
    suspend fun deleteMaterial(id: String)

    @Query("delete from plan_family_counterparts where id = :id")
    suspend fun deleteCounterpart(id: String)

    @Query("delete from plan_project_materials where planActivityId = :activityId")
    suspend fun deleteMaterialsForActivity(activityId: String)

    @Query("delete from plan_family_counterparts where planActivityId = :activityId")
    suspend fun deleteCounterpartsForActivity(activityId: String)
}
