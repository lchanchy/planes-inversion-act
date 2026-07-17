package com.restauracion.offline.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

enum class SyncState { PENDING_SYNC, SYNCED, ERROR, CONFLICT }

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val codePrefix: String,
    val status: String,
    val syncState: SyncState = SyncState.SYNCED
)

@Entity(tableName = "families")
data class FamilyEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val familyCode: String,
    val representativeName: String,
    val documentNumber: String?,
    val municipalityId: String?,
    val villageId: String?,
    val status: String,
    val syncState: SyncState = SyncState.SYNCED
)

@Entity(tableName = "municipalities")
data class MunicipalityEntity(
    @PrimaryKey val id: String,
    val name: String
)

@Entity(tableName = "villages")
data class VillageEntity(
    @PrimaryKey val id: String,
    val municipalityId: String,
    val name: String
)

@Entity(tableName = "properties")
data class PropertyEntity(
    @PrimaryKey val id: String,
    val familyId: String,
    val propertyName: String?,
    val totalAreaHa: Double?
)

@Entity(tableName = "activity_catalog")
data class ActivityCatalogEntity(
    @PrimaryKey val id: String,
    val projectId: String?,
    val name: String,
    val unit: String,
    val requiresBaseline: Boolean,
    val requiresTarget: Boolean,
    val active: Boolean
)

@Entity(tableName = "material_catalog")
data class MaterialCatalogEntity(
    @PrimaryKey val id: String,
    val projectId: String?,
    val name: String,
    val category: String?,
    val unit: String,
    val quotedUnitPrice: Double,
    val vegetalIndicatorGroup: String? = null,
    val active: Boolean
)

@Entity(tableName = "counterpart_catalog")
data class CounterpartCatalogEntity(
    @PrimaryKey val id: String,
    val projectId: String?,
    val name: String,
    val contributionType: String,
    val suggestedUnit: String,
    val active: Boolean
)

@Entity(tableName = "operational_plans")
data class OperationalPlanEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val projectId: String,
    val familyId: String,
    val technicianId: String?,
    val planDate: String,
    val status: String = "draft",
    val version: Int = 1,
    val syncState: SyncState = SyncState.PENDING_SYNC,
    val lastError: String? = null
)

@Entity(tableName = "plan_activities")
data class PlanActivityEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val planId: String,
    val activityId: String,
    val baseline: Double?,
    val target: Double?,
    val unit: String,
    val observations: String?,
    val syncState: SyncState = SyncState.PENDING_SYNC
)

@Entity(tableName = "plan_project_materials")
data class PlanProjectMaterialEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val planActivityId: String,
    val materialId: String?,
    val provisionalName: String?,
    val quantity: Double,
    val unit: String,
    val quotedUnitPrice: Double,
    val observations: String?,
    val syncState: SyncState = SyncState.PENDING_SYNC
)

@Entity(tableName = "plan_family_counterparts")
data class PlanFamilyCounterpartEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val planActivityId: String,
    val contributionType: String,
    val name: String,
    val quantity: Double,
    val unit: String,
    val estimatedUnitValue: Double,
    val vegetalIndicatorGroup: String? = null,
    val observations: String?,
    val syncState: SyncState = SyncState.PENDING_SYNC
)

@Entity(tableName = "material_deliveries")
data class MaterialDeliveryEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val projectId: String,
    val familyId: String,
    val operationalPlanId: String,
    val deliveryDate: String,
    val status: String,                    // entregado_parcial | entregado_total
    val observations: String?,
    val registeredBy: String?,             // users_profiles id (resuelto al sincronizar)
    val familySignature: String?,          // data URI PNG dibujado en campo
    val technicianSignature: String?,
    val syncState: SyncState = SyncState.PENDING_SYNC,
    val lastError: String? = null
)

@Entity(tableName = "material_delivery_items")
data class MaterialDeliveryItemEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val materialDeliveryId: String,
    val projectId: String,
    val familyId: String,
    val operationalPlanId: String,
    val planActivityId: String,
    val activityId: String?,
    val planProjectMaterialId: String,
    val materialId: String?,
    val provisionalMaterialId: String?,
    val materialName: String,
    val unit: String,
    val approvedQuantity: Double,
    val deliveredQuantity: Double,
    val observations: String?,
    val syncState: SyncState = SyncState.PENDING_SYNC
)

// Cola durable de materiales por eliminar en el servidor (fusion de reasignacion hecha offline).
// La fila local ya se borro; aqui queda solo el id para propagar el borrado al sincronizar.
@Entity(tableName = "pending_material_deletions")
data class PendingMaterialDeletionEntity(
    @PrimaryKey val id: String
)
