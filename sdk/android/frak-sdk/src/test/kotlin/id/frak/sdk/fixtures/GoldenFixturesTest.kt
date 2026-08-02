package id.frak.sdk.fixtures

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Proves the loader mechanism works, nothing more.
 *
 * This asserts against `golden-proofs.json` because it is the one corpus file
 * that exists today. There are deliberately no assertions about SDK behaviour
 * here: none of the identity, codec or reward code exists yet, and a test
 * asserting against absent behaviour would be theatre. What must be verified now
 * is that the corpus can be *found and parsed from a Gradle test JVM* — the part
 * that is environment-dependent and would otherwise be discovered later.
 *
 * The conformance suites land with the code they cover.
 */
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

        // Every entry is an object carrying the human label the identity corpus
        // uses. Asserting one payload key keeps this honest: it proves entries
        // were really parsed rather than counted as opaque blobs.
        for (entry in corpus.entries) {
            assertTrue(
                "every fixture carries a description",
                entry.optString("description").isNotEmpty(),
            )
        }
    }

    /**
     * The failure path is the whole point of the loader, so it is tested rather
     * than assumed. If this regressed, every future conformance suite would go
     * green against a corpus that was not there.
     */
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
