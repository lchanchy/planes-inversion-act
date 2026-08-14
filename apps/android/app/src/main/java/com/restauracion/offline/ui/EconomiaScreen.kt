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
    val projects by repo.projects.collectAsState(initial = emptyList())
    val rondas by repo.economiaRondas().collectAsState(initial = emptyList())
    val encuestadores by repo.economiaEncuestadores().collectAsState(initial = emptyList())
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
    var encuestadorId by remember { mutableStateOf<String?>(null) }
    var fecha by remember { mutableStateOf(LocalDate.now().toString()) }

    val families by repo.families(projectId.orEmpty()).collectAsState(initial = emptyList())
    val family = families.firstOrNull { it.id == familyId }
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

    var observaciones by remember { mutableStateOf("") }
    var step by remember { mutableStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }

    // Bandeja de salida (lista) vs captura (asistente).
    var mode by remember { mutableStateOf("lista") }
    var sincronizando by remember { mutableStateOf(false) }
    val allEncuestas by repo.economiaEncuestasAll().collectAsState(initial = emptyList())
    val allFamilies by repo.economiaAllFamilies().collectAsState(initial = emptyList())
    val famNombre = allFamilies.associate { it.id to "${it.familyCode} - ${it.representativeName}" }
    val resetForm = {
        step = 0
        projectId = null; rondaId = null; familyId = null
        departamento = null; municipioId = null; veredaId = null
        encuestadorId = null; fecha = LocalDate.now().toString()
        cambioPersonas = null; ninos = ""; adolescentes = ""; jovenes = ""; adultos = ""; mayores = ""
        recibeApoyo = null; apoyoSel.clear(); apoyoValor.clear(); apoyoOtroNombre = ""
        recibePagos = null; pagoSel.clear(); pagoValor.clear(); valorJornal = ""
        catSel.clear(); prodSel.clear()
        pCantidad.clear(); pConsumo.clear(); pVendido.clear(); pPrecio.clear(); pMotivo.clear()
        pTemporalidad.clear(); pApoyoAct.clear(); pLugares.clear()
        observaciones = ""
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
            EcoPanel { Text(it, color = MaterialTheme.colorScheme.primary) }
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
                                                }
                                                EcoSyncChip(e.syncState)
                                            }
                                            if (e.syncState == SyncState.ERROR && e.lastError != null) {
                                                Text("Error de sync: ${e.lastError}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
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
                EcoSelector("Proyecto", projects.firstOrNull { it.id == projectId }?.name, projects.map { it.id to it.name }) {
                    projectId = it; familyId = null; departamento = null; municipioId = null; veredaId = null
                }
                EcoSelector("Ronda de monitoreo", rondas.firstOrNull { it.id == rondaId }?.nombre, rondas.map { it.id to it.nombre }) { rondaId = it }
                // Familia: filtro en cascada Departamento -> Municipio -> Vereda -> Familia
                // (hay muchas familias; se van acotando por territorio).
                if (family != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Familia", style = MaterialTheme.typography.bodySmall)
                            Text("${family.familyCode} - ${family.representativeName}", style = MaterialTheme.typography.bodyMedium)
                        }
                        OutlinedButton(onClick = { familyId = null }) { Text("Cambiar") }
                    }
                    Text("Departamento/Municipio: ${municipioNombre ?: "-"}", style = MaterialTheme.typography.bodySmall)
                    Text("Vereda o comunidad: ${veredaNombre ?: "-"}", style = MaterialTheme.typography.bodySmall)
                } else if (projectId == null) {
                    Text("Seleccione primero el proyecto.", style = MaterialTheme.typography.bodySmall)
                } else {
                    val municipiosDeFamilias = families.mapNotNull { it.municipalityId }.toSet()
                    val municById = municipalities.associateBy { it.id }
                    val departamentos = municipiosDeFamilias.mapNotNull { municById[it]?.department }.distinct().sorted()
                    if (departamentos.isEmpty()) {
                        Text(
                            "No hay familias descargadas (o falta actualizar). Vuelva al inicio y pulse \"Descargar\".",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    EcoSelector("Departamento", departamento, departamentos.map { it to it }) {
                        departamento = it; municipioId = null; veredaId = null
                    }
                    if (departamento != null) {
                        val municipios = municipalities
                            .filter { it.id in municipiosDeFamilias && it.department == departamento }
                            .sortedBy { it.name }
                        EcoSelector("Municipio", municipios.firstOrNull { it.id == municipioId }?.name, municipios.map { it.id to it.name }) {
                            municipioId = it; veredaId = null
                        }
                    }
                    if (municipioId != null) {
                        val veredaIds = families.filter { it.municipalityId == municipioId }.mapNotNull { it.villageId }.toSet()
                        val veredas = villages.filter { it.id in veredaIds }.sortedBy { it.name }
                        EcoSelector("Vereda (opcional)", veredas.firstOrNull { it.id == veredaId }?.name, veredas.map { it.id to it.name }) {
                            veredaId = it
                        }
                        val familiasFiltradas = families
                            .filter { it.municipalityId == municipioId && (veredaId == null || it.villageId == veredaId) }
                            .sortedBy { it.familyCode }
                        EcoSelector(
                            "Familia (${familiasFiltradas.size})",
                            null,
                            familiasFiltradas.map { it.id to "${it.familyCode} - ${it.representativeName}" }
                        ) { familyId = it }
                    }
                }
                EcoSelector("Encuestador", encuestadores.firstOrNull { it.id == encuestadorId }?.nombre, encuestadores.map { it.id to it.nombre }) { encuestadorId = it }
                OutlinedTextField(value = fecha, onValueChange = { fecha = it }, label = { Text("Fecha (AAAA-MM-DD)") }, modifier = Modifier.fillMaxWidth())
            }

            1 -> EcoPanel {
                EcoTitle("2. Personas del hogar")
                EcoSiNo("¿Cambió el número de personas en la familia?", cambioPersonas) { cambioPersonas = it }
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
                                unidad = if (p.esPecuario) "animales" else "kg",
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
                        guardando = true
                        scope.launch {
                            runCatching {
                                val existente = repo.economiaEncuestaForFamilyRonda(fid, rid)
                                val encuesta = EconomiaEncuestaEntity(
                                    id = existente?.id ?: java.util.UUID.randomUUID().toString(),
                                    projectId = pid,
                                    familyId = fid,
                                    rondaId = rid,
                                    equipoId = null,
                                    encuestadorId = encuestadorId,
                                    fecha = fecha,
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
                                    observaciones = observaciones.ifBlank { null }
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
                                        unidad = null,
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
                                repo.guardarEncuestaEconomia(encuesta, apoyos, pagos, productos)
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
        EcoDecimal(if (esPecuario) "Número producidos" else "Producido en un mes ($unidad)", cantidad, onCantidad)
        if (esPecuario) {
            EcoSelector("¿Cada cuánto los produce?", temporalidad.ifBlank { null }, TEMPORALIDADES) { onTemporalidad(it) }
        }
        EcoDecimal("¿Cuánto consume? ($unidad)", consumo, onConsumo)
        EcoDecimal("¿Cuánto vende? ($unidad)", vendido, onVendido)
        if (vendido.toDoubleOrNull() == 0.0) {
            OutlinedTextField(value = motivo, onValueChange = onMotivo, label = { Text("¿Por qué no vende este producto?") }, modifier = Modifier.fillMaxWidth())
        }
        if ((vendido.toDoubleOrNull() ?: 0.0) > 0.0) {
            EcoMoney("Precio de 1 $unidad en la región", precio, onPrecio)
            val ingreso = (vendido.toDoubleOrNull() ?: 0.0) * (precio.toDoubleOrNull() ?: 0.0)
            Text("Ingreso mensual estimado: $" + "%,.0f".format(ingreso), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
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
private fun EcoSelector(label: String, current: String?, options: List<Pair<String, String>>, onPick: (String) -> Unit) {
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

private fun pasoLabel(step: Int): String = when (step) {
    0 -> "Paso 1 de 4: Datos generales"
    1 -> "Paso 2 de 4: Personas del hogar"
    2 -> "Paso 3 de 4: Ingresos monetarios"
    else -> "Paso 4 de 4: Productos"
}

private fun validarPaso(step: Int, projectId: String?, rondaId: String?, familyId: String?): String? {
    if (step == 0) {
        if (projectId == null) return "Seleccione el proyecto."
        if (rondaId == null) return "Seleccione la ronda de monitoreo."
        if (familyId == null) return "Seleccione la familia."
    }
    return null
}
