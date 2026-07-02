package com.restauracion.offline.data.remote

import com.restauracion.offline.data.SessionStore
import com.restauracion.offline.data.local.ActivityCatalogEntity
import com.restauracion.offline.data.local.CounterpartCatalogEntity
import com.restauracion.offline.data.local.FamilyEntity
import com.restauracion.offline.data.local.MaterialCatalogEntity
import com.restauracion.offline.data.local.MunicipalityEntity
import com.restauracion.offline.data.local.OperationalPlanEntity
import com.restauracion.offline.data.local.PlanActivityEntity
import com.restauracion.offline.data.local.PlanFamilyCounterpartEntity
import com.restauracion.offline.data.local.PlanProjectMaterialEntity
import com.restauracion.offline.data.local.PropertyEntity
import com.restauracion.offline.data.local.ProjectEntity
import com.restauracion.offline.data.local.VillageEntity
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.ClientRequestException
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class SupabaseRestClient(
    baseUrl: String,
    private val anonKey: String,
    private val sessionStore: SessionStore
) {
    private val baseUrl = baseUrl.trim().trimEnd('/')
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }
    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) { json(json) }
        expectSuccess = true
    }

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
                try {
                    val refreshResponse: AuthResponse = client.post("$baseUrl/auth/v1/token?grant_type=refresh_token") {
                        header("apikey", anonKey)
                        contentType(ContentType.Application.Json)
                        setBody(json.encodeToString(mapOf("refresh_token" to sessionStore.refreshToken)))
                    }.body()
                    sessionStore.accessToken = refreshResponse.accessToken
                    sessionStore.refreshToken = refreshResponse.refreshToken
                    sessionStore.userId = refreshResponse.user.id
                    block()
                } catch (refreshErr: Exception) {
                    throw e // if refresh fails, throw original 401
                }
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
        if (!idOrEmail.contains("@")) return@withAuth idOrEmail
        val results = client.get("$baseUrl/rest/v1/profiles?email=eq.$idOrEmail&select=id") {
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
