package com.restauracion.offline.data.remote

import com.restauracion.offline.data.SessionStore
import com.restauracion.offline.data.local.ActivityCatalogEntity
import com.restauracion.offline.data.local.CounterpartCatalogEntity
import com.restauracion.offline.data.local.FamilyEntity
import com.restauracion.offline.data.local.MaterialCatalogEntity
import com.restauracion.offline.data.local.MaterialDeliveryEntity
import com.restauracion.offline.data.local.MaterialDeliveryItemEntity
import com.restauracion.offline.data.local.MunicipalityEntity
import com.restauracion.offline.data.local.OperationalPlanEntity
import com.restauracion.offline.data.local.PlanActivityEntity
import com.restauracion.offline.data.local.PlanFamilyCounterpartEntity
import com.restauracion.offline.data.local.PlanProjectMaterialEntity
import com.restauracion.offline.data.local.PropertyEntity
import com.restauracion.offline.data.local.ProjectEntity
import com.restauracion.offline.data.local.SyncState
import com.restauracion.offline.data.local.VillageEntity
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.ClientRequestException
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class SupabaseRestClient(
    baseUrl: String,
    private val anonKey: String,
    private val sessionStore: SessionStore,
    webAppUrl: String = ""
) {
    private val baseUrl = baseUrl.trim().trimEnd('/')
    private val webAppUrl = webAppUrl.trim().trimEnd('/')
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }
    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) { json(json) }
        expectSuccess = true
    }
    // Serializa la renovacion de sesion: evita que varias peticiones renueven a la vez
    // con el mismo refresh token (Supabase los rota, y el segundo uso da 'refresh_token_already_used').
    private val refreshMutex = Mutex()

    suspend fun login(email: String, password: String) {
        requireConfigured()
        val response: AuthResponse = client.post("$baseUrl/auth/v1/token?grant_type=password") {
            header("apikey", anonKey)
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(AuthRequest(email = email, password = password)))
        }.body()
        sessionStore.accessToken = response.accessToken
        sessionStore.refreshToken = response.refreshToken
        sessionStore.userId = response.user.id
    }

    private suspend fun <T> withAuth(block: suspend () -> T): T {
        return try {
            block()
        } catch (e: ClientRequestException) {
            if (e.response.status.value == 401 && sessionStore.refreshToken != null) {
                val tokenBeforeRefresh = sessionStore.accessToken
                refreshMutex.withLock {
                    // Si otra corrutina ya renovo la sesion mientras esperabamos el lock,
                    // no renovar de nuevo (evita el 'refresh_token_already_used'): usar el token nuevo.
                    if (sessionStore.accessToken == tokenBeforeRefresh) {
                        try {
                            val refreshToken = sessionStore.refreshToken ?: throw Exception("No refresh token")
                            val refreshResponse: AuthResponse = client.post("$baseUrl/auth/v1/token?grant_type=refresh_token") {
                                header("apikey", anonKey)
                                contentType(ContentType.Application.Json)
                                setBody(json.encodeToString(RefreshTokenRequest(refreshToken)))
                            }.body()
                            sessionStore.accessToken = refreshResponse.accessToken
                            sessionStore.refreshToken = refreshResponse.refreshToken
                            sessionStore.userId = refreshResponse.user.id
                        } catch (refreshErr: Exception) {
                            throw Exception("Fallo al renovar sesion: ${refreshErr.message}", e)
                        }
                    }
                }
                block()
            } else {
                throw e
            }
        }
    }

    suspend fun projects(): List<ProjectEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/projects?select=id,name,code_prefix,status&is_deleted=eq.false") {
        authHeaders()
        }.body<List<ProjectDto>>().map { it.toEntity() }
    }

    suspend fun families(): List<FamilyEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/families?select=id,project_id,family_code,representative_name,document_number,municipality_id,village_id,status&is_deleted=eq.false") {
        authHeaders()
        }.body<List<FamilyDto>>().map { it.toEntity() }
    }

    suspend fun municipalities(): List<MunicipalityEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/municipalities?select=id,name") {
        authHeaders()
        }.body<List<MunicipalityDto>>().map { it.toEntity() }
    }

    suspend fun villages(): List<VillageEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/villages?select=id,municipality_id,name") {
        authHeaders()
        }.body<List<VillageDto>>().map { it.toEntity() }
    }

    suspend fun properties(): List<PropertyEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/properties?select=id,family_id,property_name,total_area_ha&is_deleted=eq.false") {
        authHeaders()
        }.body<List<PropertyDto>>().map { it.toEntity() }
    }

    suspend fun activities(): List<ActivityCatalogEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/activity_catalog?select=id,project_id,name,unit,requires_baseline,requires_target,active&is_deleted=eq.false") {
        authHeaders()
        }.body<List<ActivityDto>>().map { it.toEntity() }
    }

    suspend fun materials(): List<MaterialCatalogEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/material_catalog?select=id,project_id,name,category,unit,quoted_unit_price,vegetal_indicator_group,active&is_deleted=eq.false") {
        authHeaders()
        }.body<List<MaterialDto>>().map { it.toEntity() }
    }

    suspend fun counterpartCatalog(): List<CounterpartCatalogEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/counterpart_catalog?select=id,project_id,name,type,suggested_unit,active&is_deleted=eq.false") {
        authHeaders()
        }.body<List<CounterpartDto>>().map { it.toEntity() }
    }

    private suspend fun resolveProfileId(idOrEmail: String): String = withAuth {
        // technician_id referencia users_profiles.id, no auth.users.id:
        // hay que traducir el id de sesion (auth_user_id) al id del perfil.
        val filter = if (idOrEmail.contains("@")) "email=eq.$idOrEmail" else "auth_user_id=eq.$idOrEmail"
        val results = client.get("$baseUrl/rest/v1/users_profiles?$filter&select=id") {
            authHeaders()
        }.body<List<UserProfileDto>>()
        results.firstOrNull()?.id ?: idOrEmail
    }

    suspend fun uploadPlan(plan: OperationalPlanEntity) = withAuth {
        requireConfigured()
        val technicianId = resolveProfileId(plan.technicianId ?: sessionStore.userId ?: "")
        client.post("$baseUrl/rest/v1/operational_plans") {
            authHeaders()
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            val payload = PlanUploadDto(
                    id = plan.id,
                    projectId = plan.projectId,
                    familyId = plan.familyId,
                    technicianId = technicianId,
                    planDate = plan.planDate,
                    status = plan.status,
                    version = plan.version,
                    syncStatus = "synced"
                )
            setBody(json.encodeToString(payload))
        }
    }

    suspend fun uploadActivity(item: PlanActivityEntity) = withAuth {
        requireConfigured()
        client.post("$baseUrl/rest/v1/plan_activities") {
            authHeaders()
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            val payload = PlanActivityUploadDto(
                    id = item.id,
                    planId = item.planId,
                    activityId = item.activityId,
                    baseline = item.baseline,
                    target = item.target,
                    unit = item.unit,
                    observations = item.observations
                )
            setBody(json.encodeToString(payload))
        }
    }

    suspend fun uploadMaterial(item: PlanProjectMaterialEntity) = withAuth {
        requireConfigured()
        client.post("$baseUrl/rest/v1/plan_project_materials") {
            authHeaders()
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            val payload = PlanProjectMaterialUploadDto(
                    id = item.id,
                    planActivityId = item.planActivityId,
                    materialId = item.materialId,
                    provisionalMaterialId = if (item.materialId == null) item.id else null,
                    quantity = item.quantity,
                    unit = item.unit,
                    quotedUnitPrice = item.quotedUnitPrice,
                    observations = item.observations
                )
            setBody(json.encodeToString(payload))
        }
    }

    suspend fun uploadProvisionalMaterial(item: PlanProjectMaterialEntity, projectId: String) = withAuth {
        requireConfigured()
        val name = item.provisionalName ?: error("No hay nombre provisional.")
        client.post("$baseUrl/rest/v1/material_catalog") {
            authHeaders()
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            val payload = MaterialCatalogProvisionalUploadDto(
                    id = item.materialId ?: error("Falta UUID para el material provisional"),
                    projectId = projectId,
                    name = name,
                    category = "Insumos",
                    unit = item.unit,
                    quotedUnitPrice = 0.0,
                    active = true,
                    isDeleted = false
                )
            setBody(json.encodeToString(payload))
        }
    }

    suspend fun uploadCounterpart(item: PlanFamilyCounterpartEntity) = withAuth {
        requireConfigured()
        client.post("$baseUrl/rest/v1/plan_family_counterparts") {
            authHeaders()
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            val payload = PlanFamilyCounterpartUploadDto(
                    id = item.id,
                    planActivityId = item.planActivityId,
                    contributionType = if (item.contributionType == "materiales_propios") "material_propio" else item.contributionType,
                    name = item.name,
                    quantity = item.quantity,
                    unit = item.unit,
                    estimatedUnitValue = item.estimatedUnitValue,
                    vegetalIndicatorGroup = item.vegetalIndicatorGroup,
                    observations = item.observations
                )
            setBody(json.encodeToString(payload))
        }
    }

    // Estado (aprobado, etc.) de los planes en el servidor, para reflejarlo en la app.
    suspend fun operationalPlanStatuses(): Map<String, String> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/operational_plans?select=id,status&is_deleted=eq.false") {
            authHeaders()
        }.body<List<PlanStatusDto>>().associate { it.id to it.status }
    }

    // Fase 4: materiales de todos los planes del proyecto. Sirven para (a) tener los materiales de
    // otras familias como referencia al reasignar (detectar y fusionar duplicados) y (b) reflejar en
    // la app las reasignaciones/fusiones hechas desde la web (actividad, cantidad, borrado).
    suspend fun planProjectMaterials(): List<PlanProjectMaterialEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/plan_project_materials?select=id,plan_activity_id,material_id,quantity,unit,quoted_unit_price,observations&is_deleted=eq.false") {
            authHeaders()
        }.body<List<PlanMaterialSyncDto>>().map { it.toEntity() }
    }

    // Fase 4: marca un material como eliminado en el servidor (al fusionar una reasignacion,
    // la fila movida se elimina y su cantidad queda sumada en el material destino).
    suspend fun softDeleteMaterial(id: String) = withAuth {
        requireConfigured()
        client.patch("$baseUrl/rest/v1/plan_project_materials?id=eq.$id") {
            authHeaders()
            contentType(ContentType.Application.Json)
            setBody("{\"is_deleted\":true}")
        }
    }

    // Fase 4: planes y actividades de otras familias del proyecto, para poder elegirlas como
    // destino de una reasignacion desde el campo. Se insertan sin pisar los planes locales.
    suspend fun operationalPlans(): List<OperationalPlanEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/operational_plans?select=id,project_id,family_id,technician_id,plan_date,status,version&is_deleted=eq.false") {
            authHeaders()
        }.body<List<PlanRowDto>>().map { it.toEntity() }
    }

    suspend fun planActivities(): List<PlanActivityEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/plan_activities?select=id,plan_id,activity_id,baseline,target,unit,observations&is_deleted=eq.false") {
            authHeaders()
        }.body<List<PlanActivityRowDto>>().map { it.toEntity() }
    }

    // Fase 3: pide al aplicativo web que genere el acta firmada de una entrega ya subida
    // (con sus items). Es best-effort: si no hay URL configurada, no hace nada.
    suspend fun requestActGeneration(deliveryId: String) {
        if (webAppUrl.isBlank()) return
        client.post("$webAppUrl/api/generate-act") {
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(GenerateActRequest(deliveryId)))
        }
    }

    // --- Entregas (Fase 2) ---

    suspend fun deliveries(): List<MaterialDeliveryEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/material_deliveries?select=id,project_id,family_id,operational_plan_id,delivery_date,status,observations,registered_by,family_signature,technician_signature&is_deleted=eq.false") {
            authHeaders()
        }.body<List<MaterialDeliveryDto>>().map { it.toEntity() }
    }

    suspend fun deliveryItems(): List<MaterialDeliveryItemEntity> = withAuth {
        requireConfigured()
        client.get("$baseUrl/rest/v1/material_delivery_items?select=id,material_delivery_id,project_id,family_id,operational_plan_id,plan_activity_id,activity_id,plan_project_material_id,material_id,provisional_material_id,material_name,unit,approved_quantity,delivered_quantity,observations&is_deleted=eq.false") {
            authHeaders()
        }.body<List<MaterialDeliveryItemDto>>().map { it.toEntity() }
    }

    suspend fun uploadDelivery(item: MaterialDeliveryEntity) = withAuth {
        requireConfigured()
        val registeredBy = resolveProfileId(item.registeredBy ?: sessionStore.userId ?: "")
        client.post("$baseUrl/rest/v1/material_deliveries") {
            authHeaders()
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            val payload = MaterialDeliveryUploadDto(
                    id = item.id,
                    projectId = item.projectId,
                    familyId = item.familyId,
                    operationalPlanId = item.operationalPlanId,
                    deliveryDate = item.deliveryDate,
                    status = item.status,
                    observations = item.observations,
                    registeredBy = registeredBy,
                    familySignature = item.familySignature,
                    technicianSignature = item.technicianSignature
                )
            setBody(json.encodeToString(payload))
        }
    }

    suspend fun uploadDeliveryItem(item: MaterialDeliveryItemEntity) = withAuth {
        requireConfigured()
        client.post("$baseUrl/rest/v1/material_delivery_items") {
            authHeaders()
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            val payload = MaterialDeliveryItemUploadDto(
                    id = item.id,
                    materialDeliveryId = item.materialDeliveryId,
                    projectId = item.projectId,
                    familyId = item.familyId,
                    operationalPlanId = item.operationalPlanId,
                    planActivityId = item.planActivityId,
                    activityId = item.activityId,
                    planProjectMaterialId = item.planProjectMaterialId,
                    materialId = item.materialId,
                    provisionalMaterialId = item.provisionalMaterialId,
                    materialName = item.materialName,
                    unit = item.unit,
                    approvedQuantity = item.approvedQuantity,
                    deliveredQuantity = item.deliveredQuantity,
                    observations = item.observations
                )
            setBody(json.encodeToString(payload))
        }
    }

    private fun io.ktor.client.request.HttpRequestBuilder.authHeaders() {
        header("apikey", anonKey)
        sessionStore.accessToken?.let { bearerAuth(it) }
    }

    private fun requireConfigured() {
        require(baseUrl.startsWith("https://") && !baseUrl.contains("localhost")) {
            "SUPABASE_URL no esta configurada correctamente. Use https://xvmgmsexzibdqptmvzdn.supabase.co"
        }
        require(anonKey.isNotBlank() && anonKey.startsWith("eyJ")) {
            "SUPABASE_ANON_KEY no esta configurada. Use la Legacy anon key de Supabase, no la sb_publishable_."
        }
    }
}

@Serializable private data class AuthResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String? = null,
    val user: AuthUser
)
@Serializable private data class AuthUser(val id: String)
@Serializable private data class AuthRequest(val email: String, val password: String)
@Serializable private data class RefreshTokenRequest(@SerialName("refresh_token") val refreshToken: String)

@Serializable
private data class PlanUploadDto(
    val id: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("family_id") val familyId: String,
    @SerialName("technician_id") val technicianId: String?,
    @SerialName("plan_date") val planDate: String,
    val status: String,
    val version: Int,
    @SerialName("sync_status") val syncStatus: String,
    @SerialName("is_deleted") val isDeleted: Boolean = false
)

@Serializable
private data class PlanActivityUploadDto(
    val id: String,
    @SerialName("plan_id") val planId: String,
    @SerialName("activity_id") val activityId: String,
    val baseline: Double?,
    val target: Double?,
    val unit: String,
    val observations: String?,
    @SerialName("is_deleted") val isDeleted: Boolean = false
)

@Serializable
private data class PlanProjectMaterialUploadDto(
    val id: String,
    @SerialName("plan_activity_id") val planActivityId: String,
    @SerialName("material_id") val materialId: String?,
    @SerialName("provisional_material_id") val provisionalMaterialId: String?,
    val quantity: Double,
    val unit: String,
    @SerialName("quoted_unit_price") val quotedUnitPrice: Double,
    val observations: String?,
    @SerialName("is_deleted") val isDeleted: Boolean = false
)

@Serializable
private data class ProvisionalMaterialUploadDto(
    val id: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("provisional_name") val provisionalName: String,
    @SerialName("suggested_unit") val suggestedUnit: String,
    val observation: String?,
    @SerialName("contribution_side") val contributionSide: String,
    val status: String,
    @SerialName("is_deleted") val isDeleted: Boolean = false
)

@Serializable
private data class MaterialCatalogProvisionalUploadDto(
    val id: String,
    @SerialName("project_id") val projectId: String,
    val name: String,
    val category: String,
    val unit: String,
    @SerialName("quoted_unit_price") val quotedUnitPrice: Double,
    val active: Boolean = true,
    @SerialName("is_deleted") val isDeleted: Boolean = false
)

@Serializable
private data class PlanFamilyCounterpartUploadDto(
    val id: String,
    @SerialName("plan_activity_id") val planActivityId: String,
    @SerialName("contribution_type") val contributionType: String,
    val name: String,
    val quantity: Double,
    val unit: String,
    @SerialName("estimated_unit_value") val estimatedUnitValue: Double,
    @SerialName("vegetal_indicator_group") val vegetalIndicatorGroup: String? = null,
    val observations: String? = null,
    @SerialName("is_deleted") val isDeleted: Boolean = false
)

@Serializable
private data class MaterialDeliveryUploadDto(
    val id: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("family_id") val familyId: String,
    @SerialName("operational_plan_id") val operationalPlanId: String,
    @SerialName("delivery_date") val deliveryDate: String,
    val status: String,
    val observations: String?,
    @SerialName("registered_by") val registeredBy: String?,
    @SerialName("family_signature") val familySignature: String?,
    @SerialName("technician_signature") val technicianSignature: String?,
    @SerialName("is_deleted") val isDeleted: Boolean = false
)

@Serializable
private data class MaterialDeliveryItemUploadDto(
    val id: String,
    @SerialName("material_delivery_id") val materialDeliveryId: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("family_id") val familyId: String,
    @SerialName("operational_plan_id") val operationalPlanId: String,
    @SerialName("plan_activity_id") val planActivityId: String,
    @SerialName("activity_id") val activityId: String?,
    @SerialName("plan_project_material_id") val planProjectMaterialId: String,
    @SerialName("material_id") val materialId: String?,
    @SerialName("provisional_material_id") val provisionalMaterialId: String?,
    @SerialName("material_name") val materialName: String,
    val unit: String,
    @SerialName("approved_quantity") val approvedQuantity: Double,
    @SerialName("delivered_quantity") val deliveredQuantity: Double,
    val observations: String?,
    @SerialName("is_deleted") val isDeleted: Boolean = false
)

@Serializable private data class GenerateActRequest(val deliveryId: String)

@Serializable private data class PlanStatusDto(val id: String, val status: String)

@Serializable private data class PlanMaterialSyncDto(
    val id: String,
    @SerialName("plan_activity_id") val planActivityId: String,
    @SerialName("material_id") val materialId: String? = null,
    val quantity: Double,
    val unit: String,
    @SerialName("quoted_unit_price") val quotedUnitPrice: Double = 0.0,
    val observations: String? = null
) {
    fun toEntity() = PlanProjectMaterialEntity(
        id = id,
        planActivityId = planActivityId,
        materialId = materialId,
        provisionalName = null,
        quantity = quantity,
        unit = unit,
        quotedUnitPrice = quotedUnitPrice,
        observations = observations,
        syncState = SyncState.SYNCED
    )
}

@Serializable private data class PlanRowDto(
    val id: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("family_id") val familyId: String,
    @SerialName("technician_id") val technicianId: String? = null,
    @SerialName("plan_date") val planDate: String,
    val status: String,
    val version: Int = 1
) {
    fun toEntity() = OperationalPlanEntity(
        id = id,
        projectId = projectId,
        familyId = familyId,
        technicianId = technicianId,
        planDate = planDate,
        status = status,
        version = version,
        syncState = SyncState.SYNCED,
        lastError = null
    )
}

@Serializable private data class PlanActivityRowDto(
    val id: String,
    @SerialName("plan_id") val planId: String,
    @SerialName("activity_id") val activityId: String,
    val baseline: Double? = null,
    val target: Double? = null,
    val unit: String,
    val observations: String? = null
) {
    fun toEntity() = PlanActivityEntity(
        id = id,
        planId = planId,
        activityId = activityId,
        baseline = baseline,
        target = target,
        unit = unit,
        observations = observations,
        syncState = SyncState.SYNCED
    )
}

@Serializable private data class MaterialDeliveryDto(
    val id: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("family_id") val familyId: String,
    @SerialName("operational_plan_id") val operationalPlanId: String,
    @SerialName("delivery_date") val deliveryDate: String,
    val status: String,
    val observations: String? = null,
    @SerialName("registered_by") val registeredBy: String? = null,
    @SerialName("family_signature") val familySignature: String? = null,
    @SerialName("technician_signature") val technicianSignature: String? = null
) {
    fun toEntity() = MaterialDeliveryEntity(
        id = id,
        projectId = projectId,
        familyId = familyId,
        operationalPlanId = operationalPlanId,
        deliveryDate = deliveryDate,
        status = status,
        observations = observations,
        registeredBy = registeredBy,
        familySignature = familySignature,
        technicianSignature = technicianSignature,
        syncState = SyncState.SYNCED,
        lastError = null
    )
}

@Serializable private data class MaterialDeliveryItemDto(
    val id: String,
    @SerialName("material_delivery_id") val materialDeliveryId: String,
    @SerialName("project_id") val projectId: String,
    @SerialName("family_id") val familyId: String,
    @SerialName("operational_plan_id") val operationalPlanId: String,
    @SerialName("plan_activity_id") val planActivityId: String,
    @SerialName("activity_id") val activityId: String? = null,
    @SerialName("plan_project_material_id") val planProjectMaterialId: String,
    @SerialName("material_id") val materialId: String? = null,
    @SerialName("provisional_material_id") val provisionalMaterialId: String? = null,
    @SerialName("material_name") val materialName: String,
    val unit: String,
    @SerialName("approved_quantity") val approvedQuantity: Double = 0.0,
    @SerialName("delivered_quantity") val deliveredQuantity: Double,
    val observations: String? = null
) {
    fun toEntity() = MaterialDeliveryItemEntity(
        id = id,
        materialDeliveryId = materialDeliveryId,
        projectId = projectId,
        familyId = familyId,
        operationalPlanId = operationalPlanId,
        planActivityId = planActivityId,
        activityId = activityId,
        planProjectMaterialId = planProjectMaterialId,
        materialId = materialId,
        provisionalMaterialId = provisionalMaterialId,
        materialName = materialName,
        unit = unit,
        approvedQuantity = approvedQuantity,
        deliveredQuantity = deliveredQuantity,
        observations = observations,
        syncState = SyncState.SYNCED
    )
}

@Serializable private data class ProjectDto(
    val id: String,
    val name: String? = null,
    @SerialName("code_prefix") val codePrefix: String? = null,
    val status: String? = null
) {
    fun toEntity() = ProjectEntity(id, name ?: "Sin nombre", codePrefix ?: "", status ?: "activo")
}

@Serializable private data class FamilyDto(
    val id: String,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("family_code") val familyCode: String? = null,
    @SerialName("representative_name") val representativeName: String? = null,
    @SerialName("document_number") val documentNumber: String? = null,
    @SerialName("municipality_id") val municipalityId: String? = null,
    @SerialName("village_id") val villageId: String? = null,
    val status: String? = null
) {
    fun toEntity() = FamilyEntity(
        id = id,
        projectId = projectId ?: "",
        familyCode = familyCode ?: "",
        representativeName = representativeName ?: "Sin nombre",
        documentNumber = documentNumber,
        municipalityId = municipalityId,
        villageId = villageId,
        status = status ?: "activo"
    )
}

@Serializable private data class MunicipalityDto(val id: String, val name: String? = null) {
    fun toEntity() = MunicipalityEntity(id, name ?: "Sin nombre")
}

@Serializable private data class VillageDto(
    val id: String,
    @SerialName("municipality_id") val municipalityId: String? = null,
    val name: String? = null
) {
    fun toEntity() = VillageEntity(id, municipalityId ?: "", name ?: "Sin nombre")
}

@Serializable private data class PropertyDto(
    val id: String,
    @SerialName("family_id") val familyId: String? = null,
    @SerialName("property_name") val propertyName: String? = null,
    @SerialName("total_area_ha") val totalAreaHa: Double? = null
) {
    fun toEntity() = PropertyEntity(id, familyId ?: "", propertyName, totalAreaHa)
}

@Serializable private data class ActivityDto(
    val id: String,
    @SerialName("project_id") val projectId: String? = null,
    val name: String? = null,
    val unit: String? = null,
    @SerialName("requires_baseline") val requiresBaseline: Boolean? = null,
    @SerialName("requires_target") val requiresTarget: Boolean? = null,
    val active: Boolean? = null
) {
    fun toEntity() = ActivityCatalogEntity(
        id = id,
        projectId = projectId,
        name = name ?: "Sin nombre",
        unit = unit ?: "UND",
        requiresBaseline = requiresBaseline ?: false,
        requiresTarget = requiresTarget ?: false,
        active = active ?: true
    )
}

@Serializable private data class MaterialDto(
    val id: String,
    @SerialName("project_id") val projectId: String? = null,
    val name: String? = null,
    val category: String? = null,
    val unit: String? = null,
    @SerialName("quoted_unit_price") val quotedUnitPrice: Double? = null,
    @SerialName("vegetal_indicator_group") val vegetalIndicatorGroup: String? = null,
    val active: Boolean? = null
) {
    fun toEntity() = MaterialCatalogEntity(
        id = id,
        projectId = projectId,
        name = name ?: "Sin nombre",
        category = category,
        unit = unit ?: "UND",
        quotedUnitPrice = quotedUnitPrice ?: 0.0,
        vegetalIndicatorGroup = vegetalIndicatorGroup,
        active = active ?: true
    )
}

@Serializable private data class CounterpartDto(
    val id: String,
    @SerialName("project_id") val projectId: String? = null,
    val name: String? = null,
    @SerialName("type") val contributionType: String? = null,
    @SerialName("suggested_unit") val suggestedUnit: String? = null,
    val active: Boolean? = null
) {
    fun toEntity() = CounterpartCatalogEntity(
        id = id,
        projectId = projectId,
        name = name ?: "Sin nombre",
        contributionType = if (contributionType == "material_propio") "materiales_propios" else (contributionType ?: "mano_obra"),
        suggestedUnit = suggestedUnit.orEmpty(),
        active = active ?: true
    )
}

@Serializable
private data class UserProfileDto(val id: String)
