package id.frak.sdk.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The injected stylesheet is a cross-repository contract: the wallet's own CSS reads these two
 * custom property names and nothing else tells it what the host sheet looks like. Asserting on the
 * script text is the only place that contract is checkable from this side — nothing here can reach
 * the page to see whether it took.
 *
 * `install()` itself is not covered: it needs a real `WebView` with a WebView provider that
 * supports `DOCUMENT_START_SCRIPT`, which Robolectric does not supply. The split exists so the part
 * that carries the contract is testable without one.
 *
 * Robolectric only for [SharingHostStyle.originRule]'s `Uri.parse` — the local `android.jar` stubs
 * every framework method to throw.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SharingHostStyleTest {
    @Test
    fun `names match what the wallet stylesheets read`() {
        // Changing either of these means changing `packages/design-system/src/hostSheet.ts` in the
        // same commit, or the sheet silently renders square on an opaque rectangle.
        assertEquals("--frak-host-top-radius", SharingHostStyle.CSS_VAR_TOP_RADIUS)
        assertEquals("--frak-host-surface", SharingHostStyle.CSS_VAR_SURFACE)
    }

    @Test
    fun `declares both properties on root`() {
        val script = SharingHostStyle.script(28)
        assertTrue(script, script.contains(":root{"))
        assertTrue("radius must carry a CSS unit: $script", script.contains("--frak-host-top-radius:28px"))
        // Without this the radius rounds nothing: a `body` background propagates to the document
        // canvas, which no `border-radius` clips.
        assertTrue(script, script.contains("--frak-host-surface:transparent"))
    }

    @Test
    fun `runs at document start, before the page's own scripts`() {
        val script = SharingHostStyle.script(28)
        // `documentElement`, not `head`: at document start the parser has produced the root element
        // and not necessarily anything inside it.
        assertTrue(script, script.contains("document.documentElement.appendChild"))
        assertFalse("must not wait for a head that may not exist yet: $script", script.contains("document.head"))
    }

    @Test
    fun `is an expression statement that cannot leak a global`() {
        val script = SharingHostStyle.script(28)
        // The script shares the page's main world, so a bare `var s = …` would land on `window`.
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
        // The rule grammar is `scheme://host[:port]`. A path reaches here because
        // `FrakEnvironment.Custom` validates scheme and host but not the path, and passing one
        // through throws inside the WebView provider — costing the sheet its corners on every
        // route, silently, for a typo in a dev-only config.
        assertEquals("https://stub.example", SharingHostStyle.originRule("https://stub.example/frak"))
        assertEquals("http://10.0.2.2:3000", SharingHostStyle.originRule("http://10.0.2.2:3000/wallet/"))
    }

    @Test
    fun `leaves an already-valid origin exactly as it is`() {
        // The overwhelmingly common case: both built-in environments are bare origins already, and
        // rewriting one into a different string would be a silent origin change, not a repair.
        assertEquals("https://wallet.frak.id", SharingHostStyle.originRule("https://wallet.frak.id"))
        assertEquals("http://localhost:8080", SharingHostStyle.originRule("http://localhost:8080"))
    }

    @Test
    fun `hands anything unparseable straight to the platform's own validation`() {
        // Better a rejected rule caught by `install`'s `runCatching` than a value quietly rewritten
        // into a different origin than the one the merchant configured.
        assertEquals("not an origin", SharingHostStyle.originRule("not an origin"))
        assertEquals("", SharingHostStyle.originRule(""))
    }

    @Test
    fun `the sheet's own radius is what the page is told to draw`() {
        // The skeleton clips itself to `SHEET_CORNER_RADIUS_DP` while the page loads, and the page
        // takes over the same corners once it paints. A mismatch is a visible jump at first paint.
        val script = SharingHostStyle.script(SHEET_CORNER_RADIUS_DP)
        assertTrue(script, script.contains("--frak-host-top-radius:${SHEET_CORNER_RADIUS_DP}px"))
    }
}
