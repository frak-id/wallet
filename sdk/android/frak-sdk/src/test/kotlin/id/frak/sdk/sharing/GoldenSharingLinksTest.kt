package id.frak.sdk.sharing

import id.frak.sdk.config.AttributionDefaults
import id.frak.sdk.fixtures.GoldenFixtures
import id.frak.sdk.net.UrlQuery
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Share-link building and `fCtx` parsing against the shared corpus; a built link is compared decoded, not byte for byte. */
class GoldenSharingLinksTest {
    private val corpus = GoldenFixtures.load(GoldenFixtures.SHARING_LINKS)

    private data class DecodedLink(
        val base: String,
        val query: List<Pair<String, String>>,
        val fragment: String,
    )

    @Test
    fun `builds every fixture to the expected decoded link`() {
        val fixtures = corpus.entries.filter { it.getString("kind") == "build" }
        val mismatches =
            fixtures.mapNotNull { fixture ->
                val actual = build(fixture.getJSONObject("input"))?.let(::decodeLink)
                val expected = fixture.optJSONObject("expected")?.let(::expectedLink)
                if (actual == expected) null else "${fixture.getString("name")}: expected $expected, got $actual"
            }
        assertTrue("build fixtures diverge from the corpus:\n${mismatches.joinToString("\n")}", mismatches.isEmpty())
        assertTrue("the corpus lost its build fixtures", fixtures.isNotEmpty())
    }

    @Test
    fun `parses every fixture to the expected context`() {
        val fixtures = corpus.entries.filter { it.getString("kind") == "parse" }
        for (fixture in fixtures) {
            val expected = fixture.optJSONObject("expected")?.let(::contextOf)
            val actual = SharingLinkBuilder.parse(fixture.getJSONObject("input").getString("url"))
            assertEquals(fixture.getString("name"), expected, actual)
        }
        assertTrue("the corpus lost its parse fixtures", fixtures.isNotEmpty())
    }

    @Test
    fun `decodes a link by the corpus rule`() {
        assertEquals(
            DecodedLink("https://shop.example/", listOf("a" to "1"), ""),
            decodeLink("HTTPS://Shop.Example?a=1"),
        )
        assertEquals(
            DecodedLink("https://s.example/p", listOf("k" to "a=b", "n" to "x y+z", "flag" to ""), ""),
            decodeLink("https://s.example/p?k=a=b&n=x+y%2Bz&flag&&"),
        )
        assertEquals("#top", decodeLink("https://s.example/p?#top").fragment)
    }

    private fun build(input: JSONObject): String? =
        SharingLinkBuilder.build(
            baseUrl = input.getString("baseUrl"),
            context = contextOf(input.getJSONObject("context")),
            attribution = input.optJSONObject("perCall")?.let(::attributionOf),
            defaults = input.optJSONObject("defaults")?.let(::defaultsOf),
            productUtmContent = input.optString("productUtmContent").takeIf { input.has("productUtmContent") },
        )

    private fun decodeLink(link: String): DecodedLink {
        val fragmentAt = link.indexOf('#')
        val fragment = if (fragmentAt < 0) "" else link.substring(fragmentAt)
        val beforeFragment = if (fragmentAt < 0) link else link.substring(0, fragmentAt)

        val queryAt = beforeFragment.indexOf('?')
        val head = if (queryAt < 0) beforeFragment else beforeFragment.substring(0, queryAt)
        val queryString = if (queryAt < 0) "" else beforeFragment.substring(queryAt + 1)

        val authorityEnd = head.indexOf('/', head.indexOf("://") + 3)
        val origin = if (authorityEnd < 0) head else head.substring(0, authorityEnd)
        val path = if (authorityEnd < 0) "/" else head.substring(authorityEnd)

        val query =
            queryString
                .split('&')
                .filter { it.isNotEmpty() }
                .map { segment ->
                    val separator = segment.indexOf('=')
                    if (separator < 0) {
                        UrlQuery.percentDecode(segment) to ""
                    } else {
                        UrlQuery.percentDecode(segment.substring(0, separator)) to
                            UrlQuery.percentDecode(segment.substring(separator + 1))
                    }
                }
        return DecodedLink(origin.lowercase() + path, query, fragment)
    }

    private fun expectedLink(json: JSONObject): DecodedLink {
        val query = json.getJSONArray("query")
        return DecodedLink(
            base = json.getString("base"),
            query =
                (0 until query.length()).map {
                    query.getJSONArray(it).let { pair ->
                        pair.getString(0) to
                            pair.getString(1)
                    }
                },
            fragment = json.getString("fragment"),
        )
    }

    private fun contextOf(json: JSONObject): FrakContext.V2 =
        frakContextV2(
            merchantId = json.getString("m"),
            timestamp = json.getLong("t"),
            clientId = json.optString("c").ifEmpty { null },
            wallet = json.optString("w").ifEmpty { null },
        )

    private fun attributionOf(json: JSONObject): AttributionParams =
        AttributionParams {
            utmSource = json.optString("utmSource").takeIf { json.has("utmSource") }
            utmMedium = json.optString("utmMedium").takeIf { json.has("utmMedium") }
            utmCampaign = json.optString("utmCampaign").takeIf { json.has("utmCampaign") }
            utmContent = json.optString("utmContent").takeIf { json.has("utmContent") }
            utmTerm = json.optString("utmTerm").takeIf { json.has("utmTerm") }
            via = json.optString("via").takeIf { json.has("via") }
            ref = json.optString("ref").takeIf { json.has("ref") }
        }

    private fun defaultsOf(json: JSONObject): AttributionDefaults =
        AttributionDefaults(
            utmSource = json.optString("utmSource").takeIf { json.has("utmSource") },
            utmMedium = json.optString("utmMedium").takeIf { json.has("utmMedium") },
            utmCampaign = json.optString("utmCampaign").takeIf { json.has("utmCampaign") },
            utmTerm = json.optString("utmTerm").takeIf { json.has("utmTerm") },
            via = json.optString("via").takeIf { json.has("via") },
            ref = json.optString("ref").takeIf { json.has("ref") },
        )
}
