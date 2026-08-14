package com.restauracion.offline.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import com.restauracion.offline.data.local.SyncState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.restauracion.offline.data.AppContainer
import com.restauracion.offline.data.local.EconomiaEncuestaEntity
import com.restauracion.offline.data.local.EconomiaEncuestaProductoEntity
import com.restauracion.offline.data.local.EconomiaProductoEntity
import com.restauracion.offline.data.local.annualIncomeFactor
import com.restauracion.offline.data.repository.EconomiaApoyoInput
import com.restauracion.offline.data.repository.EconomiaPagoInput
import com.restauracion.offline.data.repository.EconomiaProductoInput
import kotlinx.coroutines.launch
import java.time.LocalDate

// Pantalla de captura de Economia Familiar (Fase 1c). Asistente por pasos, offline.
// Entrada propia desde el inicio con su propio selector de familia (incluye familias
// que no tienen plan de inversion). Guarda todo en Room (PENDING_SYNC) y la sincronizacion
// general (Sincronizar en el inicio) lo sube al servidor.
@Composable
fun EconomiaScreen(container: AppContainer, onBack: () -> Unit) {
    val repo = container.repository
    val scope = rememberCoroutineScope()

    // Catalogos
    val rondas by repo.economiaRondas().collectAsState(initial = emptyList())
    val categorias by repo.economiaCategorias().collectAsState(initial = emptyList())
    val productosCat by repo.economiaProductos().collectAsState(initial = emptyList())
    val tiposApoyo by repo.economiaTiposApoyo().collectAsState(initial = emptyList())
    val tiposPago by repo.economiaTiposPago().collectAsState(initial = emptyList())
    val lugaresVenta by repo.economiaLugaresVenta().collectAsState(initial = emptyList())
    val municipalities by repo.municipalities().collectAsState(initial = emptyList())
    val villages by repo.villages().collectAsState(initial = emptyList())

    // Seleccion principal
    var projectId by remember { mutableStateOf<String?>(null) }
    var rondaId by remember { mutableStateOf<String?>(null) }
    var familyId by remember { mutableStateOf<String?>(null) }
    var departamento by remember { mutableStateOf<String?>(null) }
    var municipioId by remember { mutableStateOf<String?>(null) }
    var veredaId by remember { mutableStateOf<String?>(null) }
    var fecha by remember { mutableStateOf(LocalDate.now().toString()) }
    var anio by remember { mutableStateOf(LocalDate.now().year.toString()) }
    var tipoMedicion by remember { mutableStateOf("linea_base") }
    var numeroMonitoreo by remember { mutableStateOf<Int?>(null) }

    val allFamilies by repo.economiaAllFamilies().collectAsState(initial = emptyList())
    val family = allFamilies.firstOrNull { it.id == familyId }
    val municipioNombre = family?.municipalityId?.let { mid -> municipalities.firstOrNull { it.id == mid }?.name }
    val veredaNombre = family?.villageId?.let { vid -> villages.firstOrNull { it.id == vid }?.name }

    // Hogar
    var cambioPersonas by remember { mutableStateOf<Boolean?>(null) }
    var ninos by remember { mutableStateOf("") }
    var adolescentes by remember { mutableStateOf("") }
    var jovenes by remember { mutableStateOf("") }
    var adultos by remember { mutableStateOf("") }
    var mayores by remember { mutableStateOf("") }

    // Ingresos monetarios
    var recibeApoyo by remember { mutableStateOf<Boolean?>(null) }
    val apoyoSel = remember { mutableStateMapOf<String, Boolean>() }          // tipoApoyoId -> marcado
    val apoyoValor = remember { mutableStateMapOf<String, String>() }         // tipoApoyoId -> valor
    var apoyoOtroNombre by remember { mutableStateOf("") }
    var recibePagos by remember { mutableStateOf<Boolean?>(null) }
    val pagoSel = remember { mutableStateMapOf<String, Boolean>() }
    val pagoValor = remember { mutableStateMapOf<String, String>() }
    var valorJornal by remember { mutableStateOf("") }

    // Productos
    val catSel = remember { mutableStateListOf<String>() }                    // categoriaIds
    val prodSel = remember { mutableStateListOf<String>() }                   // productoIds
    val pCantidad = remember { mutableStateMapOf<String, String>() }
    val pConsumo = remember { mutableStateMapOf<String, String>() }
    val pVendido = remember { mutableStateMapOf<String, String>() }
    val pPrecio = remember { mutableStateMapOf<String, String>() }
    val pMotivo = remember { mutableStateMapOf<String, String>() }
    val pTemporalidad = remember { mutableStateMapOf<String, String>() }
    val pApoyoAct = remember { mutableStateMapOf<String, Boolean>() }
    val pLugares = remember { mutableStateMapOf<String, SnapshotStringSet>() } // productoId -> set de lugarVentaId
    val otrosProductos = remember { mutableStateListOf<OtroProductoDraft>() }

    var observaciones by remember { mutableStateOf("") }
    var step by remember { mutableStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }

    // Bandeja de salida (lista) vs captura (asistente).
    var mode by remember { mutableStateOf("lista") }
    var sincronizando by remember { mutableStateOf(false) }
    var editandoId by remember { mutableStateOf<String?>(null) }
    val allEncuestas by repo.economiaEncuestasAll().collectAsState(initial = emptyList())
    val famNombre = allFamilies.associate { it.id to "${it.familyCode} - ${it.representativeName}" }
    val resetForm = {
        step = 0
        editandoId = null
        projectId = null; rondaId = null; familyId = null
        departamento = null; municipioId = null; veredaId = null
        fecha = LocalDate.now().toString()
        anio = LocalDate.now().year.toString(); tipoMedicion = "linea_base"; numeroMonitoreo = null
        cambioPersonas = null; ninos = ""; adolescentes = ""; jovenes = ""; adultos = ""; mayores = ""
        recibeApoyo = null; apoyoSel.clear(); apoyoValor.clear(); apoyoOtroNombre = ""
        recibePagos = null; pagoSel.clear(); pagoValor.clear(); valorJornal = ""
        catSel.clear(); prodSel.clear()
        pCantidad.clear(); pConsumo.clear(); pVendido.clear(); pPrecio.clear(); pMotivo.clear()
        pTemporalidad.clear(); pApoyoAct.clear(); pLugares.clear()
        otrosProductos.clear()
        observaciones = ""
    }
    // Cargar una encuesta existente en el asistente (editar una devuelta/pendiente).
    val editar: (EconomiaEncuestaEntity) -> Unit = { e ->
        scope.launch {
            resetForm()
            editandoId = e.id
            projectId = e.projectId
            rondaId = e.rondaId
            familyId = e.familyId
            val fam = allFamilies.firstOrNull { it.id == e.familyId }
            val muni = fam?.municipalityId?.let { mid -> municipalities.firstOrNull { it.id == mid } }
            departamento = muni?.department
            municipioId = fam?.municipalityId
            veredaId = fam?.villageId
            fecha = e.fecha
            anio = e.anio.toString()
            tipoMedicion = e.tipoMedicion
            numeroMonitoreo = e.numeroMonitoreo
            cambioPersonas = e.cambioNumPersonas
            ninos = e.personasNinos?.toString() ?: ""
            adolescentes = e.personasAdolescentes?.toString() ?: ""
            jovenes = e.personasJovenes?.toString() ?: ""
            adultos = e.personasAdultos?.toString() ?: ""
            mayores = e.personasMayores?.toString() ?: ""
            recibeApoyo = e.recibeApoyoGobierno
            recibePagos = e.recibeOtrosPagos
            valorJornal = numToStr(e.valorJornal)
            observaciones = e.observaciones ?: ""
            repo.economiaApoyosOnce(e.id).forEach { a ->
                apoyoSel[a.tipoApoyoId] = true
                apoyoValor[a.tipoApoyoId] = numToStr(a.valorMensual)
                if (a.nombreLibre != null) apoyoOtroNombre = a.nombreLibre
            }
            repo.economiaPagosOnce(e.id).forEach { p ->
                pagoSel[p.tipoPagoId] = true
                pagoValor[p.tipoPagoId] = numToStr(p.valorMensual)
            }
            repo.economiaProductosOnce(e.id).forEach { pr ->
                val catalogId = pr.productoId
                if (catalogId == null) {
                    val lugares = repo.economiaLugaresOnce(pr.id).map { it.lugarVentaId }.toSet()
                    otrosProductos.add(OtroProductoDraft.from(pr, lugares))
                    return@forEach
                }
                val cat = productosCat.firstOrNull { it.id == catalogId }
                if (cat != null && !catSel.contains(cat.categoriaId)) catSel.add(cat.categoriaId)
                if (!prodSel.contains(catalogId)) prodSel.add(catalogId)
                pCantidad[catalogId] = numToStr(pr.cantidadProducida)
                pConsumo[catalogId] = numToStr(pr.consumo)
                pVendido[catalogId] = numToStr(pr.vendido)
                pMotivo[catalogId] = pr.motivoNoVenta ?: ""
                pPrecio[catalogId] = numToStr(pr.precioUnitario)
                if (pr.temporalidad != null) pTemporalidad[catalogId] = pr.temporalidad
                if (pr.apoyoAct != null) pApoyoAct[catalogId] = pr.apoyoAct
                val lugares = repo.economiaLugaresOnce(pr.id).map { it.lugarVentaId }.toSet()
                if (lugares.isNotEmpty()) pLugares[catalogId] = SnapshotStringSet(lugares)
            }
            message = "Editando encuesta. Corrija y pulse \"Guardar encuesta\"."
            mode = "captura"
        }
        Unit
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        EcoPanel {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = { if (mode == "captura") mode = "lista" else onBack() }) { Text("Volver") }
                Column(modifier = Modifier.weight(1f)) {
                    Text("Economía Familiar", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    Text(if (mode == "captura") pasoLabel(step) else "Bandeja de encuestas", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        message?.let {
            val esError = it.startsWith("Corrija") || it.startsWith("Error") || it.startsWith("Falta") || it.contains("ya tiene")
            EcoPanel { Text(it, color = if (esError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary) }
        }

        if (mode == "lista") {
            EcoPanel {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { message = null; resetForm(); mode = "captura" }) { Text("Nueva encuesta") }
                    OutlinedButton(
                        enabled = !sincronizando,
                        onClick = {
                            sincronizando = true
                            scope.launch {
                                runCatching { repo.syncPending() }
                                    .onSuccess { message = "Sincronización enviada." }
                                    .onFailure { message = it.message ?: "Error al sincronizar." }
                                sincronizando = false
                            }
                        }
                    ) { Text(if (sincronizando) "Sincronizando..." else "Sincronizar") }
                }
                val pendientes = allEncuestas.count { it.syncState != SyncState.SYNCED }
                Text("${allEncuestas.size} encuesta(s) · $pendientes pendiente(s) de enviar", style = MaterialTheme.typography.bodySmall)
            }
            var outboxExpanded by remember { mutableStateOf(true) }
            Box(modifier = Modifier.fillMaxWidth().glassmorphism()) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Bandeja de salida (${allEncuestas.size})", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                            Text("Encuestas creadas y enviadas", style = MaterialTheme.typography.bodySmall)
                        }
                        OutlinedButton(onClick = { outboxExpanded = !outboxExpanded }) {
                            Text(if (outboxExpanded) "Ocultar" else "Abrir")
                        }
                    }
                    if (outboxExpanded) {
                        if (allEncuestas.isEmpty()) {
                            Text(
                                "No hay encuestas en la bandeja de salida.",
                                modifier = Modifier.padding(16.dp),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        } else {
                            var selectedTab by remember { mutableStateOf(0) }
                            val tabs = listOf("Solo guardados offline", "Sincronizados")
                            androidx.compose.material3.TabRow(selectedTabIndex = selectedTab) {
                                tabs.forEachIndexed { index, title ->
                                    androidx.compose.material3.Tab(
                                        selected = selectedTab == index,
                                        onClick = { selectedTab = index },
                                        text = { Text(title) }
                                    )
                                }
                            }
                            val mostradas = if (selectedTab == 0) {
                                allEncuestas.filter { it.syncState != SyncState.SYNCED }
                            } else {
                                allEncuestas.filter { it.syncState == SyncState.SYNCED }
                            }
                            if (mostradas.isEmpty()) {
                                Text(
                                    "No hay encuestas en esta categoría.",
                                    modifier = Modifier.padding(16.dp),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            } else {
                                mostradas.forEach { e ->
                                    Box(modifier = Modifier.fillMaxWidth().glassmorphism()) {
                                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(famNombre[e.familyId] ?: "(familia)", style = MaterialTheme.typography.titleSmall)
                                                    Text(
                                                        "${rondas.firstOrNull { it.id == e.rondaId }?.nombre ?: "-"} · ${e.fecha}",
                                                        style = MaterialTheme.typography.bodySmall
                                                    )
                                                    Text("Revisión: ${estadoRevisionLabel(e.estado)}", style = MaterialTheme.typography.bodySmall)
                                                    if (e.estado == "devuelta" && !e.notasRevision.isNullOrBlank()) {
                                                        Text(
                                                            "Corrección solicitada: ${e.notasRevision}",
                                                            style = MaterialTheme.typography.bodySmall,
                                                            color = MaterialTheme.colorScheme.error
                                                        )
                                                    }
                                                }
                                                EcoSyncChip(e.syncState)
                                            }
                                            if (e.syncState == SyncState.ERROR && e.lastError != null) {
                                                Text("Error de sync: ${e.lastError}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                                            }
                                            // Editable si no esta aprobada (offline/devuelta): corregir y reenviar.
                                            if (e.estado != "aprobada") {
                                                OutlinedButton(onClick = { editar(e) }) { Text("Editar") }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else {
        when (step) {
            0 -> EcoPanel {
                EcoTitle("1. Datos generales")
                val encuestaEditando = allEncuestas.firstOrNull { it.id == editandoId }
                if (encuestaEditando?.estado == "devuelta" && !encuestaEditando.notasRevision.isNullOrBlank()) {
                    Text(
                        "Corrección solicitada por el revisor: ${encuestaEditando.notasRevision}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                // Familia primero (cascada Departamento -> Municipio -> Vereda -> Familia).
                // El PROYECTO se toma de la familia; la RONDA se asigna sola segun lo que ya tenga.
                if (family != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Familia", style = MaterialTheme.typography.bodySmall)
                            Text("${family.familyCode} - ${family.representativeName}", style = MaterialTheme.typography.bodyMedium)
                        }
                        OutlinedButton(onClick = { familyId = null; projectId = null; rondaId = null }) { Text("Cambiar") }
                    }
                    Text("Departamento/Municipio: ${municipioNombre ?: "-"}", style = MaterialTheme.typography.bodySmall)
                    Text("Vereda o comunidad: ${veredaNombre ?: "-"}", style = MaterialTheme.typography.bodySmall)
                    val hechasIds = allEncuestas.filter { it.familyId == family.id && it.id != editandoId }.map { it.rondaId }.toSet()
                    val hechas = rondas.filter { it.id in hechasIds }.sortedBy { it.orden }
                    Text(
                        "Monitoreos realizados: ${if (hechas.isEmpty()) "ninguno" else hechas.joinToString { it.nombre }}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                } else {
                    val municipiosDeFamilias = allFamilies.mapNotNull { it.municipalityId }.toSet()
                    val municById = municipalities.associateBy { it.id }
                    val departamentos = municipiosDeFamilias.mapNotNull { municById[it]?.department }.distinct().sorted()
                    if (departamentos.isEmpty()) {
                        Text(
                            "No hay familias descargadas (o falta actualizar). Vuelva al menú y pulse \"Descargar\".",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    AppSelector("Departamento", departamento, departamentos.map { it to it }) {
                        departamento = it; municipioId = null; veredaId = null
                    }
                    if (departamento != null) {
                        val municipios = municipalities
                            .filter { it.id in municipiosDeFamilias && it.department == departamento }
                            .sortedBy { it.name }
                        AppSelector("Municipio", municipios.firstOrNull { it.id == municipioId }?.name, municipios.map { it.id to it.name }) {
                            municipioId = it; veredaId = null
                        }
                    }
                    if (municipioId != null) {
                        val veredaIds = allFamilies.filter { it.municipalityId == municipioId }.mapNotNull { it.villageId }.toSet()
                        val veredas = villages.filter { it.id in veredaIds }.sortedBy { it.name }
                        AppSelector("Vereda (opcional)", veredas.firstOrNull { it.id == veredaId }?.name, veredas.map { it.id to it.name }) {
                            veredaId = it
                        }
                        val familiasFiltradas = allFamilies
                            .filter { it.municipalityId == municipioId && (veredaId == null || it.villageId == veredaId) }
                            .sortedBy { it.familyCode }
                        AppFamilySelector(
                            "Familia (${familiasFiltradas.size})",
                            familiasFiltradas.map { it.id to "${it.familyCode} - ${it.representativeName}" }
                        ) { fid ->
                            familyId = fid
                            projectId = allFamilies.firstOrNull { it.id == fid }?.projectId
                            // Ronda automatica: la primera (por orden) que la familia aun no tiene.
                            val hechas = allEncuestas.filter { it.familyId == fid }.map { it.rondaId }.toSet()
                            rondaId = rondas.sortedBy { it.orden }.firstOrNull { it.id !in hechas }?.id
                                ?: rondas.sortedBy { it.orden }.firstOrNull()?.id
                            val previas = allEncuestas.filter { it.familyId == fid && it.estado == "aprobada" }
                            val tieneBase = previas.any { it.tipoMedicion == "linea_base" }
                            tipoMedicion = if (tieneBase) "monitoreo" else "linea_base"
                            numeroMonitoreo = if (tieneBase) (previas.mapNotNull { it.numeroMonitoreo }.maxOrNull() ?: 0) + 1 else null
                        }
                    }
                }
                OutlinedTextField(value = fecha, onValueChange = { fecha = it }, label = { Text("Fecha (AAAA-MM-DD)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = anio, onValueChange = { anio = it.filter(Char::isDigit).take(4) }, label = { Text("Año del monitoreo") }, modifier = Modifier.fillMaxWidth())
                Text(if (tipoMedicion == "linea_base") "Línea base" else "Monitoreo ${numeroMonitoreo ?: 1}", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                // Ronda de monitoreo (ultimo): asignada automaticamente segun lo que ya tiene la familia.
                if (family != null) {
                    val rondaNombre = rondas.firstOrNull { it.id == rondaId }?.nombre
                    if (rondaNombre != null) {
                        Text("Ronda de monitoreo: $rondaNombre", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                        Text("Se asigna sola: es la que le corresponde a esta familia.", style = MaterialTheme.typography.bodySmall)
                    } else {
                        Text("Esta familia ya tiene todos los monitoreos registrados.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                    }
                }
            }

            1 -> EcoPanel {
                EcoTitle("2. Personas del hogar")
                EcoSiNo("¿Cambió el número de personas en la familia?", cambioPersonas) { cambio ->
                    cambioPersonas = cambio
                    if (!cambio) allEncuestas.filter { it.familyId == familyId && it.estado == "aprobada" }
                        .maxByOrNull { it.anio }?.let { previa ->
                            ninos=previa.personasNinos?.toString().orEmpty(); adolescentes=previa.personasAdolescentes?.toString().orEmpty()
                            jovenes=previa.personasJovenes?.toString().orEmpty(); adultos=previa.personasAdultos?.toString().orEmpty()
                            mayores=previa.personasMayores?.toString().orEmpty()
                        }
                }
                EcoInt("0-11 Niños/as", ninos) { ninos = it }
                EcoInt("12-17 Adolescentes", adolescentes) { adolescentes = it }
                EcoInt("18-28 Jóvenes", jovenes) { jovenes = it }
                EcoInt("29-64 Adultos", adultos) { adultos = it }
                EcoInt("65+ Adultos mayores", mayores) { mayores = it }
                val total = listOf(ninos, adolescentes, jovenes, adultos, mayores).sumOf { it.toIntOrNull() ?: 0 }
                Text("Total de personas: $total", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            }

            2 -> EcoPanel {
                EcoTitle("3. Ingresos monetarios")
                EcoSiNo("¿El hogar recibe apoyo económico de algún programa de gobierno?", recibeApoyo) { recibeApoyo = it }
                if (recibeApoyo == true) {
                    tiposApoyo.forEach { t ->
                        val marcado = apoyoSel[t.id] == true
                        EcoCheck(t.nombre, marcado) { apoyoSel[t.id] = it }
                        if (marcado) {
                            EcoMoney("Valor mensual (${t.nombre})", apoyoValor[t.id].orEmpty()) { apoyoValor[t.id] = it }
                            if (t.codigo == "otro") {
                                OutlinedTextField(value = apoyoOtroNombre, onValueChange = { apoyoOtroNombre = it }, label = { Text("Nombre del apoyo (otro)") }, modifier = Modifier.fillMaxWidth())
                            }
                        }
                    }
                    HorizontalDivider()
                }
                EcoSiNo("¿Reciben otros pagos o ayudas en dinero de forma recurrente?", recibePagos) { recibePagos = it }
                if (recibePagos == true) {
                    tiposPago.forEach { t ->
                        val marcado = pagoSel[t.id] == true
                        EcoCheck(t.nombre, marcado) { pagoSel[t.id] = it }
                        if (marcado) {
                            EcoMoney("Valor mensual (${t.nombre})", pagoValor[t.id].orEmpty()) { pagoValor[t.id] = it }
                        }
                    }
                    HorizontalDivider()
                }
                EcoMoney("Valor del jornal en la zona por día", valorJornal) { valorJornal = it }
            }

            3 -> EcoPanel {
                EcoTitle("4. Productos que produce la familia")
                Text("Marque las categorías y luego los productos.", style = MaterialTheme.typography.bodySmall)
                categorias.forEach { c ->
                    val marcada = catSel.contains(c.id)
                    EcoCheck(c.nombre, marcada) { on -> if (on) { if (!catSel.contains(c.id)) catSel.add(c.id) } else catSel.remove(c.id) }
                }
                HorizontalDivider()
                categorias.filter { catSel.contains(it.id) }.forEach { c ->
                    Text(c.nombre, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                    productosCat.filter { it.categoriaId == c.id }.forEach { p ->
                        val marcado = prodSel.contains(p.id)
                        EcoCheck(p.nombre, marcado) { on -> if (on) { if (!prodSel.contains(p.id)) prodSel.add(p.id) } else prodSel.remove(p.id) }
                        if (marcado) {
                            ProductoDetalle(
                                unidad = p.unidadBase,
                                esPecuario = p.esPecuario,
                                cantidad = pCantidad[p.id].orEmpty(), onCantidad = { pCantidad[p.id] = it },
                                temporalidad = pTemporalidad[p.id].orEmpty(), onTemporalidad = { pTemporalidad[p.id] = it },
                                consumo = pConsumo[p.id].orEmpty(), onConsumo = { pConsumo[p.id] = it },
                                vendido = pVendido[p.id].orEmpty(), onVendido = { pVendido[p.id] = it },
                                motivo = pMotivo[p.id].orEmpty(), onMotivo = { pMotivo[p.id] = it },
                                precio = pPrecio[p.id].orEmpty(), onPrecio = { pPrecio[p.id] = it },
                                lugares = lugaresVenta.map { it.id to it.nombre },
                                lugaresSel = pLugares[p.id]?.values ?: emptySet(),
                                onToggleLugar = { id, on ->
                                    val set = pLugares.getOrPut(p.id) { SnapshotStringSet() }
                                    if (on) set.values = set.values + id else set.values = set.values - id
                                    pLugares[p.id] = SnapshotStringSet(set.values)
                                },
                                apoyoAct = pApoyoAct[p.id], onApoyoAct = { pApoyoAct[p.id] = it }
                            )
                            HorizontalDivider()
                        }
                    }
                }
                EcoTitle("Otros productos")
                otrosProductos.forEachIndexed { index, otro ->
                    OtroProductoEditor(otro, lugaresVenta.map { it.id to it.nombre })
                    OutlinedButton(onClick = { otrosProductos.removeAt(index) }) { Text("Quitar producto") }
                    HorizontalDivider()
                }
                OutlinedButton(onClick = { otrosProductos.add(OtroProductoDraft()) }) { Text("Agregar otro producto") }
                OutlinedTextField(value = observaciones, onValueChange = { observaciones = it }, label = { Text("Observaciones (opcional)") }, modifier = Modifier.fillMaxWidth())
            }
        }

        // Navegacion del asistente
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (step > 0) OutlinedButton(onClick = { step-- }) { Text("Atrás") }
            if (step < 3) {
                Button(
                    onClick = {
                        val err = validarPaso(step, projectId, rondaId, familyId)
                        if (err != null) message = err else { message = null; step++ }
                    }
                ) { Text("Siguiente") }
            } else {
                Button(
                    enabled = !guardando,
                    onClick = {
                        val pid = projectId; val rid = rondaId; val fid = familyId
                        if (pid == null || rid == null || fid == null) { message = "Falta proyecto, ronda o familia."; return@Button }
                        val errores = validarEncuestaCompleta(
                            anio, tipoMedicion, cambioPersonas, ninos, adolescentes, jovenes, adultos, mayores,
                            recibeApoyo, apoyoSel, apoyoValor, apoyoOtroNombre, tiposApoyo.associate { it.id to it.codigo },
                            recibePagos, pagoSel, pagoValor, prodSel, productosCat.associateBy { it.id },
                            pCantidad, pConsumo, pVendido, pPrecio, pMotivo, pTemporalidad, pApoyoAct, pLugares, otrosProductos
                        )
                        if (allEncuestas.any { it.familyId == fid && it.anio == anio.toIntOrNull() && it.id != editandoId }) {
                            message = "Esta familia ya tiene una encuesta en el año $anio. Edite la existente."; return@Button
                        }
                        if (errores.isNotEmpty()) { message = "Corrija ${errores.size} inconsistencia(s):\n• " + errores.joinToString("\n• "); return@Button }
                        guardando = true
                        scope.launch {
                            runCatching {
                                val existente = repo.economiaEncuestaForFamilyRonda(fid, rid)
                                val encuesta = EconomiaEncuestaEntity(
                                    id = editandoId ?: existente?.id ?: java.util.UUID.randomUUID().toString(),
                                    projectId = pid,
                                    familyId = fid,
                                    rondaId = rid,
                                    equipoId = null,
                                    encuestadorId = null,
                                    fecha = fecha,
                                    anio = anio.toInt(),
                                    tipoMedicion = tipoMedicion,
                                    numeroMonitoreo = numeroMonitoreo,
                                    cambioNumPersonas = cambioPersonas,
                                    personasNinos = ninos.toIntOrNull(),
                                    personasAdolescentes = adolescentes.toIntOrNull(),
                                    personasJovenes = jovenes.toIntOrNull(),
                                    personasAdultos = adultos.toIntOrNull(),
                                    personasMayores = mayores.toIntOrNull(),
                                    recibeApoyoGobierno = recibeApoyo,
                                    recibeOtrosPagos = recibePagos,
                                    valorJornal = valorJornal.toDoubleOrNull(),
                                    estado = "completada",
                                    observaciones = observaciones.ifBlank { null },
                                    esPiloto = existente?.esPiloto
                                        ?: (family?.familyCode?.startsWith("PILOTO-", ignoreCase = true) == true)
                                )
                                val apoyos = if (recibeApoyo == true) tiposApoyo.filter { apoyoSel[it.id] == true }.map {
                                    EconomiaApoyoInput(it.id, apoyoValor[it.id]?.toDoubleOrNull(), if (it.codigo == "otro") apoyoOtroNombre.ifBlank { null } else null)
                                } else emptyList()
                                val pagos = if (recibePagos == true) tiposPago.filter { pagoSel[it.id] == true }.map {
                                    EconomiaPagoInput(it.id, pagoValor[it.id]?.toDoubleOrNull())
                                } else emptyList()
                                val productos = prodSel.mapNotNull { prodId ->
                                    val cat = productosCat.firstOrNull { it.id == prodId } ?: return@mapNotNull null
                                    val vendido = pVendido[prodId]?.toDoubleOrNull()
                                    EconomiaProductoInput(
                                        productoId = prodId,
                                        nombreOtro = null,
                                        unidad = cat.unidadBase,
                                        esPecuario = cat.esPecuario,
                                        temporalidad = pTemporalidad[prodId]?.ifBlank { null },
                                        cantidadProducida = pCantidad[prodId]?.toDoubleOrNull(),
                                        consumo = pConsumo[prodId]?.toDoubleOrNull(),
                                        vendido = vendido,
                                        motivoNoVenta = if (vendido == 0.0) pMotivo[prodId]?.ifBlank { null } else null,
                                        precioUnitario = pPrecio[prodId]?.toDoubleOrNull(),
                                        apoyoAct = pApoyoAct[prodId],
                                        lugaresVentaIds = (pLugares[prodId]?.values ?: emptySet()).toList()
                                    )
                                }
                                val productosOtros = otrosProductos.map { it.toInput() }
                                repo.guardarEncuestaEconomia(encuesta, apoyos, pagos, productos + productosOtros)
                            }.onSuccess {
                                guardando = false
                                message = "Encuesta guardada. Quedó en la bandeja como pendiente; pulse \"Sincronizar\" para enviarla."
                                resetForm()
                                mode = "lista"
                            }.onFailure {
                                guardando = false
                                message = it.message ?: "No fue posible guardar la encuesta."
                            }
                        }
                    }
                ) { Text(if (guardando) "Guardando..." else "Guardar encuesta") }
            }
        }
        }
    }
}

@Composable
private fun EcoSyncChip(state: SyncState) {
    val label = when (state) {
        SyncState.SYNCED -> "Sincronizada"
        SyncState.PENDING_SYNC -> "Pendiente"
        SyncState.ERROR -> "Error"
        SyncState.CONFLICT -> "Conflicto"
    }
    val color = when (state) {
        SyncState.SYNCED -> Color(0xFF145F3B)
        SyncState.ERROR -> Color(0xFFB42318)
        else -> MaterialTheme.colorScheme.primary
    }
    Surface(shape = RoundedCornerShape(8.dp), color = color.copy(alpha = 0.12f)) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.bodySmall,
            color = color
        )
    }
}

// Envoltura de estado observable para un conjunto de ids (lugares de venta por producto).
private class SnapshotStringSet(initial: Set<String> = emptySet()) {
    var values by mutableStateOf(initial)
}

private class OtroProductoDraft {
    var id by mutableStateOf(java.util.UUID.randomUUID().toString())
    var nombre by mutableStateOf("")
    var unidad by mutableStateOf("kg")
    var esPecuario by mutableStateOf(false)
    var temporalidad by mutableStateOf("mensual")
    var cantidad by mutableStateOf("")
    var consumo by mutableStateOf("")
    var vendido by mutableStateOf("")
    var motivo by mutableStateOf("")
    var precio by mutableStateOf("")
    var apoyoAct by mutableStateOf<Boolean?>(null)
    var lugares by mutableStateOf<Set<String>>(emptySet())

    fun toInput() = EconomiaProductoInput(
        id = id, productoId = null, nombreOtro = nombre.trim(), unidad = unidad,
        esPecuario = esPecuario, temporalidad = temporalidad,
        cantidadProducida = cantidad.toDoubleOrNull(), consumo = consumo.toDoubleOrNull(),
        vendido = vendido.toDoubleOrNull(), motivoNoVenta = if (vendido.toDoubleOrNull() == 0.0) motivo.trim() else null,
        precioUnitario = precio.toDoubleOrNull(), apoyoAct = apoyoAct, lugaresVentaIds = lugares.toList()
    )

    companion object {
        fun from(p: EconomiaEncuestaProductoEntity, lugares: Set<String>) = OtroProductoDraft().also {
            it.id=p.id; it.nombre=p.nombreOtro.orEmpty(); it.unidad=p.unidad ?: "kg"; it.esPecuario=p.esPecuario
            it.temporalidad=p.temporalidad ?: "mensual"; it.cantidad=numToStr(p.cantidadProducida)
            it.consumo=numToStr(p.consumo); it.vendido=numToStr(p.vendido); it.motivo=p.motivoNoVenta.orEmpty()
            it.precio=numToStr(p.precioUnitario); it.apoyoAct=p.apoyoAct; it.lugares=lugares
        }
    }
}

@Composable private fun OtroProductoEditor(item: OtroProductoDraft, lugares: List<Pair<String,String>>) {
    OutlinedTextField(item.nombre, { item.nombre=it }, label={Text("Nombre del otro producto")}, modifier=Modifier.fillMaxWidth())
    AppSelector("Unidad", UNIDADES.firstOrNull { it.first==item.unidad }?.second, UNIDADES) { item.unidad=it; item.esPecuario=it=="animal" }
    ProductoDetalle(item.unidad,item.esPecuario,item.cantidad,{item.cantidad=it},item.temporalidad,{item.temporalidad=it},
        item.consumo,{item.consumo=it},item.vendido,{item.vendido=it},item.motivo,{item.motivo=it},item.precio,{item.precio=it},
        lugares,item.lugares,{id,on->item.lugares=if(on)item.lugares+id else item.lugares-id},item.apoyoAct,{item.apoyoAct=it})
}

private fun validarEncuestaCompleta(
    anio:String,tipoMedicion:String,cambio:Boolean?,ninos:String,adolescentes:String,jovenes:String,adultos:String,mayores:String,
    recibeApoyo:Boolean?, apoyoSel:Map<String,Boolean>, apoyoValor:Map<String,String>, apoyoOtro:String, apoyoCodigos:Map<String,String>,
    recibePagos:Boolean?, pagoSel:Map<String,Boolean>, pagoValor:Map<String,String>, prodSel:List<String>, productos:Map<String,EconomiaProductoEntity>,
    cantidad:Map<String,String>,consumo:Map<String,String>,vendido:Map<String,String>,precio:Map<String,String>,motivo:Map<String,String>,
    temporalidad:Map<String,String>,apoyoAct:Map<String,Boolean>,lugares:Map<String,SnapshotStringSet>,otros:List<OtroProductoDraft>
):List<String> {
    val e=mutableListOf<String>()
    if(anio.toIntOrNull() !in 2000..2100)e += "Ingrese un año válido."
    if(cambio==null)e += "Indique si cambió el número de personas."
    if((tipoMedicion=="linea_base" || cambio==true) && listOf(ninos,adolescentes,jovenes,adultos,mayores).any{it.isBlank()})e += "Complete todos los grupos de edad."
    if(recibeApoyo==null)e += "Responda si recibe apoyos del Gobierno."
    if(recibeApoyo==true){ val ids=apoyoSel.filterValues{it}.keys; if(ids.isEmpty())e += "Seleccione al menos un apoyo."; ids.forEach{if((apoyoValor[it]?.toDoubleOrNull()?:0.0)<=0)e += "Registre el valor del apoyo seleccionado."; if(apoyoCodigos[it]=="otro"&&apoyoOtro.isBlank())e += "Escriba el nombre del otro apoyo."} }
    if(recibePagos==null)e += "Responda si recibe otros pagos."
    if(recibePagos==true){val ids=pagoSel.filterValues{it}.keys;if(ids.isEmpty())e += "Seleccione al menos otro ingreso.";ids.forEach{if((pagoValor[it]?.toDoubleOrNull()?:0.0)<=0)e += "Registre el valor del otro ingreso."}}
    fun validarProducto(nombre:String,pecuario:Boolean,c:String,co:String,v:String,p:String,m:String,t:String,a:Boolean?,ls:Set<String>){
        val q=c.toDoubleOrNull();val qc=co.toDoubleOrNull()?:0.0;val qv=v.toDoubleOrNull()?:0.0;val pp=p.toDoubleOrNull()?:0.0
        if(q==null||q<0)e += "$nombre: registre la cantidad producida."
        if(q!=null&&qc+qv>q)e += "$nombre: consumo más venta supera la producción."
        if(qv>0&&pp<=0)e += "$nombre: registre el precio unitario."
        if(qv>0&&ls.isEmpty())e += "$nombre: seleccione al menos un lugar de venta."
        if(qv==0.0&&m.isBlank())e += "$nombre: indique por qué no vende."
        if(t.isBlank())e += "$nombre: seleccione la temporalidad."
        if(a==null)e += "$nombre: indique si tiene apoyo de ACT."
    }
    prodSel.forEach{id->productos[id]?.let{p->validarProducto(p.nombre,p.esPecuario,cantidad[id].orEmpty(),consumo[id].orEmpty(),vendido[id].orEmpty(),precio[id].orEmpty(),motivo[id].orEmpty(),temporalidad[id].orEmpty(),apoyoAct[id],lugares[id]?.values?:emptySet())}}
    otros.forEach{o->if(o.nombre.isBlank())e += "Otro producto: escriba el nombre." else validarProducto(o.nombre,o.esPecuario,o.cantidad,o.consumo,o.vendido,o.precio,o.motivo,o.temporalidad,o.apoyoAct,o.lugares)}
    return e.distinct()
}

@Composable
private fun ProductoDetalle(
    unidad: String,
    esPecuario: Boolean,
    cantidad: String, onCantidad: (String) -> Unit,
    temporalidad: String, onTemporalidad: (String) -> Unit,
    consumo: String, onConsumo: (String) -> Unit,
    vendido: String, onVendido: (String) -> Unit,
    motivo: String, onMotivo: (String) -> Unit,
    precio: String, onPrecio: (String) -> Unit,
    lugares: List<Pair<String, String>>,
    lugaresSel: Set<String>,
    onToggleLugar: (String, Boolean) -> Unit,
    apoyoAct: Boolean?, onApoyoAct: (Boolean) -> Unit
) {
    Column(modifier = Modifier.padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        EcoDecimal(if (esPecuario) "Número producidos por periodo" else "Cantidad producida por periodo ($unidad)", cantidad, onCantidad)
        AppSelector("¿Cada cuánto obtiene esta producción?", temporalidad.ifBlank { null }, TEMPORALIDADES) { onTemporalidad(it) }
        EcoDecimal("¿Cuánto consume? ($unidad)", consumo, onConsumo)
        EcoDecimal("¿Cuánto vende? ($unidad)", vendido, onVendido)
        if (vendido.toDoubleOrNull() == 0.0) {
            OutlinedTextField(value = motivo, onValueChange = onMotivo, label = { Text("¿Por qué no vende este producto?") }, modifier = Modifier.fillMaxWidth())
        }
        if ((vendido.toDoubleOrNull() ?: 0.0) > 0.0) {
            EcoMoney("Precio de 1 $unidad en la región", precio, onPrecio)
            val ingresoPeriodo = (vendido.toDoubleOrNull() ?: 0.0) * (precio.toDoubleOrNull() ?: 0.0)
            val factorAnual = annualIncomeFactor(temporalidad)
            val ingresoAnual = ingresoPeriodo * factorAnual
            Text("Ingreso mensual equivalente: $" + "%,.0f".format(ingresoAnual / 12.0), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            Text("Ingreso anual equivalente: $" + "%,.0f".format(ingresoAnual), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            Text("Lugar(es) de venta:", style = MaterialTheme.typography.bodySmall)
            lugares.forEach { (id, nombre) ->
                EcoCheck(nombre, lugaresSel.contains(id)) { on -> onToggleLugar(id, on) }
            }
        }
        EcoSiNo("¿Esta actividad es con apoyo de ACT?", apoyoAct) { onApoyoAct(it) }
    }
}

// ---------- Helpers de UI (locales, estilo consistente con glassmorphism) ----------
@Composable
private fun EcoPanel(content: @Composable ColumnScope.() -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().glassmorphism()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
    }
}

@Composable
private fun EcoTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
}

@Composable
internal fun AppSelector(label: String, current: String?, options: List<Pair<String, String>>, onPick: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall)
        Box {
            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                Text(current ?: "Seleccionar...")
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { (id, text) ->
                    DropdownMenuItem(text = { Text(text) }, onClick = { expanded = false; onPick(id) })
                }
            }
        }
    }
}

@Composable
internal fun AppFamilySelector(label: String, options: List<Pair<String, String>>, onPick: (String) -> Unit) {
    var query by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    val suggestions = if (query.isBlank()) emptyList() else options
        .filter { (_, text) -> text.contains(query.trim(), ignoreCase = true) }
        .take(3)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text(label) },
            placeholder = { Text("Escriba código o nombre") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        Box {
            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                Text("Seleccionar de la lista")
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { (id, text) ->
                    DropdownMenuItem(
                        text = { Text(text) },
                        onClick = { expanded = false; query = ""; onPick(id) }
                    )
                }
            }
        }
        suggestions.forEach { (id, text) ->
            OutlinedButton(
                onClick = { query = ""; onPick(id) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(text)
            }
        }
        if (query.isNotBlank() && suggestions.isEmpty()) {
            Text("No se encontraron familias.", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun EcoSiNo(label: String, value: Boolean?, onChange: (Boolean) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(onClick = { onChange(true) }) { Text("Sí") }
            OutlinedButton(onClick = { onChange(false) }) { Text("No") }
            if (value != null) Text(if (value) "Sí" else "No", modifier = Modifier.padding(start = 4.dp), color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun EcoCheck(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(if (checked) "☑" else "☐")
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun EcoInt(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { s -> onChange(s.filter { it.isDigit() }) },
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun EcoDecimal(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun EcoMoney(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { s -> onChange(s.filter { it.isDigit() || it == '.' }) },
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.fillMaxWidth()
    )
}

private val TEMPORALIDADES = listOf(
    "diario" to "Diario", "semanal" to "Semanal", "quincenal" to "Quincenal", "mensual" to "Mensual",
    "trimestral" to "Trimestral", "semestral" to "Semestral", "anual" to "Anual"
)
private val UNIDADES = listOf("g" to "Gramos","kg" to "Kilogramos","litro" to "Litros","unidad" to "Unidades","animal" to "Animales")

private fun numToStr(v: Double?): String =
    v?.let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() } ?: ""

private fun estadoRevisionLabel(estado: String): String = when (estado) {
    "aprobada" -> "Aprobada"
    "devuelta" -> "Devuelta (corregir y reenviar)"
    "cerrada" -> "Cerrada"
    "borrador" -> "Borrador"
    else -> "Enviada (pendiente de revisión)"
}

private fun pasoLabel(step: Int): String = when (step) {
    0 -> "Paso 1 de 4: Datos generales"
    1 -> "Paso 2 de 4: Personas del hogar"
    2 -> "Paso 3 de 4: Ingresos monetarios"
    else -> "Paso 4 de 4: Productos"
}

private fun validarPaso(step: Int, projectId: String?, rondaId: String?, familyId: String?): String? {
    if (step == 0) {
        if (familyId == null) return "Seleccione la familia."
        if (projectId == null) return "No fue posible determinar el proyecto de la familia."
        if (rondaId == null) return "Esta familia ya tiene todos los monitoreos registrados."
    }
    return null
}
