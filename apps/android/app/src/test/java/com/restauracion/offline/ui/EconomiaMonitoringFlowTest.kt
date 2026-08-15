package com.restauracion.offline.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class EconomiaMonitoringFlowTest {
    private val rounds = listOf("base" to 0, "m1" to 1, "m2" to 2)

    @Test
    fun `familia nueva inicia en linea base`() {
        val next = nextEconomiaMeasurement(rounds, emptySet(), emptyList())

        assertEquals("base", next.roundId)
        assertEquals("linea_base", next.type)
        assertNull(next.monitorNumber)
    }

    @Test
    fun `linea base aprobada habilita solamente monitoreo uno`() {
        val next = nextEconomiaMeasurement(rounds, setOf("base"), listOf("linea_base" to null))

        assertEquals("m1", next.roundId)
        assertEquals("monitoreo", next.type)
        assertEquals(1, next.monitorNumber)
    }

    @Test
    fun `monitoreos avanzan en orden sin saltos`() {
        val next = nextEconomiaMeasurement(
            rounds,
            setOf("base", "m1"),
            listOf("linea_base" to null, "monitoreo" to 1)
        )

        assertEquals("m2", next.roundId)
        assertEquals(2, next.monitorNumber)
    }

    @Test
    fun `no reutiliza linea base cuando todas las rondas estan registradas`() {
        val next = nextEconomiaMeasurement(
            rounds,
            setOf("base", "m1", "m2"),
            listOf("linea_base" to null, "monitoreo" to 1, "monitoreo" to 2)
        )

        assertNull(next.roundId)
        assertEquals(3, next.monitorNumber)
    }

    @Test
    fun `bloquea avance si falta familia proyecto o ronda`() {
        assertEquals("Seleccione la familia.", validarPaso(0, null, null, null))
        assertEquals("No fue posible determinar el proyecto de la familia.", validarPaso(0, null, "base", "familia"))
        assertEquals("Esta familia ya tiene todos los monitoreos registrados.", validarPaso(0, "proyecto", null, "familia"))
        assertNull(validarPaso(0, "proyecto", "base", "familia"))
    }
}
