package com.restauracion.offline.data.local

import kotlin.test.Test
import kotlin.test.assertEquals

class EconomiaIncomeTest {
    @Test
    fun `normaliza cada temporalidad al ingreso anual real`() {
        assertEquals(365.0, annualIncomeFactor("diario"))
        assertEquals(52.0, annualIncomeFactor("semanal"))
        assertEquals(24.0, annualIncomeFactor("quincenal"))
        assertEquals(12.0, annualIncomeFactor("mensual"))
        assertEquals(4.0, annualIncomeFactor("trimestral"))
        assertEquals(2.0, annualIncomeFactor("semestral"))
        assertEquals(1.0, annualIncomeFactor("anual"))
    }

    @Test
    fun `una cosecha anual no se multiplica por doce`() {
        val ingresoPeriodo = 10.0 * 50_000.0
        val ingresoAnual = ingresoPeriodo * annualIncomeFactor("anual")

        assertEquals(500_000.0, ingresoAnual)
        assertEquals(500_000.0 / 12.0, ingresoAnual / 12.0)
    }
}
