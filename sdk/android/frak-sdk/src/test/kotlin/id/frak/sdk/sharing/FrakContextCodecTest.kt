package id.frak.sdk.sharing

import id.frak.sdk.fixtures.GoldenFixtures
import id.frak.sdk.identity.TestKeys.hexToBytes
import id.frak.sdk.identity.TestKeys.toHex
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The `fCtx` codec against the shared corpus.
 *
 * Every assertion here is one the TypeScript codec makes too, on the same
 * vectors. 02 §8.1 calls this the highest silent-divergence risk in the port —
 * a wrong byte order or a tolerated near-miss length produces links that look
 * valid and attribute to nobody — so the corpus, not this file, is the
 * authority: an `encode` fixture is checked byte-for-byte and a `reject`
 * fixture is checked to actually be refused.
 */
class FrakContextCodecTest {
    private val corpus = GoldenFixtures.load(GoldenFixtures.CONTEXT_CODEC)

    @Test
    fun `encodes every fixture to the expected bytes and base64url`() {
        var checked = 0
        for (fixture in corpus.entries.filter { it.getString("kind") == "encode" }) {
            val context = contextOf(fixture.getJSONObject("input"))
            val expected = fixture.getJSONObject("expected")
            val name = fixture.getString("name")

            val bytes = FrakContextCodec.encode(context)
            assertNotNull(name, bytes)
            assertEquals(name, expected.getInt("byteLength"), bytes!!.size)
            assertEquals(name, expected.getString("hex"), bytes.toHex())
            assertEquals(name, expected.getString("base64url"), FrakContextCodec.compress(context))
            assertEquals(name, expected.getInt("base64urlLength"), expected.getString("base64url").length)
            checked++
        }
        assertEquals(
            "the corpus lost its encode fixtures",
            corpus.entries.count { it.getString("kind") == "encode" },
            checked,
        )
    }

    @Test
    fun `decodes every fixture back to its canonical form`() {
        for (fixture in corpus.entries.filter { it.getString("kind") == "encode" }) {
            val expected = fixture.getJSONObject("expected")
            val decoded = FrakContextCodec.decode(hexToBytes(expected.getString("hex")))
            assertEquals(fixture.getString("name"), contextOf(expected.getJSONObject("decoded")), decoded)
        }
    }

    @Test
    fun `round-trips every encodable fixture through the wire string`() {
        for (fixture in corpus.entries.filter { it.getString("kind") == "encode" }) {
            val expected = fixture.getJSONObject("expected")
            assertEquals(
                fixture.getString("name"),
                contextOf(expected.getJSONObject("decoded")),
                FrakContextCodec.decompress(expected.getString("base64url")),
            )
        }
    }

    @Test
    fun `refuses every rejection fixture, in the direction it names`() {
        var checked = 0
        for (fixture in corpus.entries.filter { it.getString("kind") == "reject" }) {
            val name = "${fixture.getString("name")}: ${fixture.getString("reason")}"
            when (val direction = fixture.getString("direction")) {
                "encode" -> {
                    val input = fixture.getJSONObject("input")
                    // A fractional timestamp is unrepresentable here: the Kotlin
                    // API takes a Long. Asserting a rejection would be asserting
                    // something about this test's own coercion, not the codec.
                    if (input.getDouble("t") != Math.floor(input.getDouble("t"))) continue
                    assertNull(name, encodeFrom(input))
                }

                "decode" -> {
                    assertNull(name, FrakContextCodec.decode(hexToBytes(fixture.getString("inputHex"))))
                }

                "decompress" -> {
                    assertNull(name, FrakContextCodec.decompress(fixture.getString("inputBase64url")))
                }

                else -> {
                    throw AssertionError("unknown rejection direction \"$direction\" in $name")
                }
            }
            checked++
        }
        // Not an equality against the corpus count: one fixture (a fractional
        // timestamp) is unrepresentable in a Long-typed API and is skipped above.
        assertTrue("the corpus lost its reject fixtures", checked > 0)
    }

    /**
     * A V1 payload must be refused by the V2 decoder and still read by the
     * outer decompressor — that pair *is* the version disambiguation, so
     * asserting only the rejection would leave half of it untested.
     */
    @Test
    fun `reads a v1 payload the v2 decoder refuses`() {
        val fixture = corpus.byName("reject-decode-v1-length-buffer")
        val wallet = fixture.getJSONObject("decompressesTo").getString("r")
        val encoded =
            id.frak.sdk.core.Base64Url
                .encode(hexToBytes(fixture.getString("inputHex")))
        assertEquals(FrakContext.V1(wallet), FrakContextCodec.decompress(encoded))
    }

    /** Encodes straight from a fixture's JSON input, so the codec is what is under test. */
    private fun encodeFrom(input: JSONObject): ByteArray? =
        FrakContextCodec.encode(
            FrakContext.V2(
                merchantId = input.getString("m"),
                timestamp = input.getLong("t"),
                clientId = input.optString("c").ifEmpty { null },
                wallet = input.optString("w").ifEmpty { null },
            ),
        )

    private fun contextOf(json: JSONObject): FrakContext.V2 =
        FrakContext.V2(
            merchantId = json.getString("m"),
            timestamp = json.getLong("t"),
            clientId = json.optString("c").ifEmpty { null },
            wallet = json.optString("w").ifEmpty { null },
        )
}
