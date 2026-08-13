import Foundation
import Testing

@testable import FrakSDK

@Suite("URLQuery")
struct URLQueryTests {
    @Test("refuses anything without a scheme separator")
    func refusesANonURL() {
        #expect(URLQuery.parse("acme.example/p") == nil)
    }

    @Test("round-trips a url it did not change")
    func roundTripsUnchanged() throws {
        let url = "https://acme.example/p?a=1&b=2#frag"
        #expect(try #require(URLQuery.parse(url)).string == url)
    }

    @Test("reads a key case-insensitively and decodes its value")
    func readsCaseInsensitivelyAndDecodes() throws {
        let query = try #require(URLQuery.parse("https://acme.example/p?fCtx=a%2Db%5Fc"))
        #expect(query.value(for: "fctx") == "a-b_c")
    }

    @Test("prefers an exact-case match over a mangled duplicate")
    func prefersAnExactCaseMatch() throws {
        let query = try #require(URLQuery.parse("https://acme.example/p?fctx=stale&fCtx=real"))
        #expect(query.value(for: "fCtx") == "real")
    }

    @Test("leaves a malformed escape as written rather than dropping the value")
    func toleratesAMalformedEscape() throws {
        let query = try #require(URLQuery.parse("https://acme.example/p?a=100%zz"))
        #expect(query.value(for: "a") == "100%zz")
    }

    @Test("decodes a plus as a space, like URLSearchParams")
    func decodesPlusAsSpace() throws {
        let query = try #require(URLQuery.parse("https://acme.example/p?a=spring+sale"))
        #expect(query.value(for: "a") == "spring sale")
    }

    @Test("decodes multi-byte utf-8")
    func decodesMultiByteUTF8() throws {
        let query = try #require(URLQuery.parse("https://acme.example/p?a=caf%C3%A9"))
        #expect(query.value(for: "a") == "café")
    }

    @Test("never re-encodes a parameter the merchant already wrote")
    func neverReEncodesExistingParameters() throws {
        var query = try #require(URLQuery.parse("https://acme.example/p?a=1%2B1"))
        query.fillIfAbsent("b", "x y")
        #expect(query.string == "https://acme.example/p?a=1%2B1&b=x%20y")
    }

    @Test("fillIfAbsent skips a present key, and an empty or absent value")
    func fillIfAbsentIsAGapFill() throws {
        var query = try #require(URLQuery.parse("https://acme.example/p?a=1"))
        query.fillIfAbsent("a", "2")
        query.fillIfAbsent("b", "")
        query.fillIfAbsent("c", nil)
        #expect(query.string == "https://acme.example/p?a=1")
    }

    @Test("set removes every casing of a key before appending")
    func setReplacesEveryCasing() throws {
        var query = try #require(URLQuery.parse("https://acme.example/p?fctx=old&FCTX=older&a=1"))
        query.set("fCtx", to: "new")
        #expect(query.string == "https://acme.example/p?a=1&fCtx=new")
    }

    @Test("keeps a valueless parameter valueless")
    func keepsAValuelessParameter() throws {
        #expect(try #require(URLQuery.parse("https://acme.example/p?flag")).string == "https://acme.example/p?flag")
    }
}

@Suite("PercentEncoding")
struct PercentEncodingTests {
    @Test("passes the RFC 3986 unreserved set through")
    func passesUnreservedThrough() {
        let unreserved = "ABCabc123-._~"
        #expect(PercentEncoding.encode(unreserved) == unreserved)
    }

    @Test("encodes a space as %20, not +")
    func encodesSpaceAsPercent20() {
        #expect(PercentEncoding.encode("spring sale&more") == "spring%20sale%26more")
    }

    @Test("uses uppercase hex digits")
    func usesUppercaseHexDigits() {
        #expect(PercentEncoding.encode("=") == "%3D")
    }

    @Test("encodes multi-byte characters one byte at a time")
    func encodesMultiByteCharacters() {
        #expect(PercentEncoding.encode("café") == "caf%C3%A9")
    }
}

@Suite("Base64URL")
struct Base64URLTests {
    @Test("emits no padding and the url-safe alphabet")
    func emitsUnpaddedURLSafeOutput() {
        #expect(Base64URL.encode(Data([0xFF, 0xFF, 0xFF])) == "____")
        #expect(Base64URL.encode(Data([0xFB, 0xF0])) == "-_A")
        #expect(Base64URL.encode(Data()) == "")
    }

    @Test("round-trips every byte")
    func roundTripsEveryByte() throws {
        let bytes = Data(0...255)
        #expect(Base64URL.decode(Base64URL.encode(bytes)) == bytes)
    }

    @Test("refuses padding and the standard alphabet")
    func refusesPaddingAndStandardAlphabet() {
        #expect(Base64URL.decode("____=") == nil)
        #expect(Base64URL.decode("+/+/") == nil)
    }

    @Test("refuses a length that cannot terminate an encoding")
    func refusesAnImpossibleLength() {
        #expect(Base64URL.decode("AAAAA") == nil)
    }
}
