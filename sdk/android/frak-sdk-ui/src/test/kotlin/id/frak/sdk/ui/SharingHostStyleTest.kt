package id.frak.sdk.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The wallet's own CSS reads these custom property names, so the script text is the contract. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SharingHostStyleTest {
    @Test
    fun `names match what the wallet stylesheets read`() {
        // changing either means changing `packages/design-system/src/hostSheet.ts` in the same commit
        assertEquals("--frak-host-top-radius", SharingHostStyle.CSS_VAR_TOP_RADIUS)
        assertEquals("--frak-host-surface", SharingHostStyle.CSS_VAR_SURFACE)
    }

    @Test
    fun `declares both properties on root`() {
        val script = SharingHostStyle.script(28)
        assertTrue(script, script.contains(":root{"))
        assertTrue("radius must carry a CSS unit: $script", script.contains("--frak-host-top-radius:28px"))
        // a `body` background propagates to the document canvas, which no `border-radius` clips
        assertTrue(script, script.contains("--frak-host-surface:transparent"))
    }

    @Test
    fun `runs at document start, before the page's own scripts`() {
        val script = SharingHostStyle.script(28)
        assertTrue(script, script.contains("document.documentElement.appendChild"))
        assertFalse("must not wait for a head that may not exist yet: $script", script.contains("document.head"))
    }

    @Test
    fun `is an expression statement that cannot leak a global`() {
        val script = SharingHostStyle.script(28)
        assertTrue(script, script.startsWith("(function(){"))
        assertTrue(script, script.endsWith("})()"))
    }

    @Test
    fun `takes the radius it is given`() {
        assertTrue(SharingHostStyle.script(0).contains("--frak-host-top-radius:0px"))
        assertTrue(SharingHostStyle.script(16).contains("--frak-host-top-radius:16px"))
    }

    @Test
    fun `reduces an origin to what a rule may contain`() {
        // the rule grammar is `scheme://host[:port]`; a path throws inside the WebView provider
        assertEquals("https://stub.example", SharingHostStyle.originRule("https://stub.example/frak"))
        assertEquals("http://10.0.2.2:3000", SharingHostStyle.originRule("http://10.0.2.2:3000/wallet/"))
    }

    @Test
    fun `leaves an already-valid origin exactly as it is`() {
        assertEquals("https://wallet.frak.id", SharingHostStyle.originRule("https://wallet.frak.id"))
        assertEquals("http://localhost:8080", SharingHostStyle.originRule("http://localhost:8080"))
    }

    @Test
    fun `hands anything unparseable straight to the platform's own validation`() {
        assertEquals("not an origin", SharingHostStyle.originRule("not an origin"))
        assertEquals("", SharingHostStyle.originRule(""))
    }

    @Test
    fun `the sheet's own radius is what the page is told to draw`() {
        val script = SharingHostStyle.script(SHEET_CORNER_RADIUS_DP)
        assertTrue(script, script.contains("--frak-host-top-radius:${SHEET_CORNER_RADIUS_DP}px"))
    }
}
