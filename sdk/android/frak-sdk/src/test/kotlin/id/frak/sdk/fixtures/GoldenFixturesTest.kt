package id.frak.sdk.fixtures

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Proves the loader mechanism finds and parses the corpus from a Gradle test JVM. Nothing more. */
class GoldenFixturesTest {
    @Test
    fun `identity corpus loads, declares the expected envelope, and is non-empty`() {
        val corpus = GoldenFixtures.load(GoldenFixtures.IDENTITY_PROOFS)

        assertEquals(
            "envelope formatVersion",
            GoldenFixtures.EXPECTED_FORMAT_VERSION,
            corpus.formatVersion,
        )
        assertTrue("corpus should not be empty", corpus.size > 0)

        // Asserting one payload key proves entries were really parsed, not just counted.
        for (entry in corpus.entries) {
            assertTrue(
                "every fixture carries a description",
                entry.optString("description").isNotEmpty(),
            )
        }
    }

    @Test
    fun `a missing corpus fails loudly rather than skipping`() {
        val error =
            runCatching {
                GoldenFixtures.load("sdk/core/src/identity/fixtures/does-not-exist.json")
            }.exceptionOrNull()

        assertTrue(
            "expected an AssertionError, got $error",
            error is AssertionError,
        )
        assertTrue(
            "failure message should name the missing file",
            error!!.message!!.contains("does-not-exist.json"),
        )
        assertTrue(
            "failure message should say how to regenerate",
            error.message!!.contains("fixtures:generate"),
        )
    }
}
