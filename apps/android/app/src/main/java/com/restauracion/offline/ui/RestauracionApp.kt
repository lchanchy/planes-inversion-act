package com.restauracion.offline.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.Dp
import com.restauracion.offline.R
import com.restauracion.offline.data.AppContainer
import com.restauracion.offline.data.local.ActivityCatalogEntity
import com.restauracion.offline.data.local.CounterpartCatalogEntity
import com.restauracion.offline.data.local.FamilyEntity
import com.restauracion.offline.data.local.MaterialCatalogEntity
import com.restauracion.offline.data.local.OperationalPlanEntity
import com.restauracion.offline.data.local.PlanActivityEntity
import com.restauracion.offline.data.local.PlanFamilyCounterpartEntity
import com.restauracion.offline.data.local.PlanProjectMaterialEntity
import com.restauracion.offline.data.local.ProjectEntity
import kotlinx.coroutines.launch

private enum class Screen { LOGIN, HOME, FAMILY, PLAN }

private val BrandDark = Color(0xFF145F3B)
private val BrandPrimary = Color(0xFF1F7A4F)
private val MintSoft = Color(0xFFDCEFE3)
private val BackgroundGradientStart = Color(0xFFA4CBB3)
private val BackgroundGradientEnd = Color(0xFFDCEFE3)
private val TextDark = Color(0xFF0F172A)
private val ErrorRed = Color(0xFFB42318)
private val GlassBorder = Color.White.copy(alpha = 0.4f)

private val PlanesColorScheme = lightColorScheme(
    primary = BrandPrimary,
    onPrimary = Color.White,
    secondary = BrandDark,
    onSecondary = Color.White,
    background = Color.Transparent, // El fondo principal será el Box con burbujas
    onBackground = TextDark,
    surface = Color.Transparent, // Las tarjetas usarán glassmorphism
    onSurface = TextDark,
    surfaceVariant = Color.White.copy(alpha = 0.1f),
    onSurfaceVariant = TextDark,
    error = ErrorRed,
    onError = Color.White
)

private val AppCardShape = RoundedCornerShape(16.dp)

fun Modifier.glassmorphism(cornerRadius: Dp = 16.dp): Modifier = this
    .shadow(
        elevation = 8.dp,
        shape = RoundedCornerShape(cornerRadius),
        spotColor = BrandDark.copy(alpha = 0.2f),
        ambientColor = BrandDark.copy(alpha = 0.1f)
    )
    .background(
        brush = androidx.compose.ui.graphics.Brush.linearGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.6f),
                Color.White.copy(alpha = 0.2f)
            )
        ),
        shape = RoundedCornerShape(cornerRadius)
    )
    .border(
        width = 1.dp,
        brush = androidx.compose.ui.graphics.Brush.verticalGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.9f),
                Color.White.copy(alpha = 0.2f),
                Color.White.copy(alpha = 0.5f)
            )
        ),
        shape = RoundedCornerShape(cornerRadius)
    )

@Composable
fun RestauracionApp(container: AppContainer) {
    val scope = rememberCoroutineScope()
    val initialScreen = remember {
        val savedScreen = runCatching { Screen.valueOf(container.repository.lastScreen().orEmpty()) }.getOrNull()
        when {
            savedScreen != null && savedScreen != Screen.LOGIN -> savedScreen
            container.repository.hasSession() -> Screen.HOME
            else -> Screen.LOGIN
        }
    }
    var screenName by rememberSaveable { mutableStateOf(initialScreen.name) }
    val screen = runCatching { Screen.valueOf(screenName) }.getOrDefault(Screen.HOME)
    var message by remember { mutableStateOf<String?>(null) }
    var selectedProjectId by rememberSaveable { mutableStateOf(container.repository.lastProjectId()) }
    var selectedFamilyId by rememberSaveable { mutableStateOf(container.repository.lastFamilyId()) }
    var selectedPlanId by rememberSaveable { mutableStateOf(container.repository.lastPlanId()) }
    val projects by container.repository.projects.collectAsState(initial = emptyList())
    val selectedProject = projects.firstOrNull { it.id == selectedProjectId }
    val familiesForSelectedProject by container.repository.families(selectedProjectId.orEmpty()).collectAsState(initial = emptyList())
    val selectedFamily = familiesForSelectedProject.firstOrNull { it.id == selectedFamilyId }
    val selectedPlanState by container.repository.plan(selectedPlanId.orEmpty()).collectAsState(initial = null)
    val selectedPlan = selectedPlanState

    MaterialTheme(colorScheme = PlanesColorScheme) {
        LaunchedEffect(screenName, selectedProjectId, selectedFamilyId, selectedPlanId) {
            container.repository.saveNavigationState(screenName, selectedProjectId, selectedFamilyId, selectedPlanId)
        }
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = androidx.compose.ui.graphics.Brush.linearGradient(
                        colors = listOf(BackgroundGradientStart, BackgroundGradientEnd)
                    )
                )
        ) {
            androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
                drawCircle(
                    color = BrandPrimary.copy(alpha = 0.08f),
                    radius = size.width * 0.7f,
                    center = androidx.compose.ui.geometry.Offset(size.width, 0f)
                )
                drawCircle(
                    color = BrandDark.copy(alpha = 0.08f),
                    radius = size.width * 0.5f,
                    center = androidx.compose.ui.geometry.Offset(0f, size.height)
                )
            }
            when (screen) {
                Screen.LOGIN -> LoginScreen(
                    message = message,
                    onLogin = { email, password ->
                        scope.launch {
                            runCatching {
                                container.repository.login(email, password)
                                container.repository.downloadInitialData()
                            }.onSuccess {
                                message = "Datos iniciales descargados."
                                selectedProjectId = null
                                selectedFamilyId = null
                                selectedPlanId = null
                                screenName = Screen.HOME.name
                            }.onFailure {
                                message = it.message ?: "No fue posible iniciar sesion."
                            }
                        }
                    },
                    onOffline = { screenName = Screen.HOME.name }
                )

                Screen.HOME -> HomeScreen(
                    container = container,
                    message = message,
                    onDownload = {
                        scope.launch {
                            runCatching { container.repository.downloadInitialData() }
                                .onSuccess { message = "Catalogos actualizados." }
                                .onFailure { message = it.message ?: "Error descargando datos." }
                        }
                    },
                    onSync = {
                        scope.launch {
                            runCatching { container.repository.syncPending() }
                                .onSuccess { message = "Sincronizacion enviada." }
                                .onFailure { message = it.message ?: "Error sincronizando." }
                        }
                    },
                    onLogout = {
                        scope.launch {
                            container.sessionStore.clearSession()
                            screenName = Screen.LOGIN.name
                        }
                    },
                    onOpenProject = {
                        selectedProjectId = it.id
                        selectedFamilyId = null
                        selectedPlanId = null
                        screenName = Screen.FAMILY.name
                    }
                )

                Screen.FAMILY -> {
                    if (selectedProject == null) {
                        RestoringStateScreen(
                            onBackHome = {
                                selectedProjectId = null
                                selectedFamilyId = null
                                selectedPlanId = null
                                screenName = Screen.HOME.name
                            }
                        )
                    } else {
                        FamilyScreen(
                            container = container,
                            project = selectedProject,
                            onBack = {
                                selectedProjectId = null
                                selectedFamilyId = null
                                selectedPlanId = null
                                screenName = Screen.HOME.name
                            },
                            onCreatePlan = { family ->
                                scope.launch {
                                    val project = selectedProject ?: return@launch
                                    val plan = container.repository.createDraftPlan(project.id, family.id)
                                    selectedFamilyId = family.id
                                    selectedPlanId = plan.id
                                    screenName = Screen.PLAN.name
                                }
                            },
                            onEditSentPlan = { plan ->
                                scope.launch {
                                    container.repository.saveDraftOffline(plan)
                                    selectedFamilyId = plan.familyId
                                    selectedPlanId = plan.id
                                    screenName = Screen.PLAN.name
                                }
                            }
                        )
                    }
                }

                Screen.PLAN -> {
                    if (selectedProject == null || selectedFamily == null || selectedPlan == null) {
                        RestoringStateScreen(
                            onBackHome = {
                                selectedProjectId = null
                                selectedFamilyId = null
                                selectedPlanId = null
                                screenName = Screen.HOME.name
                            }
                        )
                    } else {
                        PlanCaptureScreen(
                            container = container,
                            project = selectedProject,
                            family = selectedFamily,
                            plan = selectedPlan,
                            onBack = { screenName = Screen.FAMILY.name }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RestoringStateScreen(onBackHome: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        GlassPanel {
            Text("Recuperando captura local", style = MaterialTheme.typography.titleMedium)
            Text("La app esta restaurando los datos guardados offline.")
            OutlinedButton(onClick = onBackHome, modifier = Modifier.fillMaxWidth()) {
                Text("Volver a proyectos")
            }
        }
    }
}

@Composable
private fun LoginScreen(
    message: String?,
    onLogin: (String, String) -> Unit,
    onOffline: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(modifier = Modifier.height(20.dp))
        Image(
            painter = painterResource(id = R.drawable.logo_act_negro),
            contentDescription = "Logo del proyecto",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 240.dp)
                .height(128.dp)
        )
        Text("Planes Operativos", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
        GlassPanel {
            OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Correo") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Contrasena") }, modifier = Modifier.fillMaxWidth())
            Button(onClick = { onLogin(email, password) }, modifier = Modifier.fillMaxWidth()) { Text("Ingresar y descargar datos") }
            OutlinedButton(onClick = onOffline, modifier = Modifier.fillMaxWidth()) { Text("Trabajar offline") }
            message?.let { Text(friendlyMessage(it), color = MaterialTheme.colorScheme.error) }
        }
    }
}

@Composable
private fun HomeScreen(
    container: AppContainer,
    message: String?,
    onDownload: () -> Unit,
    onSync: () -> Unit,
    onLogout: () -> Unit,
    onOpenProject: (ProjectEntity) -> Unit
) {
    val projects by container.repository.projects.collectAsState(initial = emptyList())
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AppHeader(chip = "Proyectos")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onDownload) { Text("Descargar") }
            Button(onClick = onSync) { Text("Sincronizar") }
            OutlinedButton(onClick = onLogout) { Text("Salir") }
        }
        message?.let { Text(friendlyMessage(it), color = MaterialTheme.colorScheme.primary) }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(projects) { project ->
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .glassmorphism()
                        .clickable { onOpenProject(project) }
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(project.name, style = MaterialTheme.typography.titleMedium)
                        Text(project.codePrefix, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun FamilyScreen(
    container: AppContainer,
    project: ProjectEntity?,
    onBack: () -> Unit,
    onCreatePlan: (FamilyEntity) -> Unit,
    onEditSentPlan: (OperationalPlanEntity) -> Unit
) {
    if (project == null) return
    val families by container.repository.families(project.id).collectAsState(initial = emptyList())
    val municipalities by container.repository.municipalities().collectAsState(initial = emptyList())
    val villages by container.repository.villages().collectAsState(initial = emptyList())
    val properties by container.repository.properties().collectAsState(initial = emptyList())
    val sentPlans by container.repository.sentPlans(project.id).collectAsState(initial = emptyList())
    var query by remember { mutableStateOf("") }
    var selectorExpanded by remember { mutableStateOf(true) }
    var selectedFamily by remember { mutableStateOf<FamilyEntity?>(null) }
    val municipalityNames = municipalities.associateBy { it.id }
    val villageNames = villages.associateBy { it.id }
    val propertiesByFamily = properties.associateBy { it.familyId }
    val filteredFamilies = if (query.isBlank()) {
        emptyList()
    } else {
        families.filter {
            it.familyCode.contains(query, ignoreCase = true) ||
                it.representativeName.contains(query, ignoreCase = true) ||
                (it.documentNumber?.contains(query, ignoreCase = true) == true)
        }.take(50)
    }
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            AppHeader(chip = project.codePrefix, onBack = onBack)
        }
        item {
            CollapsibleSectionCard(
                title = "Seleccionar familia",
                expanded = selectorExpanded,
                onToggle = { selectorExpanded = !selectorExpanded },
                summary = selectedFamily?.let { "${it.familyCode} - ${it.representativeName}" } ?: "Sin familia seleccionada"
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Buscar por nombre, codigo o documento") },
                    modifier = Modifier.fillMaxWidth()
                )
                if (query.isBlank()) {
                    Text("Escriba para ver familias sugeridas.")
                }
                filteredFamilies.forEach { family ->
                    OutlinedButton(
                        onClick = {
                            selectedFamily = family
                            selectorExpanded = false
                            query = ""
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("${family.familyCode} - ${family.representativeName}")
                    }
                }
            }
        }
        item {
            var outboxExpanded by remember { mutableStateOf(false) }
            val familiesById = families.associateBy { it.id }
            CollapsibleSectionCard(
                title = "Bandeja de salida (${sentPlans.size})",
                expanded = outboxExpanded,
                onToggle = { outboxExpanded = !outboxExpanded },
                summary = "Planes creados y enviados"
            ) {
                if (sentPlans.isEmpty()) {
                    Text(
                        text = "No hay planes en la bandeja de salida.",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    sentPlans.forEach { sentPlan ->
                        val fam = familiesById[sentPlan.familyId]
                        androidx.compose.foundation.layout.Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .glassmorphism()
                                .clickable { onEditSentPlan(sentPlan) }
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(fam?.familyCode ?: "Desconocido", style = MaterialTheme.typography.titleSmall)
                                Text(fam?.representativeName ?: "Sin nombre", style = MaterialTheme.typography.bodyMedium)
                                Text("Fecha: ${sentPlan.planDate}", style = MaterialTheme.typography.bodySmall)
                                Text("Estado: ${friendlyPlanStatus(sentPlan.status)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                                if (sentPlan.syncState == com.restauracion.offline.data.local.SyncState.ERROR && !sentPlan.lastError.isNullOrBlank()) {
                                    Text("Error de Sync: ${sentPlan.lastError}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedButton(
                                    onClick = { onEditSentPlan(sentPlan) },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Editar plan")
                                }
                            }
                        }
                    }
                }
            }
        }
        selectedFamily?.let { family ->
            item {
                SectionCard("Familia seleccionada") {
                    val municipality = family.municipalityId?.let { municipalityNames[it]?.name } ?: "N/A"
                    val village = family.villageId?.let { villageNames[it]?.name } ?: "N/A"
                    val property = propertiesByFamily[family.id]
                    Text(family.familyCode, style = MaterialTheme.typography.titleMedium)
                    Text(family.representativeName)
                    Text("Documento: ${family.documentNumber ?: "N/A"}")
                    Text("Municipio: $municipality")
                    Text("Vereda: $village")
                    property?.propertyName?.let { Text("Predio: $it") }
                    Button(onClick = { onCreatePlan(family) }, modifier = Modifier.fillMaxWidth()) {
                        Text("Crear o continuar plan")
                    }
                }
            }
        }
    }
}

@Composable
private fun PlanCaptureScreen(
    container: AppContainer,
    project: ProjectEntity?,
    family: FamilyEntity?,
    plan: OperationalPlanEntity?,
    onBack: () -> Unit
) {
    if (project == null || family == null || plan == null) return
    val scope = rememberCoroutineScope()
    val currentPlanState by container.repository.plan(plan.id).collectAsState(initial = plan)
    val currentPlan = currentPlanState ?: plan
    val municipalities by container.repository.municipalities().collectAsState(initial = emptyList())
    val villages by container.repository.villages().collectAsState(initial = emptyList())
    val activities by container.repository.activities(project.id).collectAsState(initial = emptyList())
    val materials by container.repository.materials(project.id).collectAsState(initial = emptyList())
    val counterpartCatalog by container.repository.counterpartCatalog(project.id).collectAsState(initial = emptyList())
    val planActivities by container.repository.planActivities(currentPlan.id).collectAsState(initial = emptyList())
    var selectedPlanActivity by remember { mutableStateOf<PlanActivityEntity?>(null) }
    val selectedActivityId = selectedPlanActivity?.id.orEmpty()
    val planMaterials by container.repository.planMaterials(selectedActivityId).collectAsState(initial = emptyList())
    val planCounterparts by container.repository.planCounterparts(selectedActivityId).collectAsState(initial = emptyList())
    val allPlanMaterials by container.repository.planMaterialsTotal(currentPlan.id).collectAsState(initial = emptyList())
    val allPlanCounterparts by container.repository.planCounterpartsTotal(currentPlan.id).collectAsState(initial = emptyList())

    val activityNames = activities.associateBy { it.id }
    val materialNames = materials.associateBy { it.id }
    val municipalityNames = municipalities.associateBy { it.id }
    val villageNames = villages.associateBy { it.id }
    var message by remember { mutableStateOf<String?>(null) }

    fun draft(key: String) = container.repository.captureDraft(currentPlan.id, key)

    var activityFilter by remember(currentPlan.id) { mutableStateOf(draft("activity_filter")) }
    var selectedActivity by remember { mutableStateOf<ActivityCatalogEntity?>(null) }
    var editingActivity by remember { mutableStateOf<PlanActivityEntity?>(null) }
    var selectedActivityDraftId by remember(currentPlan.id) { mutableStateOf(draft("selected_activity_id")) }
    var baseline by remember(currentPlan.id) { mutableStateOf(draft("baseline")) }
    var target by remember(currentPlan.id) { mutableStateOf(draft("target")) }

    var materialFilter by remember(currentPlan.id) { mutableStateOf(draft("material_filter")) }
    var selectedMaterial by remember { mutableStateOf<MaterialCatalogEntity?>(null) }
    var editingMaterial by remember { mutableStateOf<PlanProjectMaterialEntity?>(null) }
    var selectedMaterialDraftId by remember(currentPlan.id) { mutableStateOf(draft("selected_material_id")) }
    var materialQuantity by remember(currentPlan.id) { mutableStateOf(draft("material_quantity")) }
    var projectMaterialKind by remember(currentPlan.id) { mutableStateOf(draft("project_material_kind").ifBlank { "standard" }) }
    var useProvisionalMaterial by remember(currentPlan.id) { mutableStateOf(draft("use_provisional_material") == "true") }
    var provisionalMaterialName by remember(currentPlan.id) { mutableStateOf(draft("provisional_material_name")) }
    var provisionalMaterialUnit by remember(currentPlan.id) { mutableStateOf(draft("provisional_material_unit")) }
    var provisionalMaterialObservation by remember(currentPlan.id) { mutableStateOf(draft("provisional_material_observation")) }

    var editingCounterpart by remember { mutableStateOf<PlanFamilyCounterpartEntity?>(null) }
    var counterpartFilter by remember(currentPlan.id) { mutableStateOf(draft("counterpart_filter")) }
    var selectedCounterpart by remember { mutableStateOf<CounterpartCatalogEntity?>(null) }
    var selectedCounterpartDraftId by remember(currentPlan.id) { mutableStateOf(draft("selected_counterpart_id")) }
    var useProvisionalCounterpart by remember(currentPlan.id) { mutableStateOf(draft("use_provisional_counterpart") == "true") }
    var counterpartType by remember(currentPlan.id) { mutableStateOf(draft("counterpart_type").ifBlank { "mano_obra" }) }
    var counterpartName by remember(currentPlan.id) { mutableStateOf(draft("counterpart_name")) }
    var counterpartQuantity by remember(currentPlan.id) { mutableStateOf(draft("counterpart_quantity")) }
    var counterpartUnit by remember(currentPlan.id) { mutableStateOf(draft("counterpart_unit")) }
    var counterpartUnitValue by remember(currentPlan.id) { mutableStateOf(draft("counterpart_unit_value")) }
    var counterpartObservation by remember(currentPlan.id) { mutableStateOf(draft("counterpart_observation")) }
    var includeVegetalCounterpart by remember(currentPlan.id) { mutableStateOf(draft("include_vegetal_counterpart") == "true") }
    var counterpartVegetalGroup by remember(currentPlan.id) { mutableStateOf(draft("counterpart_vegetal_group")) }
    var activitiesExpanded by remember { mutableStateOf(true) }
    var materialsExpanded by remember { mutableStateOf(false) }
    var counterpartsExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(currentPlan.id, currentPlan.lastError) {
        if (currentPlan.lastError?.contains("Serializing collections of different element types") == true) {
            container.repository.clearPlanSyncError(currentPlan)
            message = "Error anterior limpiado. Intente sincronizar nuevamente."
        }
    }

    LaunchedEffect(activities, selectedActivityDraftId) {
        if (selectedActivity == null && selectedActivityDraftId.isNotBlank()) {
            selectedActivity = activities.firstOrNull { it.id == selectedActivityDraftId }
        }
    }

    LaunchedEffect(materials, selectedMaterialDraftId) {
        if (selectedMaterial == null && selectedMaterialDraftId.isNotBlank()) {
            selectedMaterial = materials.firstOrNull { it.id == selectedMaterialDraftId }
        }
    }

    LaunchedEffect(counterpartCatalog, selectedCounterpartDraftId) {
        if (selectedCounterpart == null && selectedCounterpartDraftId.isNotBlank()) {
            selectedCounterpart = counterpartCatalog.firstOrNull { it.id == selectedCounterpartDraftId }
        }
    }

    LaunchedEffect(planActivities) {
        val savedActivityId = draft("selected_plan_activity_id")
        selectedPlanActivity = selectedPlanActivity?.let { current ->
            planActivities.firstOrNull { it.id == current.id }
        } ?: planActivities.firstOrNull { it.id == savedActivityId } ?: planActivities.firstOrNull()
    }

    LaunchedEffect(selectedPlanActivity?.id) {
        container.repository.saveCaptureDraft(currentPlan.id, "selected_plan_activity_id", selectedPlanActivity?.id.orEmpty())
    }

    LaunchedEffect(
        activityFilter,
        selectedActivityDraftId,
        baseline,
        target,
        materialFilter,
        selectedMaterialDraftId,
        materialQuantity,
        projectMaterialKind,
        useProvisionalMaterial,
        provisionalMaterialName,
        provisionalMaterialUnit,
        provisionalMaterialObservation,
        counterpartFilter,
        selectedCounterpartDraftId,
        useProvisionalCounterpart,
        counterpartType,
        counterpartName,
        counterpartQuantity,
        counterpartUnit,
        counterpartUnitValue,
        counterpartObservation,
        includeVegetalCounterpart,
        counterpartVegetalGroup
    ) {
        container.repository.saveCaptureDraft(currentPlan.id, "activity_filter", activityFilter)
        container.repository.saveCaptureDraft(currentPlan.id, "selected_activity_id", selectedActivityDraftId)
        container.repository.saveCaptureDraft(currentPlan.id, "baseline", baseline)
        container.repository.saveCaptureDraft(currentPlan.id, "target", target)
        container.repository.saveCaptureDraft(currentPlan.id, "material_filter", materialFilter)
        container.repository.saveCaptureDraft(currentPlan.id, "selected_material_id", selectedMaterialDraftId)
        container.repository.saveCaptureDraft(currentPlan.id, "material_quantity", materialQuantity)
        container.repository.saveCaptureDraft(currentPlan.id, "project_material_kind", projectMaterialKind)
        container.repository.saveCaptureDraft(currentPlan.id, "use_provisional_material", useProvisionalMaterial.toString())
        container.repository.saveCaptureDraft(currentPlan.id, "provisional_material_name", provisionalMaterialName)
        container.repository.saveCaptureDraft(currentPlan.id, "provisional_material_unit", provisionalMaterialUnit)
        container.repository.saveCaptureDraft(currentPlan.id, "provisional_material_observation", provisionalMaterialObservation)
        container.repository.saveCaptureDraft(currentPlan.id, "counterpart_filter", counterpartFilter)
        container.repository.saveCaptureDraft(currentPlan.id, "selected_counterpart_id", selectedCounterpartDraftId)
        container.repository.saveCaptureDraft(currentPlan.id, "use_provisional_counterpart", useProvisionalCounterpart.toString())
        container.repository.saveCaptureDraft(currentPlan.id, "counterpart_type", counterpartType)
        container.repository.saveCaptureDraft(currentPlan.id, "counterpart_name", counterpartName)
        container.repository.saveCaptureDraft(currentPlan.id, "counterpart_quantity", counterpartQuantity)
        container.repository.saveCaptureDraft(currentPlan.id, "counterpart_unit", counterpartUnit)
        container.repository.saveCaptureDraft(currentPlan.id, "counterpart_unit_value", counterpartUnitValue)
        container.repository.saveCaptureDraft(currentPlan.id, "counterpart_observation", counterpartObservation)
        container.repository.saveCaptureDraft(currentPlan.id, "include_vegetal_counterpart", includeVegetalCounterpart.toString())
        container.repository.saveCaptureDraft(currentPlan.id, "counterpart_vegetal_group", counterpartVegetalGroup)
    }

    val filteredActivities = if (activityFilter.isBlank()) {
        emptyList()
    } else {
        activities.filter { it.name.contains(activityFilter, ignoreCase = true) }.take(50)
    }
    val filteredMaterials = if (materialFilter.isBlank()) {
        emptyList()
    } else {
        materials
            .filter { it.name.contains(materialFilter, ignoreCase = true) }
            .filter { material -> if (projectMaterialKind == "vegetal") isVegetalMaterial(material) else !isVegetalMaterial(material) }
            .take(50)
    }
    val filteredCounterparts = if (counterpartFilter.isBlank()) {
        emptyList()
    } else {
        counterpartCatalog.filter { it.name.contains(counterpartFilter, ignoreCase = true) }.take(50)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            AppHeader(chip = "Captura", syncState = currentPlan.syncState.name, onBack = onBack)
        }

        item {
            SectionCard("Datos generales del plan") {
                val municipality = family.municipalityId?.let { municipalityNames[it]?.name } ?: "N/A"
                val village = family.villageId?.let { villageNames[it]?.name } ?: "N/A"
                Text("${family.familyCode} - ${family.representativeName}", style = MaterialTheme.typography.titleMedium)
                Text("Documento: ${family.documentNumber ?: "N/A"}")
                Text("Municipio: $municipality")
                Text("Vereda: $village")
                Text("Fecha: ${currentPlan.planDate}")
            }
        }

        item {
            CollapsibleSectionCard(
                title = "Actividades del plan",
                expanded = activitiesExpanded,
                onToggle = { activitiesExpanded = !activitiesExpanded },
                summary = "${planActivities.size} registrada(s)"
            ) {
                OutlinedTextField(
                    value = activityFilter,
                    onValueChange = { activityFilter = it },
                    label = { Text("Buscar actividad") },
                    modifier = Modifier.fillMaxWidth()
                )
                if (activityFilter.isBlank() && selectedActivity == null) {
                    Text("Escriba para ver sugerencias del catalogo.")
                }
                OptionList(
                    items = filteredActivities,
                    itemLabel = { it.name },
                    onPick = {
                        selectedActivity = it
                        selectedActivityDraftId = it.id
                        editingActivity = null
                        baseline = ""
                        target = ""
                    }
                )
                selectedActivity?.let {
                    Text("Seleccionada: ${it.name} (${it.unit})")
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DecimalField("Linea base", baseline, { baseline = it }, Modifier.weight(1f))
                    DecimalField("Meta", target, { target = it }, Modifier.weight(1f))
                }
                Button(onClick = {
                    val catalog = selectedActivity
                    val baseValue = baseline.toDoubleOrNull()
                    val targetValue = target.toDoubleOrNull()
                    when {
                        catalog == null -> message = "Seleccione una actividad."
                        catalog.requiresBaseline && baseValue == null -> message = "La actividad requiere linea base."
                        catalog.requiresTarget && targetValue == null -> message = "La actividad requiere meta."
                        baseValue != null && baseValue < 0 -> message = "La linea base no puede ser negativa."
                        targetValue != null && targetValue < 0 -> message = "La meta no puede ser negativa."
                        planActivities.any { it.activityId == catalog.id && it.id != editingActivity?.id } -> {
                            message = "Esta actividad ya esta registrada en el plan."
                        }
                        else -> scope.launch {
                            runCatching {
                                val editing = editingActivity
                                if (editing == null) {
                                    val created = container.repository.addActivity(currentPlan.id, catalog.id, catalog.unit, baseValue, targetValue)
                                    selectedPlanActivity = created
                                } else {
                                    container.repository.updateActivity(
                                        editing.copy(
                                            activityId = catalog.id,
                                            unit = catalog.unit,
                                            baseline = baseValue,
                                            target = targetValue
                                        )
                                    )
                                    selectedPlanActivity = editing.copy(
                                        activityId = catalog.id,
                                        unit = catalog.unit,
                                        baseline = baseValue,
                                        target = targetValue
                                    )
                                }
                            }.onSuccess {
                                message = "Actividad guardada. Ahora registre materiales del proyecto para esta actividad."
                                editingActivity = null
                                selectedActivity = null
                                selectedActivityDraftId = ""
                                baseline = ""
                                target = ""
                                activitiesExpanded = false
                                materialsExpanded = true
                                counterpartsExpanded = false
                            }.onFailure {
                                message = it.message ?: "No fue posible guardar la actividad."
                            }
                        }
                    }
                }) { Text(if (editingActivity == null) "Guardar actividad" else "Actualizar actividad") }
            }
        }

        itemsIndexed(planActivities, key = { _, item -> item.id }) { index, item ->
            val catalog = activityNames[item.activityId]
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .glassmorphism()
                    .clickable { selectedPlanActivity = item }
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Actividad ${index + 1}: ${catalog?.name ?: "Actividad sin catalogo"}", style = MaterialTheme.typography.titleMedium)
                    Text("Linea base: ${item.baseline ?: "N/A"} | Meta: ${item.target ?: "N/A"} ${item.unit}")
                    StatusChip(item.syncState.name)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            selectedPlanActivity = item
                            editingActivity = item
                            selectedActivity = catalog
                            selectedActivityDraftId = catalog?.id.orEmpty()
                            baseline = item.baseline?.toString().orEmpty()
                            target = item.target?.toString().orEmpty()
                        }) { Text("Editar") }
                        OutlinedButton(onClick = {
                            scope.launch {
                                container.repository.deleteActivity(item)
                                message = "Actividad eliminada localmente."
                            }
                        }) { Text("Eliminar") }
                    }
                }
            }
        }

        item {
            CollapsibleSectionCard(
                title = "Materiales del proyecto y material vegetal",
                expanded = materialsExpanded,
                onToggle = { materialsExpanded = !materialsExpanded },
                summary = "${planMaterials.size} en actividad seleccionada"
            ) {
                Text("Actividad seleccionada: ${selectedPlanActivity?.let { activityNames[it.activityId]?.name } ?: "Ninguna"}")
                Text("Seleccione si va a registrar insumos/materiales o material vegetal para esta actividad.")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        projectMaterialKind = "standard"
                        selectedMaterial = null
                        selectedMaterialDraftId = ""
                        materialFilter = ""
                    }) { Text("Materiales / insumos") }
                    OutlinedButton(onClick = {
                        projectMaterialKind = "vegetal"
                        selectedMaterial = null
                        selectedMaterialDraftId = ""
                        materialFilter = ""
                    }) { Text("Material vegetal") }
                }
                Text("Registrando: ${if (projectMaterialKind == "vegetal") "Material vegetal del proyecto" else "Materiales e insumos del proyecto"}")
                OutlinedTextField(
                    value = materialFilter,
                    onValueChange = { materialFilter = it },
                    label = { Text(if (projectMaterialKind == "vegetal") "Buscar especie o material vegetal" else "Buscar material o insumo") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { useProvisionalMaterial = false }) { Text("Catalogo") }
                    OutlinedButton(onClick = {
                        useProvisionalMaterial = true
                        selectedMaterial = null
                        selectedMaterialDraftId = ""
                    }) { Text("Material no encontrado") }
                }
                if (!useProvisionalMaterial) {
                    if (materialFilter.isBlank() && selectedMaterial == null) {
                        Text("Escriba para ver sugerencias del catalogo.")
                    }
                    OptionList(
                        items = filteredMaterials,
                        itemLabel = { "${it.name} (${it.unit})" },
                        onPick = {
                            selectedMaterial = it
                            selectedMaterialDraftId = it.id
                            editingMaterial = null
                            materialQuantity = ""
                        }
                    )
                    selectedMaterial?.let {
                        Text("Seleccionado: ${it.name} | Unidad: ${it.unit} | Valor unitario: ${money(it.quotedUnitPrice)}")
                    }
                } else {
                    OutlinedTextField(
                        value = provisionalMaterialName,
                        onValueChange = { provisionalMaterialName = it },
                        label = { Text("Nombre sugerido del material") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = provisionalMaterialUnit,
                        onValueChange = { provisionalMaterialUnit = it },
                        label = { Text("Unidad sugerida") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = provisionalMaterialObservation,
                        onValueChange = { provisionalMaterialObservation = it },
                        label = { Text("Observacion para revision web") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                DecimalField("Cantidad", materialQuantity, { materialQuantity = it }, Modifier.fillMaxWidth())
                val quotedTotal = (materialQuantity.toDoubleOrNull() ?: 0.0) * (selectedMaterial?.quotedUnitPrice ?: 0.0)
                Text("Valor cotizado: ${money(quotedTotal)}")
                Button(onClick = {
                    val activity = selectedPlanActivity
                    val material = selectedMaterial
                    val qty = materialQuantity.toDoubleOrNull()
                    when {
                        activity == null -> message = "Seleccione una actividad del plan."
                        !useProvisionalMaterial && material == null -> message = "Seleccione un material."
                        useProvisionalMaterial && provisionalMaterialName.isBlank() -> message = "Ingrese el nombre del material no encontrado."
                        useProvisionalMaterial && provisionalMaterialUnit.isBlank() -> message = "Ingrese la unidad sugerida."
                        qty == null || qty <= 0 -> message = "Ingrese una cantidad valida para el material."
                        else -> scope.launch {
                            runCatching {
                                val editing = editingMaterial
                                if (editing == null) {
                                    if (useProvisionalMaterial) {
                                        container.repository.addProvisionalProjectMaterial(
                                            activity.id,
                                            provisionalMaterialName,
                                            provisionalMaterialUnit,
                                            qty,
                                            provisionalMaterialObservation.ifBlank { null }
                                        )
                                    } else {
                                        checkNotNull(material)
                                        container.repository.addProjectMaterial(activity.id, material.id, qty, material.unit, material.quotedUnitPrice)
                                    }
                                } else {
                                    if (useProvisionalMaterial) {
                                        container.repository.updateProjectMaterial(
                                            editing.copy(
                                                materialId = null,
                                                provisionalName = provisionalMaterialName,
                                                quantity = qty,
                                                unit = provisionalMaterialUnit,
                                                quotedUnitPrice = 0.0,
                                                observations = provisionalMaterialObservation.ifBlank { null }
                                            )
                                        )
                                    } else {
                                        checkNotNull(material)
                                        container.repository.updateProjectMaterial(
                                            editing.copy(
                                                materialId = material.id,
                                                provisionalName = null,
                                                quantity = qty,
                                                unit = material.unit,
                                                quotedUnitPrice = material.quotedUnitPrice,
                                                observations = null
                                            )
                                        )
                                    }
                                }
                            }.onSuccess {
                                message = "Material guardado localmente."
                                editingMaterial = null
                                selectedMaterial = null
                                selectedMaterialDraftId = ""
                                materialQuantity = ""
                                provisionalMaterialName = ""
                                provisionalMaterialUnit = ""
                                provisionalMaterialObservation = ""
                                useProvisionalMaterial = false
                            }.onFailure {
                                message = it.message ?: "No fue posible guardar el material."
                            }
                        }
                    }
                }) { Text(if (editingMaterial == null) "Guardar material" else "Actualizar material") }
                HorizontalDivider()
                val standardMaterials = planMaterials.filter { !isVegetalPlanMaterial(it, materialNames) }
                val vegetalMaterials = planMaterials.filter { isVegetalPlanMaterial(it, materialNames) }
                if (standardMaterials.isEmpty() && vegetalMaterials.isEmpty()) {
                    Text("Sin materiales para esta actividad.")
                }
                if (standardMaterials.isNotEmpty()) {
                    ProjectMaterialsTable(
                        title = "Materiales e insumos del proyecto",
                        items = standardMaterials,
                        materialNames = materialNames,
                        onEdit = { item ->
                            val material = item.materialId?.let { materialNames[it] }
                            editingMaterial = item
                            selectedMaterial = material
                            selectedMaterialDraftId = material?.id.orEmpty()
                            materialQuantity = item.quantity.toString()
                            projectMaterialKind = if (material?.let { isVegetalMaterial(it) } == true) "vegetal" else "standard"
                            useProvisionalMaterial = item.materialId == null
                            provisionalMaterialName = item.provisionalName.orEmpty()
                            provisionalMaterialUnit = item.unit
                            provisionalMaterialObservation = item.observations.orEmpty()
                        },
                        onDelete = { item ->
                            scope.launch {
                                container.repository.deleteProjectMaterial(item)
                                message = "Material eliminado localmente."
                            }
                        }
                    )
                }
                if (vegetalMaterials.isNotEmpty()) {
                    ProjectMaterialsTable(
                        title = "Material vegetal del proyecto",
                        items = vegetalMaterials,
                        materialNames = materialNames,
                        onEdit = { item ->
                            val material = item.materialId?.let { materialNames[it] }
                            editingMaterial = item
                            selectedMaterial = material
                            selectedMaterialDraftId = material?.id.orEmpty()
                            materialQuantity = item.quantity.toString()
                            projectMaterialKind = "vegetal"
                            useProvisionalMaterial = item.materialId == null
                            provisionalMaterialName = item.provisionalName.orEmpty()
                            provisionalMaterialUnit = item.unit
                            provisionalMaterialObservation = item.observations.orEmpty()
                        },
                        onDelete = { item ->
                            scope.launch {
                                container.repository.deleteProjectMaterial(item)
                                message = "Material vegetal eliminado localmente."
                            }
                        }
                    )
                }
                OutlinedButton(
                    onClick = {
                        counterpartsExpanded = true
                        materialsExpanded = false
                        message = "Ahora registre la contrapartida familiar de esta actividad."
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Continuar a contrapartida familiar") }
            }
        }

        item {
            CollapsibleSectionCard(
                title = "Contrapartida familiar",
                expanded = counterpartsExpanded,
                onToggle = { counterpartsExpanded = !counterpartsExpanded },
                summary = "${planCounterparts.size} en actividad seleccionada"
            ) {
                Text("Actividad seleccionada: ${selectedPlanActivity?.let { activityNames[it.activityId]?.name } ?: "Ninguna"}")
                OutlinedTextField(
                    value = counterpartFilter,
                    onValueChange = { counterpartFilter = it },
                    label = { Text("Buscar aporte de contrapartida") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { useProvisionalCounterpart = false }) { Text("Catalogo") }
                    OutlinedButton(onClick = {
                        useProvisionalCounterpart = true
                        selectedCounterpart = null
                        selectedCounterpartDraftId = ""
                    }) { Text("Aporte no encontrado") }
                }
                Text("Material vegetal de contrapartida")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        includeVegetalCounterpart = true
                        counterpartType = "material_propio"
                    }) { Text("Si") }
                    OutlinedButton(onClick = {
                        includeVegetalCounterpart = false
                        counterpartVegetalGroup = ""
                    }) { Text("No") }
                }
                if (includeVegetalCounterpart) {
                    Text("Grupo vegetal")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { counterpartVegetalGroup = "colinos" }) { Text("Colinos") }
                        OutlinedButton(onClick = { counterpartVegetalGroup = "cacao" }) { Text("Cacao") }
                        OutlinedButton(onClick = { counterpartVegetalGroup = "frutales" }) { Text("Frutales") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { counterpartVegetalGroup = "forestales_nativos" }) { Text("Forestales nativos") }
                        OutlinedButton(onClick = { counterpartVegetalGroup = "otro" }) { Text("Otro vegetal") }
                    }
                    Text("Seleccionado: ${vegetalGroupLabel(counterpartVegetalGroup)}")
                }
                if (!useProvisionalCounterpart) {
                    if (counterpartFilter.isBlank() && selectedCounterpart == null) {
                        Text("Escriba para ver sugerencias del catalogo.")
                    }
                    OptionList(
                        items = filteredCounterparts,
                        itemLabel = { "${it.name} (${it.suggestedUnit})" },
                        onPick = {
                            selectedCounterpart = it
                            selectedCounterpartDraftId = it.id
                            counterpartType = it.contributionType
                            counterpartName = it.name
                            counterpartUnit = it.suggestedUnit
                            editingCounterpart = null
                        }
                    )
                    selectedCounterpart?.let {
                        Text("Seleccionado: ${it.name} | Tipo: ${it.contributionType} | Unidad: ${it.suggestedUnit}")
                    }
                } else {
                    Text("Tipo de aporte")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { counterpartType = "mano_obra" }) { Text("Mano de obra") }
                        OutlinedButton(onClick = { counterpartType = "material_propio" }) { Text("Materiales") }
                        OutlinedButton(onClick = { counterpartType = "otro" }) { Text("Otro") }
                    }
                }
                OutlinedTextField(
                    value = counterpartName,
                    onValueChange = { counterpartName = it },
                    label = { Text(if (useProvisionalCounterpart) "Descripcion del aporte no encontrado" else "Descripcion del aporte") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DecimalField("Cantidad", counterpartQuantity, { counterpartQuantity = it }, Modifier.weight(1f))
                    OutlinedTextField(value = counterpartUnit, onValueChange = { counterpartUnit = it }, label = { Text("Unidad") }, modifier = Modifier.weight(1f))
                }
                DecimalField("Valor unitario estimado", counterpartUnitValue, { counterpartUnitValue = it }, Modifier.fillMaxWidth())
                OutlinedTextField(
                    value = counterpartObservation,
                    onValueChange = { counterpartObservation = it },
                    label = { Text("Observacion") },
                    modifier = Modifier.fillMaxWidth()
                )
                val total = (counterpartQuantity.toDoubleOrNull() ?: 0.0) * (counterpartUnitValue.toDoubleOrNull() ?: 0.0)
                Text("Valor estimado: ${money(total)}")
                Button(onClick = {
                    val activity = selectedPlanActivity
                    val qty = counterpartQuantity.toDoubleOrNull()
                    val unitValue = counterpartUnitValue.toDoubleOrNull() ?: 0.0
                    when {
                        activity == null -> message = "Seleccione una actividad del plan."
                        counterpartName.isBlank() -> message = "Ingrese el aporte de la familia."
                        includeVegetalCounterpart && counterpartVegetalGroup.isBlank() -> message = "Seleccione el grupo vegetal de la contrapartida."
                        qty == null || qty <= 0 -> message = "Ingrese una cantidad valida de contrapartida."
                        unitValue < 0 -> message = "El valor estimado no puede ser negativo."
                        else -> scope.launch {
                            runCatching {
                                val editing = editingCounterpart
                                if (editing == null) {
                                    container.repository.addCounterpart(
                                        activity.id,
                                        counterpartType,
                                        counterpartName,
                                        qty,
                                        counterpartUnit.ifBlank { "unidad" },
                                        unitValue,
                                        if (includeVegetalCounterpart) counterpartVegetalGroup else null,
                                        counterpartObservation.ifBlank { null }
                                    )
                                } else {
                                    container.repository.updateCounterpart(
                                        editing.copy(
                                            contributionType = counterpartType,
                                            name = counterpartName,
                                            quantity = qty,
                                            unit = counterpartUnit.ifBlank { "unidad" },
                                            estimatedUnitValue = unitValue,
                                            vegetalIndicatorGroup = if (includeVegetalCounterpart) counterpartVegetalGroup else null,
                                            observations = counterpartObservation.ifBlank { null }
                                        )
                                    )
                                }
                            }.onSuccess {
                                message = "Contrapartida guardada localmente."
                                editingCounterpart = null
                                selectedCounterpart = null
                                selectedCounterpartDraftId = ""
                                useProvisionalCounterpart = false
                                counterpartName = ""
                                counterpartQuantity = ""
                                counterpartUnit = ""
                                counterpartUnitValue = ""
                                includeVegetalCounterpart = false
                                counterpartVegetalGroup = ""
                                counterpartObservation = ""
                            }.onFailure {
                                message = it.message ?: "No fue posible guardar la contrapartida."
                            }
                        }
                    }
                }) { Text(if (editingCounterpart == null) "Guardar contrapartida" else "Actualizar contrapartida") }
                HorizontalDivider()
                val standardCounterparts = planCounterparts.filter { it.vegetalIndicatorGroup == null }
                val vegetalCounterparts = planCounterparts.filter { it.vegetalIndicatorGroup != null }
                if (standardCounterparts.isEmpty() && vegetalCounterparts.isEmpty()) {
                    Text("Sin contrapartidas para esta actividad.")
                }
                if (standardCounterparts.isNotEmpty()) {
                    CounterpartTable(
                        title = "Contrapartida familiar",
                        items = standardCounterparts,
                        onEdit = { item ->
                            editingCounterpart = item
                            selectedCounterpart = counterpartCatalog.find { catalog -> sameCatalogCounterpart(catalog, item) }
                            selectedCounterpartDraftId = selectedCounterpart?.id.orEmpty()
                            useProvisionalCounterpart = selectedCounterpart == null
                            counterpartType = item.contributionType
                            counterpartName = item.name
                            counterpartQuantity = item.quantity.toString()
                            counterpartUnit = item.unit
                            counterpartUnitValue = item.estimatedUnitValue.toString()
                            includeVegetalCounterpart = item.vegetalIndicatorGroup != null
                            counterpartVegetalGroup = item.vegetalIndicatorGroup.orEmpty()
                            counterpartObservation = item.observations.orEmpty()
                        },
                        onDelete = { item ->
                            scope.launch {
                                container.repository.deleteCounterpart(item)
                                message = "Contrapartida eliminada localmente."
                            }
                        }
                    )
                }
                if (vegetalCounterparts.isNotEmpty()) {
                    CounterpartTable(
                        title = "Material vegetal de contrapartida familiar",
                        items = vegetalCounterparts,
                        onEdit = { item ->
                            editingCounterpart = item
                            selectedCounterpart = counterpartCatalog.find { catalog -> sameCatalogCounterpart(catalog, item) }
                            selectedCounterpartDraftId = selectedCounterpart?.id.orEmpty()
                            useProvisionalCounterpart = selectedCounterpart == null
                            counterpartType = item.contributionType
                            counterpartName = item.name
                            counterpartQuantity = item.quantity.toString()
                            counterpartUnit = item.unit
                            counterpartUnitValue = item.estimatedUnitValue.toString()
                            includeVegetalCounterpart = true
                            counterpartVegetalGroup = item.vegetalIndicatorGroup.orEmpty()
                            counterpartObservation = item.observations.orEmpty()
                        },
                        onDelete = { item ->
                            scope.launch {
                                container.repository.deleteCounterpart(item)
                                message = "Material vegetal de contrapartida eliminado localmente."
                            }
                        }
                    )
                }
                OutlinedButton(
                    onClick = {
                        selectedPlanActivity = null
                        editingActivity = null
                        selectedActivity = null
                        selectedActivityDraftId = ""
                        activityFilter = ""
                        baseline = ""
                        target = ""
                        activitiesExpanded = true
                        materialsExpanded = false
                        counterpartsExpanded = false
                        message = "Seleccione la siguiente actividad para esta misma familia."
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Agregar otra actividad para esta familia") }
            }
        }

        item {
            SectionCard("Resumen del plan") {
                val summaries = buildPlanActivitySummaries(planActivities, allPlanMaterials, allPlanCounterparts, activityNames, materialNames)
                val standardMaterialTotal = summaries.sumOf { it.standardMaterialTotal }
                val vegetalMaterialTotal = summaries.sumOf { it.vegetalMaterialTotal }
                val materialTotal = standardMaterialTotal + vegetalMaterialTotal
                val standardCounterpartTotal = summaries.sumOf { it.standardCounterpartTotal }
                val vegetalCounterpartTotal = summaries.sumOf { it.vegetalCounterpartTotal }
                val counterpartTotal = standardCounterpartTotal + vegetalCounterpartTotal
                val provisionalCount = allPlanMaterials.count { it.materialId == null || it.provisionalName != null }
                Text("Actividades: ${planActivities.size}")
                summaries.forEachIndexed { index, summary ->
                    ActivitySummaryCard(index + 1, summary)
                }
                HorizontalDivider()
                Text("Totales generales", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text("Materiales e insumos del proyecto: ${money(standardMaterialTotal)}")
                Text("Material vegetal del proyecto: ${money(vegetalMaterialTotal)}")
                Text("Total materiales del proyecto + material vegetal: ${money(materialTotal)}")
                Text("Contrapartida familiar: ${money(standardCounterpartTotal)}")
                Text("Material vegetal de contrapartida: ${money(vegetalCounterpartTotal)}")
                Text("Total contrapartida familiar: ${money(counterpartTotal)}")
                Text("Total general: ${money(materialTotal + counterpartTotal)}")
                if (provisionalCount > 0) {
                    Text("Alerta: $provisionalCount material(es) provisional(es) pendiente(s) de resolver en web.")
                }
                HorizontalDivider()
                Text("Estado del plan", style = MaterialTheme.typography.titleSmall)
                Text(friendlyPlanStatus(currentPlan.status))
                StatusChip(currentPlan.syncState.name)
                currentPlan.lastError?.let { Text(friendlyMessage(it), color = MaterialTheme.colorScheme.error) }
                HorizontalDivider()
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            runCatching { container.repository.saveDraftOffline(currentPlan) }
                                .onSuccess { message = "Borrador guardado offline." }
                                .onFailure { message = it.message ?: "No fue posible guardar el borrador." }
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Guardar borrador offline") }
                OutlinedButton(
                    onClick = {
                        if (currentPlan.status in listOf("approved", "closed")) {
                            message = "Este plan ya no permite edicion."
                        } else {
                            activitiesExpanded = true
                            materialsExpanded = false
                            counterpartsExpanded = false
                            message = "Puede editar actividades, materiales y contrapartida."
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Editar plan") }
                Button(
                    onClick = {
                        val errors = validatePlanForSync(planActivities, allPlanMaterials, allPlanCounterparts, activities)
                        if (errors.isNotEmpty()) {
                            message = errors.joinToString("\n")
                        } else {
                            scope.launch {
                                runCatching {
                                    container.repository.markPlanPending(currentPlan)
                                    container.repository.syncPending()
                                }.onSuccess {
                                    message = "Plan sincronizado con plataforma."
                                }.onFailure {
                                    message = it.message ?: "No fue posible sincronizar."
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Enviar plan operativo / Sincronizar") }
                Button(
                    onClick = {
                        val errors = validatePlanForReview(planActivities, allPlanMaterials, allPlanCounterparts, activities)
                        if (errors.isNotEmpty()) {
                            message = errors.joinToString("\n")
                        } else {
                            scope.launch {
                                runCatching { container.repository.markPlanPendingReview(currentPlan) }
                                    .onSuccess { message = "Plan marcado como pendiente de revision." }
                                    .onFailure { message = it.message ?: "No fue posible marcar el plan para revision." }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Marcar listo para revision") }
            }
        }

        item {
            message?.let {
                Text(it, color = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    GlassPanel {
        Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
        content()
    }
}

@Composable
private fun GlassPanel(content: @Composable ColumnScope.() -> Unit) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .fillMaxWidth()
            .glassmorphism()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            content()
        }
    }
}

@Composable
private fun CollapsibleSectionCard(
    title: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    summary: String,
    content: @Composable ColumnScope.() -> Unit
) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .fillMaxWidth()
            .glassmorphism()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    Text(summary, style = MaterialTheme.typography.bodySmall)
                }
                OutlinedButton(onClick = onToggle) {
                    Text(if (expanded) "Ocultar" else "Abrir")
                }
            }
            if (expanded) {
                content()
            }
        }
    }
}

@Composable
private fun AppHeader(chip: String? = null, syncState: String? = null, onBack: (() -> Unit)? = null) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .fillMaxWidth()
            .glassmorphism()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            onBack?.let {
                OutlinedButton(onClick = it) { Text("Volver") }
            }
            Image(
                painter = painterResource(id = R.drawable.logo_act_negro),
                contentDescription = "Logo",
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(36.dp)
            )
            Column(modifier = Modifier.weight(1f)) {
                Text("Planes Operativos", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                chip?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            }
            syncState?.let { StatusChip(it) }
        }
    }
}

@Composable
private fun StatusChip(state: String) {
    val (label, color) = when (state) {
        "SYNCED" -> "Sincronizado" to BrandDark
        "ERROR" -> "Error" to ErrorRed
        "CONFLICT" -> "Conflicto" to Color(0xFF9A6B22)
        else -> "Pendiente" to BrandPrimary
    }
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.12f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.35f))
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.bodySmall,
            color = color
        )
    }
}

@Composable
private fun CompactRow(
    title: String,
    detail: String,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        Text(title, style = MaterialTheme.typography.titleSmall)
        Text(detail, style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onEdit) { Text("Editar") }
            OutlinedButton(onClick = onDelete) { Text("Eliminar") }
        }
        HorizontalDivider()
    }
}

@Composable
private fun ProjectMaterialsTable(
    title: String,
    items: List<PlanProjectMaterialEntity>,
    materialNames: Map<String, MaterialCatalogEntity>,
    onEdit: (PlanProjectMaterialEntity) -> Unit,
    onDelete: (PlanProjectMaterialEntity) -> Unit
) {
    ContributionTable(title = title) {
        ContributionHeader()
        items.forEach { item ->
            val material = item.materialId?.let { materialNames[it] }
            ContributionRow(
                article = material?.name ?: "${item.provisionalName ?: "Material"} (pendiente revision)",
                quantity = formatQuantityOnly(item.quantity),
                unitValue = money(item.quotedUnitPrice),
                totalValue = money(item.quantity * item.quotedUnitPrice),
                onEdit = { onEdit(item) },
                onDelete = { onDelete(item) }
            )
        }
        ContributionSubtotal(label = "Subtotal proyecto", value = money(items.sumOf { it.quantity * it.quotedUnitPrice }))
    }
}

@Composable
private fun CounterpartTable(
    title: String,
    items: List<PlanFamilyCounterpartEntity>,
    onEdit: (PlanFamilyCounterpartEntity) -> Unit,
    onDelete: (PlanFamilyCounterpartEntity) -> Unit
) {
    ContributionTable(title = title) {
        ContributionHeader()
        items.forEach { item ->
            ContributionRow(
                article = if (item.vegetalIndicatorGroup != null) "${item.name} (${vegetalGroupLabel(item.vegetalIndicatorGroup)})" else item.name,
                quantity = formatQuantityOnly(item.quantity),
                unitValue = money(item.estimatedUnitValue),
                totalValue = money(item.quantity * item.estimatedUnitValue),
                onEdit = { onEdit(item) },
                onDelete = { onDelete(item) }
            )
        }
        ContributionSubtotal(label = "Subtotal familia", value = money(items.sumOf { it.quantity * it.estimatedUnitValue }))
    }
}

private data class PlanActivitySummary(
    val activityName: String,
    val unit: String,
    val standardMaterialTotal: Double,
    val vegetalMaterialTotal: Double,
    val standardCounterpartTotal: Double,
    val vegetalCounterpartTotal: Double
) {
    val projectTotal: Double get() = standardMaterialTotal + vegetalMaterialTotal
    val counterpartTotal: Double get() = standardCounterpartTotal + vegetalCounterpartTotal
}

private fun buildPlanActivitySummaries(
    planActivities: List<PlanActivityEntity>,
    materials: List<PlanProjectMaterialEntity>,
    counterparts: List<PlanFamilyCounterpartEntity>,
    activityNames: Map<String, ActivityCatalogEntity>,
    materialNames: Map<String, MaterialCatalogEntity>
): List<PlanActivitySummary> {
    return planActivities.map { activity ->
        val activityMaterials = materials.filter { it.planActivityId == activity.id }
        val activityCounterparts = counterparts.filter { it.planActivityId == activity.id }
        val standardMaterials = activityMaterials.filter { !isVegetalPlanMaterial(it, materialNames) }
        val vegetalMaterials = activityMaterials.filter { isVegetalPlanMaterial(it, materialNames) }
        val standardCounterparts = activityCounterparts.filter { it.vegetalIndicatorGroup == null }
        val vegetalCounterparts = activityCounterparts.filter { it.vegetalIndicatorGroup != null }
        PlanActivitySummary(
            activityName = activityNames[activity.activityId]?.name ?: "Actividad sin catalogo",
            unit = activity.unit,
            standardMaterialTotal = standardMaterials.sumOf { it.quantity * it.quotedUnitPrice },
            vegetalMaterialTotal = vegetalMaterials.sumOf { it.quantity * it.quotedUnitPrice },
            standardCounterpartTotal = standardCounterparts.sumOf { it.quantity * it.estimatedUnitValue },
            vegetalCounterpartTotal = vegetalCounterparts.sumOf { it.quantity * it.estimatedUnitValue }
        )
    }
}

@Composable
private fun ActivitySummaryCard(index: Int, summary: PlanActivitySummary) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
        Text("Actividad $index: ${summary.activityName} (${summary.unit})", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        Text("Materiales del proyecto: ${money(summary.standardMaterialTotal)}")
        Text("Material vegetal del proyecto: ${money(summary.vegetalMaterialTotal)}")
        Text("Subtotal proyecto actividad $index: ${money(summary.projectTotal)}")
        Text("Contrapartida familiar: ${money(summary.standardCounterpartTotal)}")
        Text("Material vegetal de contrapartida: ${money(summary.vegetalCounterpartTotal)}")
        Text("Subtotal contrapartida actividad $index: ${money(summary.counterpartTotal)}")
        HorizontalDivider()
    }
}

@Composable
private fun ContributionTable(
    title: String,
    content: @Composable TableMetrics.() -> Unit
) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val tableWidth = if (maxWidth < 620.dp) 620.dp else maxWidth
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            Text(
                text = title.uppercase(),
                modifier = Modifier
                    .width(tableWidth)
                    .background(Color.White)
                    .border(0.8.dp, Color(0xFF3F453D))
                    .padding(vertical = 6.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = TextDark
            )
            with(TableMetrics(tableWidth)) {
                content()
            }
        }
    }
}

private data class TableMetrics(
    val tableWidth: Dp,
    val article: Dp = tableWidth * 0.40f,
    val quantity: Dp = tableWidth * 0.14f,
    val unitValue: Dp = tableWidth * 0.17f,
    val total: Dp = tableWidth * 0.18f,
    val actions: Dp = tableWidth * 0.11f
)

@Composable
private fun TableMetrics.ContributionHeader() {
    Row(modifier = Modifier.width(tableWidth)) {
        TableCell("Articulo", article, header = true)
        TableCell("Cantidad", quantity, header = true)
        TableCell("Valor uni", unitValue, header = true)
        TableCell("Valor total", total, header = true)
        TableCell("Acciones", actions, header = true)
    }
}

@Composable
private fun TableMetrics.ContributionRow(
    article: String,
    quantity: String,
    unitValue: String,
    totalValue: String,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val articleWidth = this.article
    val quantityWidth = this.quantity
    val unitValueWidth = this.unitValue
    val totalWidth = this.total
    val actionsWidth = this.actions
    Row(modifier = Modifier.width(tableWidth)) {
        TableCell(article, articleWidth)
        TableCell(quantity, quantityWidth, center = true)
        TableCell(unitValue, unitValueWidth, center = true)
        TableCell(totalValue, totalWidth, center = true)
        Row(
            modifier = Modifier
                .width(actionsWidth)
                .border(0.8.dp, Color(0xFF3F453D))
                .background(Color.White)
                .padding(horizontal = 3.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            OutlinedButton(onClick = onEdit, modifier = Modifier.weight(1f), contentPadding = PaddingValues(0.dp)) {
                Text("Editar", fontSize = 9.sp)
            }
            OutlinedButton(onClick = onDelete, modifier = Modifier.weight(1f), contentPadding = PaddingValues(0.dp)) {
                Text("Quitar", fontSize = 9.sp)
            }
        }
    }
}

@Composable
private fun TableMetrics.ContributionSubtotal(label: String, value: String) {
    Row(modifier = Modifier.width(tableWidth)) {
        TableCell(label, article + quantity + unitValue, header = true)
        TableCell(value, total + actions, header = true, center = true)
    }
}

@Composable
private fun TableCell(
    text: String,
    width: Dp,
    header: Boolean = false,
    center: Boolean = false
) {
    Text(
        text = text,
        modifier = Modifier
            .width(width)
            .border(0.8.dp, Color(0xFF3F453D))
            .background(if (header) Color(0xFFF5F7F2) else Color.White)
            .padding(horizontal = 6.dp, vertical = 6.dp),
        textAlign = if (center || header) androidx.compose.ui.text.style.TextAlign.Center else androidx.compose.ui.text.style.TextAlign.Start,
        fontWeight = if (header) FontWeight.Bold else FontWeight.Normal,
        fontSize = 12.sp,
        color = TextDark
    )
}

@Composable
private fun <T> OptionList(
    items: List<T>,
    itemLabel: (T) -> String,
    onPick: (T) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items.forEach { item ->
            OutlinedButton(onClick = { onPick(item) }, modifier = Modifier.fillMaxWidth()) {
                Text(itemLabel(item))
            }
        }
    }
}

@Composable
private fun DecimalField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = modifier
    )
}

private fun money(value: Double): String = "$" + "%,.0f".format(value)

private fun formatQuantityOnly(value: Double): String {
    return if (value % 1.0 == 0.0) {
        "%,.0f".format(value)
    } else {
        "%,.2f".format(value)
    }
}

private fun friendlyMessage(message: String): String {
    return message
        .replace("PENDING_SYNC", "Pendiente de sincronizar")
        .replace("SYNCED", "Sincronizado")
        .replace("ERROR", "Error")
        .replace("CONFLICT", "Conflicto")
}

private fun friendlyPlanStatus(status: String): String {
    return when (status) {
        "draft" -> "Borrador offline"
        "ready_to_sync" -> "Pendiente de sincronizar"
        "synced" -> "Sincronizado"
        "pending_material" -> "Pendiente de material"
        "pending_review" -> "Pendiente de revision"
        "returned" -> "Devuelto"
        "approved" -> "Aprobado"
        "closed" -> "Cerrado"
        "conflict" -> "Conflicto"
        else -> status
    }
}

private fun validatePlanForSync(
    activities: List<PlanActivityEntity>,
    materials: List<PlanProjectMaterialEntity>,
    counterparts: List<PlanFamilyCounterpartEntity>,
    catalog: List<ActivityCatalogEntity>
): List<String> {
    val errors = mutableListOf<String>()
    if (activities.isEmpty()) {
        errors += "Agregue al menos una actividad antes de enviar el plan."
    }
    activities.forEach { item ->
        val activity = catalog.firstOrNull { it.id == item.activityId }
        if (activity?.requiresBaseline == true && item.baseline == null) {
            errors += "Complete la linea base de ${activity.name}."
        }
        if (activity?.requiresTarget == true && item.target == null) {
            errors += "Complete la meta de ${activity.name}."
        }
        if ((item.baseline ?: 0.0) < 0 || (item.target ?: 0.0) < 0) {
            errors += "La linea base y la meta no pueden ser negativas."
        }
    }
    materials.forEach {
        if (it.quantity <= 0) errors += "Todos los materiales deben tener cantidad mayor que cero."
    }
    counterparts.forEach {
        if (it.quantity <= 0) errors += "Todas las contrapartidas deben tener cantidad mayor que cero."
        if (it.estimatedUnitValue < 0) errors += "La contrapartida no puede tener valores negativos."
    }
    return errors.distinct()
}

private fun validatePlanForReview(
    activities: List<PlanActivityEntity>,
    materials: List<PlanProjectMaterialEntity>,
    counterparts: List<PlanFamilyCounterpartEntity>,
    catalog: List<ActivityCatalogEntity>
): List<String> {
    val errors = validatePlanForSync(activities, materials, counterparts, catalog).toMutableList()
    if (materials.isEmpty() && counterparts.isEmpty()) {
        errors += "Agregue materiales del proyecto o contrapartida familiar."
    }
    if (materials.any { it.materialId == null || it.provisionalName != null }) {
        errors += "Resuelva los materiales provisionales en la web antes de marcar listo para revision."
    }
    return errors.distinct()
}

private fun vegetalGroupLabel(value: String): String {
    return when (value) {
        "colinos" -> "Colinos (platano y pina)"
        "cacao" -> "Cacao"
        "frutales" -> "Frutales"
        "forestales_nativos" -> "Forestales nativos"
        "otro" -> "Otro vegetal"
        else -> "No seleccionado"
    }
}

private fun isVegetalPlanMaterial(item: PlanProjectMaterialEntity, materialNames: Map<String, MaterialCatalogEntity>): Boolean {
    val material = item.materialId?.let { materialNames[it] }
    return material?.let { isVegetalMaterial(it) } == true ||
        item.provisionalName.orEmpty().contains("vegetal", ignoreCase = true) ||
        item.provisionalName.orEmpty().contains("arbol", ignoreCase = true) ||
        item.provisionalName.orEmpty().contains("cacao", ignoreCase = true) ||
        item.provisionalName.orEmpty().contains("platano", ignoreCase = true) ||
        item.provisionalName.orEmpty().contains("piña", ignoreCase = true) ||
        item.provisionalName.orEmpty().contains("pina", ignoreCase = true)
}

private fun isVegetalMaterial(material: MaterialCatalogEntity): Boolean {
    val values = listOf(
        material.vegetalIndicatorGroup.orEmpty(),
        material.category.orEmpty(),
        material.name
    ).joinToString(" ").lowercase()
    return material.vegetalIndicatorGroup != null ||
        values.contains("vegetal") ||
        values.contains("colino") ||
        values.contains("platano") ||
        values.contains("plátano") ||
        values.contains("piña") ||
        values.contains("pina") ||
        values.contains("cacao") ||
        values.contains("frutal") ||
        values.contains("forestal") ||
        values.contains("arbol") ||
        values.contains("árbol")
}

private fun sameCatalogCounterpart(catalog: CounterpartCatalogEntity, item: PlanFamilyCounterpartEntity): Boolean {
    return catalog.name == item.name &&
        catalog.contributionType == item.contributionType &&
        catalog.suggestedUnit == item.unit
}
