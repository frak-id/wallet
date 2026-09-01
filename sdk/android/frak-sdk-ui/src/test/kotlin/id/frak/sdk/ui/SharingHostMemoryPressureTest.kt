package id.frak.sdk.ui

import android.content.ComponentCallbacks2
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SharingHostMemoryPressureTest {
    @Test
    fun `a backgrounded UI is not memory pressure`() {
        assertFalse(SharingHost.isMemoryPressure(ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN))
    }

    @Test
    fun `pressure while running is pressure, even below the UI_HIDDEN value`() {
        assertTrue(SharingHost.isMemoryPressure(ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW))
        assertTrue(SharingHost.isMemoryPressure(ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL))
    }

    @Test
    fun `pressure while backgrounded is pressure`() {
        assertTrue(SharingHost.isMemoryPressure(ComponentCallbacks2.TRIM_MEMORY_BACKGROUND))
        assertTrue(SharingHost.isMemoryPressure(ComponentCallbacks2.TRIM_MEMORY_MODERATE))
        assertTrue(SharingHost.isMemoryPressure(ComponentCallbacks2.TRIM_MEMORY_COMPLETE))
    }

    @Test
    fun `the mildest running level is left alone`() {
        assertFalse(SharingHost.isMemoryPressure(ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE))
    }
}
