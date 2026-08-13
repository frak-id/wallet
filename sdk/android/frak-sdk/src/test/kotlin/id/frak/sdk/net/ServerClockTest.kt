package id.frak.sdk.net

import org.junit.Assert.assertEquals
import org.junit.Test

class ServerClockTest {
    private var device = 1_770_000_000_000L

    private fun clock() = ServerClock(wallClock = { device })

    @Test
    fun `reads the device clock until a response says otherwise`() {
        assertEquals(device / 1000, clock().nowSeconds())
    }

    @Test
    fun `corrects a device running fast`() {
        val clock = clock()
        clock.observe(device - 90_000)

        assertEquals((device - 90_000) / 1000, clock.nowSeconds())
    }

    @Test
    fun `keeps advancing with the device once corrected`() {
        val clock = clock()
        clock.observe(device - 90_000)
        device += 10_000

        assertEquals((device - 90_000) / 1000, clock.nowSeconds())
    }

    @Test
    fun `ignores an absent, unparseable or implausible Date header`() {
        val clock = clock()
        clock.observe(0)
        clock.observe(1_000_000_000_000L)
        clock.observe(Long.MAX_VALUE)
        clock.observe(4_200_000_000_000L)

        assertEquals(device / 1000, clock.nowSeconds())
    }
}
