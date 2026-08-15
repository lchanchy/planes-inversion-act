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

    @Test
    fun `sync diagnostics remove credentials and limit message size`() {
        val jwt = "eyJabcdefghijk.abcdefghijk.abcdefghijk"
        val sanitized = sanitizeSyncError("Bearer secret-token access_token=private $jwt " + "x".repeat(600))

        assertFalse(sanitized.contains("secret-token"))
        assertFalse(sanitized.contains("private"))
        assertFalse(sanitized.contains(jwt))
        assertTrue(sanitized.length <= 500)
    }
}
