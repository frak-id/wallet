package id.frak.sdk.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FrakEnvironmentTest {
    @Test
    fun `Custom defaults its wallet package id and scheme to dev, not silently to production`() {
        val custom = FrakEnvironment.Custom(wallet = "https://a", backend = "https://b")

        assertEquals(FrakEnvironment.Development.walletPackageId, custom.walletPackageId)
        assertEquals(FrakEnvironment.Development.walletScheme, custom.walletScheme)
        assertNotEquals(FrakEnvironment.Production.walletPackageId, custom.walletPackageId)
        assertNotEquals(FrakEnvironment.Production.walletScheme, custom.walletScheme)
    }

    @Test
    fun `Custom lets a merchant override the wallet package id and scheme it probes for`() {
        val custom =
            FrakEnvironment.Custom(
                wallet = "https://a",
                backend = "https://b",
                walletPackageId = "com.acme.stub.wallet",
                walletScheme = "acmewallet-stub",
            )

        assertEquals("com.acme.stub.wallet", custom.walletPackageId)
        assertEquals("acmewallet-stub", custom.walletScheme)
    }

    @Test
    fun `Custom accepts https unconditionally`() {
        val custom = FrakEnvironment.Custom(wallet = "https://a", backend = "https://b")

        assertEquals("https://a", custom.wallet)
        assertEquals("https://b", custom.backend)
        assertNull(custom.rejectionReason)
    }

    @Test
    fun `Custom accepts http to documented loopback and private hosts`() {
        val loopbackHosts =
            listOf(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://10.0.2.2:3000", // Android emulator host alias
                "http://10.0.3.2:3000", // Genymotion host alias
                "http://my-machine.local:3000",
                // Underscore host: `java.net.URI.getHost()` returns null for a registry-based
                // authority, so this only passes via the authority fallback. iOS accepts it
                // through `URLComponents.host` directly — pinned on both sides.
                "http://my_host.local:3000",
                "http://10.1.2.3:3000", // 10.0.0.0/8
                "http://172.16.0.5:3000", // 172.16.0.0/12
                "http://172.31.255.255:3000", // 172.16.0.0/12 upper bound
                "http://192.168.1.5:3000", // 192.168.0.0/16
            )

        for (origin in loopbackHosts) {
            val custom = FrakEnvironment.Custom(wallet = origin, backend = "https://b")
            assertEquals("expected $origin to be accepted as-is", origin, custom.wallet)
            assertNull("expected $origin to have no rejection reason", custom.rejectionReason)
        }
    }

    @Test
    fun `Custom rejects http to a public host`() {
        val custom = FrakEnvironment.Custom(wallet = "http://example.com", backend = "https://b")

        assertNotEquals("http://example.com", custom.wallet)
        assertEquals("https", custom.wallet.substringBefore("://"))
        assertTrue(custom.rejectionReason.orEmpty().contains("example.com"))
    }

    @Test
    fun `Custom rejects a file scheme, even for a documented loopback host`() {
        val custom = FrakEnvironment.Custom(wallet = "file:///etc/passwd", backend = "https://b")

        assertNotEquals("file:///etc/passwd", custom.wallet)
        assertEquals("https", custom.wallet.substringBefore("://"))
        assertTrue(custom.rejectionReason.orEmpty().contains("file:///etc/passwd"))
    }

    @Test
    fun `Custom rejects data and javascript schemes`() {
        val data = FrakEnvironment.Custom(wallet = "data:text/plain;base64,Zm9v", backend = "https://b")
        val js = FrakEnvironment.Custom(wallet = "javascript:alert(1)", backend = "https://b")

        assertEquals("https", data.wallet.substringBefore("://"))
        assertEquals("https", js.wallet.substringBefore("://"))
        assertNotNull(data.rejectionReason)
        assertNotNull(js.rejectionReason)
    }

    @Test
    fun `Custom rejects a non-https wallet or backend origin rather than reach it`() {
        val cleartext = FrakEnvironment.Custom(wallet = "http://a", backend = "https://b")
        val file = FrakEnvironment.Custom(wallet = "https://a", backend = "file:///etc/passwd")

        // Not thrown, matching FrakConfig's "never validated at construction": swapped for a
        // well-formed but unreachable placeholder. Failure surfaces at request time as a DNS
        // failure; Frak.initialize separately logs the rejection at ERROR.
        assertNotEquals("http://a", cleartext.wallet)
        assertEquals("https", cleartext.wallet.substringBefore("://"))
        assertNotEquals("file:///etc/passwd", file.backend)
        assertEquals("https", file.backend.substringBefore("://"))
    }

    @Test
    fun `Custom accepts a bracketed IPv6 loopback host, with and without a port (matches iOS)`() {
        // Android previously extracted the host with substringBefore(':'), so the first ':' in
        // "[::1]" was mistaken for the port separator and the host became "[" — rejected, while
        // iOS's URLComponents correctly parses "::1". java.net.URI is bracket-aware too, so all
        // three of these must be accepted on Android as well.
        val withPort = FrakEnvironment.Custom(wallet = "http://[::1]:3000", backend = "https://b")
        val withoutPort = FrakEnvironment.Custom(wallet = "http://[::1]", backend = "https://b")
        val httpsWithPort = FrakEnvironment.Custom(wallet = "https://[::1]:3000", backend = "https://b")

        assertEquals("http://[::1]:3000", withPort.wallet)
        assertNull(withPort.rejectionReason)
        assertEquals("http://[::1]", withoutPort.wallet)
        assertNull(withoutPort.rejectionReason)
        assertEquals("https://[::1]:3000", httpsWithPort.wallet)
        assertNull(httpsWithPort.rejectionReason)
    }

    @Test
    fun `Custom rejects an origin java-net-URI cannot parse, matching iOS's URLComponents returning nil`() {
        val spaceInHost = FrakEnvironment.Custom(wallet = "http://exa mple.com", backend = "https://b")

        assertNotEquals("http://exa mple.com", spaceInHost.wallet)
        assertEquals("https", spaceInHost.wallet.substringBefore("://"))
        assertNotNull(spaceInHost.rejectionReason)
    }

    @Test
    fun `Custom's rejectionReason names the offending origin and combines both when both are rejected`() {
        val bothRejected = FrakEnvironment.Custom(wallet = "file:///etc/passwd", backend = "http://example.com")

        val reason = bothRejected.rejectionReason
        assertNotNull(reason)
        assertTrue(reason.orEmpty().contains("file:///etc/passwd"))
        assertTrue(reason.orEmpty().contains("example.com"))
    }
}
