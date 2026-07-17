package com.restauracion.offline.data.repository

import com.restauracion.offline.data.SessionStore
import com.restauracion.offline.data.local.MaterialDeliveryEntity
import com.restauracion.offline.data.local.MaterialDeliveryItemEntity
import com.restauracion.offline.data.local.OperationalPlanEntity
import com.restauracion.offline.data.local.PlanActivityEntity
import com.restauracion.offline.data.local.PlanFamilyCounterpartEntity
import com.restauracion.offline.data.local.PlanProjectMaterialEntity
import com.restauracion.offline.data.local.RestauracionDatabase
import com.restauracion.offline.data.local.SyncState
import com.restauracion.offline.data.remote.SupabaseRestClient
import java.time.LocalDate
import java.util.UUID

class RestauracionRepository(
    private val db: RestauracionDatabase,
    private val remote: SupabaseRestClient,
    private val sessionStore: SessionStore
) {
    val projects = db.catalogDao().projects()
    val plans = db.planDao().plans()

    fun sentPlans(projectId: String) = db.planDao().sentPlans(projectId)
    fun families(projectId: String) = db.catalogDao().families(projectId)
    fun municipalities() = db.catalogDao().municipalities()
    fun villages() = db.catalogDao().villages()
    fun properties() = db.catalogDao().properties()
    fun activities(projectId: String) = db.catalogDao().activities(projectId)
    fun materials(projectId: String) = db.catalogDao().materials(projectId)
    fun counterpartCatalog(projectId: String) = db.catalogDao().counterparts(projectId)
    fun planActivities(planId: String) = db.planDao().activities(planId)
    fun plan(planId: String) = db.planDao().plan(planId)
    fun planMaterials(activityId: String) = db.planDao().materials(activityId)
    fun planCounterparts(activityId: String) = db.planDao().counterparts(activityId)
    fun planMaterialsTotal(planId: String) = db.planDao().materialsForPlan(planId)
    fun planCounterpartsTotal(planId: String) = db.planDao().counterpartsForPlan(planId)
    fun deliveriesForPlan(planId: String) = db.planDao().deliveriesForPlan(planId)
    fun deliveryItemsForPlan(planId: String) = db.planDao().deliveryItemsForPlan(planId)
    fun hasSession() = sessionStore.hasSession
    fun lastScreen() = sessionStore.lastScreen
    fun lastProjectId() = sessionStore.lastProjectId
    fun lastFamilyId() = sessionStore.lastFamilyId
    fun lastPlanId() = sessionStore.lastPlanId

    fun saveNavigationState(screen: String, projectId: String?, familyId: String?, planId: String?) {
        sessionStore.lastScreen = screen
        sessionStore.lastProjectId = projectId
        sessionStore.lastFamilyId = familyId
        sessionStore.lastPlanId = planId
    }

    fun captureDraft(planId: String, key: String) = sessionStore.captureDraft(planId, key)

    fun saveCaptureDraft(planId: String, key: String, value: String) {
        sessionStore.saveCaptureDraft(planId, key, value)
    }

    suspend fun login(email: String, password: String) = remote.login(email, password)

    suspend fun downloadInitialData() {
        db.catalogDao().upsertProjects(remote.projects())
        db.catalogDao().upsertFamilies(remote.families())
        db.catalogDao().upsertMunicipalities(remote.municipalities())
        db.catalogDao().upsertVillages(remote.villages())
        db.catalogDao().upsertProperties(remote.properties())
        // Los catalogos usan reemplazo (no upsert) para purgar entradas eliminadas en la web:
        // asi el tecnico no puede seleccionar actividades/materiales viejos en planes nuevos.
        // remote.*() se evalua antes del reemplazo; si falla la descarga, la BD local no se toca.
        db.catalogDao().replaceActivities(remote.activities())
        db.catalogDao().replaceMaterials(remote.materials())
        db.catalogDao().replaceCounterparts(remote.counterpartCatalog())
        // Estado de aprobacion de los planes desde el servidor (para habilitar entregas).
        remote.operationalPlanStatuses().forEach { (id, status) -> db.planDao().updateSyncedPlanStatus(id, status) }
        // Entregas existentes (web u otro tecnico) para calcular saldos pendientes correctos.
        remote.deliveries().forEach { db.planDao().upsertDelivery(it) }
        remote.deliveryItems().forEach { db.planDao().upsertDeliveryItem(it) }
    }

    // Fase 4: actividades (con su plan) que otra familia tiene en este dispositivo, para reasignar.
    suspend fun planActivitiesForFamily(familyId: String) = db.planDao().planActivitiesForFamily(familyId)

    // Reasigna un material a otra familia moviendolo a una actividad de esa familia.
    // Al cambiar la actividad, el material queda en el plan de la otra familia (y sale del actual);
    // compras e indicadores lo siguen solos en la web al sincronizar.
    suspend fun reassignMaterial(materialId: String, targetPlanActivityId: String) {
        val material = db.planDao().materialById(materialId) ?: error("No se encontro el material a reasignar.")
        db.planDao().updateMaterial(material.copy(planActivityId = targetPlanActivityId, syncState = SyncState.PENDING_SYNC))
    }

    // Descarta las entregas locales aun no sincronizadas de un plan (corrige capturas erroneas).
    suspend fun discardLocalDeliveries(planId: String) {
        db.planDao().deleteLocalDeliveryItemsForPlan(planId)
        db.planDao().deleteLocalDeliveriesForPlan(planId)
    }

    // Saldo pendiente de un material del plan: aprobado - ya entregado (local + descargado).
    suspend fun pendingQuantityForPlanMaterial(planProjectMaterialId: String, approvedQuantity: Double): Double {
        val delivered = db.planDao().deliveredQuantityForPlanMaterial(planProjectMaterialId)
        return (approvedQuantity - delivered).coerceAtLeast(0.0)
    }

    suspend fun registerDelivery(
        plan: OperationalPlanEntity,
        deliveryDate: String,
        observations: String?,
        familySignature: String?,
        technicianSignature: String?,
        lines: List<DeliveryLineInput>
    ): MaterialDeliveryEntity {
        require(lines.isNotEmpty()) { "Seleccione al menos un material a entregar." }
        require(lines.all { it.deliveredQuantity > 0 }) { "Las cantidades entregadas deben ser mayores que cero." }
        val deliveryId = UUID.randomUUID().toString()
        // Estado: total si todo el plan queda sin saldo tras esta entrega; parcial en caso contrario.
        var allComplete = true
        for (material in db.planDao().materialsForPlanOnce(plan.id)) {
            val alreadyDelivered = db.planDao().deliveredQuantityForPlanMaterial(material.id)
            val nowDelivered = lines.firstOrNull { it.planProjectMaterialId == material.id }?.deliveredQuantity ?: 0.0
            if (alreadyDelivered + nowDelivered + 0.0001 < material.quantity) {
                allComplete = false
                break
            }
        }
        val delivery = MaterialDeliveryEntity(
            id = deliveryId,
            projectId = plan.projectId,
            familyId = plan.familyId,
            operationalPlanId = plan.id,
            deliveryDate = deliveryDate,
            status = if (allComplete) "entregado_total" else "entregado_parcial",
            observations = observations,
            registeredBy = sessionStore.userId,
            familySignature = familySignature,
            technicianSignature = technicianSignature
        )
        db.planDao().upsertDelivery(delivery)
        for (line in lines) {
            db.planDao().upsertDeliveryItem(
                MaterialDeliveryItemEntity(
                    materialDeliveryId = deliveryId,
                    projectId = plan.projectId,
                    familyId = plan.familyId,
                    operationalPlanId = plan.id,
                    planActivityId = line.planActivityId,
                    activityId = line.activityId,
                    planProjectMaterialId = line.planProjectMaterialId,
                    materialId = line.materialId,
                    provisionalMaterialId = line.provisionalMaterialId,
                    materialName = line.materialName,
                    unit = line.unit,
                    approvedQuantity = line.approvedQuantity,
                    deliveredQuantity = line.deliveredQuantity,
                    observations = null
                )
            )
        }
        return delivery
    }

    suspend fun createDraftPlan(projectId: String, familyId: String): OperationalPlanEntity {
        db.planDao().editablePlanForFamily(familyId)?.let { return it }
        val maxVersion = db.planDao().maxVersionForFamily(familyId) ?: 0
        val plan = OperationalPlanEntity(
            projectId = projectId,
            familyId = familyId,
            technicianId = sessionStore.userId,
            planDate = LocalDate.now().toString(),
            version = maxVersion + 1
        )
        db.planDao().upsertPlan(plan)
        
        val oldPlan = db.planDao().latestPlanForFamily(familyId)
        if (oldPlan != null && oldPlan.id != plan.id) {
            val oldActivities = db.planDao().activitiesForPlan(oldPlan.id)
            for (oldAct in oldActivities) {
                val newAct = oldAct.copy(
                    id = java.util.UUID.randomUUID().toString(),
                    planId = plan.id,
                    syncState = SyncState.PENDING_SYNC
                )
                db.planDao().upsertActivity(newAct)
                
                val oldMaterials = db.planDao().materialsForActivity(oldAct.id)
                for (oldMat in oldMaterials) {
                    val newMatId = java.util.UUID.randomUUID().toString()
                    db.planDao().upsertMaterial(oldMat.copy(
                        id = newMatId,
                        planActivityId = newAct.id,
                        materialId = if (oldMat.materialId == oldMat.id) newMatId else oldMat.materialId,
                        syncState = SyncState.PENDING_SYNC
                    ))
                }
                
                val oldCounterparts = db.planDao().counterpartsForActivity(oldAct.id)
                for (oldCpt in oldCounterparts) {
                    db.planDao().upsertCounterpart(oldCpt.copy(
                        id = java.util.UUID.randomUUID().toString(),
                        planActivityId = newAct.id,
                        syncState = SyncState.PENDING_SYNC
                    ))
                }
            }
        }
        
        return plan
    }

    suspend fun addActivity(planId: String, activityId: String, unit: String, baseline: Double?, target: Double?): PlanActivityEntity {
        check(db.planDao().activityByCatalog(planId, activityId) == null) {
            "La actividad ya esta registrada en este plan."
        }
        val activity = PlanActivityEntity(
            planId = planId,
            activityId = activityId,
            baseline = baseline,
            target = target,
            unit = unit,
            observations = null
        )
        db.planDao().upsertActivity(activity)
        return activity
    }

    suspend fun markPlanPending(plan: OperationalPlanEntity) {
        db.planDao().updatePlan(plan.copy(syncState = SyncState.PENDING_SYNC, lastError = null))
    }

    suspend fun clearPlanSyncError(plan: OperationalPlanEntity) {
        db.planDao().updatePlan(plan.copy(syncState = SyncState.PENDING_SYNC, lastError = null))
    }

    suspend fun saveDraftOffline(plan: OperationalPlanEntity) {
        require(plan.status !in listOf("approved", "closed")) { "No se puede editar un plan aprobado o cerrado." }
        db.planDao().updatePlan(plan.copy(status = "draft", syncState = SyncState.PENDING_SYNC, lastError = null))
    }

    suspend fun markPlanPendingReview(plan: OperationalPlanEntity) {
        require(plan.status !in listOf("approved", "closed")) { "No se puede enviar a revision un plan aprobado o cerrado." }
        db.planDao().updatePlan(plan.copy(status = "pending_review", syncState = SyncState.PENDING_SYNC, lastError = null))
    }

    suspend fun updateActivity(item: PlanActivityEntity) {
        db.planDao().updateActivity(item.copy(syncState = SyncState.PENDING_SYNC))
    }

    suspend fun deletePlan(planId: String) {
        val activities = db.planDao().activitiesForPlan(planId)
        for (activity in activities) {
            db.planDao().deleteMaterialsForActivity(activity.id)
            db.planDao().deleteCounterpartsForActivity(activity.id)
            db.planDao().deleteActivity(activity.id)
        }
        db.planDao().deletePlan(planId)
    }

    suspend fun deleteActivity(item: PlanActivityEntity) {
        db.planDao().deleteMaterialsForActivity(item.id)
        db.planDao().deleteCounterpartsForActivity(item.id)
        db.planDao().deleteActivity(item.id)
    }

    suspend fun addProjectMaterial(activityId: String, materialId: String, quantity: Double, unit: String, quotedUnitPrice: Double) {
        require(quantity > 0) { "La cantidad del material debe ser mayor que cero." }
        db.planDao().upsertMaterial(
            PlanProjectMaterialEntity(
                planActivityId = activityId,
                materialId = materialId,
                provisionalName = null,
                quantity = quantity,
                unit = unit,
                quotedUnitPrice = quotedUnitPrice,
                observations = null
            )
        )
    }

    suspend fun addProvisionalProjectMaterial(
        activityId: String,
        provisionalName: String,
        suggestedUnit: String,
        quantity: Double,
        observation: String?
    ) {
        require(provisionalName.isNotBlank()) { "Ingrese el nombre sugerido del material." }
        require(suggestedUnit.isNotBlank()) { "Ingrese la unidad sugerida." }
        require(quantity > 0) { "La cantidad del material debe ser mayor que cero." }
        db.planDao().upsertMaterial(
            PlanProjectMaterialEntity(
                planActivityId = activityId,
                materialId = null,
                provisionalName = provisionalName,
                quantity = quantity,
                unit = suggestedUnit,
                quotedUnitPrice = 0.0,
                observations = observation
            )
        )
    }

    suspend fun updateProjectMaterial(item: PlanProjectMaterialEntity) {
        require(item.quantity > 0) { "La cantidad del material debe ser mayor que cero." }
        db.planDao().updateMaterial(item.copy(syncState = SyncState.PENDING_SYNC))
    }

    suspend fun deleteProjectMaterial(item: PlanProjectMaterialEntity) {
        db.planDao().deleteMaterial(item.id)
    }

    suspend fun addCounterpart(
        activityId: String,
        contributionType: String,
        name: String,
        quantity: Double,
        unit: String,
        unitValue: Double,
        vegetalIndicatorGroup: String?,
        observations: String?
    ) {
        require(name.isNotBlank()) { "Ingrese el aporte de la familia." }
        require(quantity > 0) { "La cantidad de contrapartida debe ser mayor que cero." }
        require(unitValue >= 0) { "El valor estimado no puede ser negativo." }
        db.planDao().upsertCounterpart(
            PlanFamilyCounterpartEntity(
                planActivityId = activityId,
                contributionType = contributionType,
                name = name,
                quantity = quantity,
                unit = unit,
                estimatedUnitValue = unitValue,
                vegetalIndicatorGroup = vegetalIndicatorGroup,
                observations = observations
            )
        )
    }

    suspend fun updateCounterpart(item: PlanFamilyCounterpartEntity) {
        require(item.name.isNotBlank()) { "Ingrese el aporte de la familia." }
        require(item.quantity > 0) { "La cantidad de contrapartida debe ser mayor que cero." }
        require(item.estimatedUnitValue >= 0) { "El valor estimado no puede ser negativo." }
        db.planDao().updateCounterpart(item.copy(syncState = SyncState.PENDING_SYNC))
    }

    suspend fun deleteCounterpart(item: PlanFamilyCounterpartEntity) {
        db.planDao().deleteCounterpart(item.id)
    }

    suspend fun syncPending() {
        val planDao = db.planDao()
        val errors = mutableListOf<String>()
        // Estados en el servidor: si un plan ya fue aprobado/cerrado en la web, NO se debe re-subir
        // con el estado local "draft" (eso pisaba la aprobacion y hacia rebotar las entregas).
        val serverStatuses = runCatching { remote.operationalPlanStatuses() }.getOrDefault(emptyMap())
        for (plan in planDao.pendingPlans()) {
            val serverStatus = serverStatuses[plan.id]
            if (serverStatus == "approved" || serverStatus == "aprobado" || serverStatus == "closed") {
                planDao.updatePlan(plan.copy(status = serverStatus, syncState = SyncState.SYNCED, lastError = null))
                continue
            }
            if (plan.status == "approved" || plan.status == "closed") continue
            var current = plan
            var uploaded = false
            var lastError: Exception? = null
            var attempts = 0
            // Ante un choque de version (project_id, family_id, version), sube la version y reintenta.
            while (!uploaded && attempts < 5) {
                try {
                    remote.uploadPlan(current)
                    uploaded = true
                } catch (error: Exception) {
                    lastError = error
                    if (isVersionConflict(error)) {
                        current = current.copy(version = current.version + 1)
                        planDao.updatePlan(current)
                        attempts++
                    } else {
                        break
                    }
                }
            }
            if (uploaded) {
                planDao.updatePlan(current.copy(syncState = SyncState.SYNCED, lastError = null))
            } else {
                planDao.updatePlan(current.copy(syncState = SyncState.ERROR, lastError = lastError?.message))
                errors += lastError?.message ?: "Error sincronizando plan."
            }
        }
        planDao.pendingActivities().forEach { item ->
            runCatching {
                remote.uploadActivity(item)
                planDao.updateActivity(item.copy(syncState = SyncState.SYNCED))
            }.onFailure {
                planDao.updateActivity(item.copy(syncState = SyncState.ERROR))
                errors += it.message ?: "Error sincronizando actividad."
            }
        }
        planDao.pendingMaterials().forEach { item ->
            runCatching {
                if (item.provisionalName != null) {
                    val activity = planDao.activityById(item.planActivityId) ?: error("No se encontro la actividad local del material.")
                    val plan = planDao.planById(activity.planId) ?: error("No se encontro el plan local del material.")
                    remote.uploadProvisionalMaterial(item, plan.projectId)
                }
                remote.uploadMaterial(item)
                planDao.updateMaterial(item.copy(syncState = SyncState.SYNCED))
            }.onFailure {
                planDao.updateMaterial(item.copy(syncState = SyncState.ERROR))
                errors += it.message ?: "Error sincronizando material."
            }
        }
        planDao.pendingCounterparts().forEach { item ->
            runCatching {
                remote.uploadCounterpart(item)
                planDao.updateCounterpart(item.copy(syncState = SyncState.SYNCED))
            }.onFailure {
                planDao.updateCounterpart(item.copy(syncState = SyncState.ERROR))
                errors += it.message ?: "Error sincronizando contrapartida."
            }
        }
        // Entregas primero (padre), luego sus items (respeta la llave foranea).
        val deliveriesJustSynced = mutableListOf<String>()
        planDao.pendingDeliveries().forEach { delivery ->
            runCatching {
                remote.uploadDelivery(delivery)
                planDao.updateDelivery(delivery.copy(syncState = SyncState.SYNCED, lastError = null))
                deliveriesJustSynced += delivery.id
            }.onFailure {
                planDao.updateDelivery(delivery.copy(syncState = SyncState.ERROR, lastError = it.message))
                errors += it.message ?: "Error sincronizando entrega."
            }
        }
        planDao.pendingDeliveryItems().forEach { item ->
            runCatching {
                remote.uploadDeliveryItem(item)
                planDao.updateDeliveryItem(item.copy(syncState = SyncState.SYNCED))
            }.onFailure {
                planDao.updateDeliveryItem(item.copy(syncState = SyncState.ERROR))
                errors += it.message ?: "Error sincronizando item de entrega."
            }
        }
        // Fase 3: con la entrega y sus items ya arriba, pedir el acta firmada.
        // Best-effort: si falla, la entrega ya quedo sincronizada y el acta se puede regenerar.
        deliveriesJustSynced.forEach { deliveryId ->
            runCatching { remote.requestActGeneration(deliveryId) }
        }
        if (errors.isNotEmpty()) {
            error(errors.distinct().joinToString(separator = "\n"))
        }
    }

    fun logout() = sessionStore.clear()
}

// Detecta el 409 de version duplicada (constraint operational_plans_one_active_version / codigo 23505).
private fun isVersionConflict(error: Throwable): Boolean {
    val message = error.message ?: return false
    return message.contains("operational_plans_one_active_version") ||
        (message.contains("23505") && message.contains("version", ignoreCase = true))
}

// Linea de entrega capturada en la UI (Fase 2).
data class DeliveryLineInput(
    val planProjectMaterialId: String,
    val planActivityId: String,
    val activityId: String?,
    val materialId: String?,
    val provisionalMaterialId: String?,
    val materialName: String,
    val unit: String,
    val approvedQuantity: Double,
    val deliveredQuantity: Double
)
