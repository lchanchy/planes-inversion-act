package com.restauracion.offline.data.repository

import com.restauracion.offline.data.local.SyncState
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EconomiaSyncPolicyTest {
    @Test
    fun `download never overwrites unsent local work`() {
        assertFalse(shouldRefreshEconomiaFromServer(SyncState.PENDING_SYNC, false))
        assertFalse(shouldRefreshEconomiaFromServer(SyncState.ERROR, false))
    }

    @Test
    fun `resolved conflict refreshes while pending conflict remains local`() {
        assertFalse(shouldRefreshEconomiaFromServer(SyncState.CONFLICT, true))
        assertTrue(shouldRefreshEconomiaFromServer(SyncState.CONFLICT, false))
    }

    @Test
    fun `new and synchronized surveys accept complete server snapshot`() {
        assertTrue(shouldRefreshEconomiaFromServer(null, false))
        assertTrue(shouldRefreshEconomiaFromServer(SyncState.SYNCED, false))
    }
}
