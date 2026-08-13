package id.frak.sdk.net

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Mirrors `sdk/ios/Tests/FrakSDKTests/Net/URLQueryTests.swift`; the two decoders must agree byte for byte. */
class UrlQueryTest {
    @Test
    fun `refuses anything without a scheme separator`() {
        assertNull(UrlQuery.parse("acme.example/p"))
    }

    @Test
    fun `round-trips a url it did not change`() {
        val url = "https://acme.example/p?a=1&b=2#frag"
        assertEquals(url, UrlQuery.parse(url)!!.toString())
    }

    @Test
    fun `reads a key case-insensitively and decodes its value`() {
        val query = UrlQuery.parse("https://acme.example/p?fCtx=a%2Db%5Fc")!!
        assertEquals("a-b_c", query.get("fctx"))
    }

    @Test
    fun `prefers an exact-case match over a mangled duplicate`() {
        val query = UrlQuery.parse("https://acme.example/p?fctx=stale&fCtx=real")!!
        assertEquals("real", query.get("fCtx"))
    }

    @Test
    fun `leaves a malformed escape as written rather than dropping the value`() {
        assertEquals("100%zz", UrlQuery.parse("https://acme.example/p?a=100%zz")!!.get("a"))
    }

    @Test
    fun `leaves a signed escape as written`() {
        assertEquals("%-1", UrlQuery.percentDecode("%-1"))
        assertEquals("% f", UrlQuery.percentDecode("%+f"))
        assertEquals("% 1", UrlQuery.percentDecode("% 1"))
    }

    @Test
    fun `decodes a plus as a space, like URLSearchParams`() {
        assertEquals("spring sale", UrlQuery.parse("https://acme.example/p?a=spring+sale")!!.get("a"))
    }

    @Test
    fun `decodes multi-byte utf-8`() {
        assertEquals("café", UrlQuery.parse("https://acme.example/p?a=caf%C3%A9")!!.get("a"))
    }

    @Test
    fun `keeps a non-ascii character next to an escape intact`() {
        assertEquals("名 x", UrlQuery.percentDecode("名%20x"))
    }

    @Test
    fun `never re-encodes a parameter the merchant already wrote`() {
        val query = UrlQuery.parse("https://acme.example/p?a=1%2B1")!!
        query.fillIfAbsent("b", "x y")
        assertEquals("https://acme.example/p?a=1%2B1&b=x%20y", query.toString())
    }

    @Test
    fun `fillIfAbsent skips a present key, and an empty or absent value`() {
        val query = UrlQuery.parse("https://acme.example/p?a=1")!!
        query.fillIfAbsent("a", "2")
        query.fillIfAbsent("b", "")
        query.fillIfAbsent("c", null)
        assertEquals("https://acme.example/p?a=1", query.toString())
    }

    @Test
    fun `set removes every casing of a key before appending`() {
        val query = UrlQuery.parse("https://acme.example/p?fctx=old&FCTX=older&a=1")!!
        query.set("fCtx", "new")
        assertEquals("https://acme.example/p?a=1&fCtx=new", query.toString())
    }

    @Test
    fun `keeps a valueless parameter valueless`() {
        assertEquals("https://acme.example/p?flag", UrlQuery.parse("https://acme.example/p?flag")!!.toString())
    }

    @Test
    fun `getExact does not fall back to another casing`() {
        val query = UrlQuery.parse("https://acme.example/p?FMT=token")!!
        assertEquals("token", query.get("fmt"))
        assertNull(query.getExact("fmt"))
    }

    @Test
    fun `getExact still decodes the value it matches`() {
        assertEquals("a b", UrlQuery.parse("https://acme.example/p?fmt=a%20b")!!.getExact("fmt"))
    }
}
