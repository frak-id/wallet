import Testing

@testable import FrakSDK

@Suite("SharingLinkBuilder")
struct SharingLinkBuilderTests {
    /// The corpus's `c-only` fixture; keeps the link tests and the codec tests from drifting.
    private static let context = FrakContext.V2(
        merchantId: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: 1_709_654_400,
        clientId: "550e8400-e29b-41d4-a716-446655440001"
    )
    private static let encodedContext = "ElUOhADim0HUpxZEZlVEAABl50GAVQ6EAOKbQdSnFkRmVUQAAQ"

    /// The corpus's `timestamp-uint32-max` fixture, whose wire string actually contains the two
    /// characters a channel re-encodes; `c-only`'s does not, and mangling it would prove nothing.
    private static let mangleableContext = FrakContext.V2(
        merchantId: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: 4_294_967_295,
        clientId: "550e8400-e29b-41d4-a716-446655440001",
        wallet: "0x1234567890123456789012345678901234567890"
    )
    private static let encodedMangleable =
        "MlUOhADim0HUpxZEZlVEAAD_____VQ6EAOKbQdSnFkRmVUQAARI0VniQEjRWeJASNFZ4kBI0VniQ"

    private func build(
        _ baseURL: String,
        context: FrakContext.V2 = SharingLinkBuilderTests.context,
        attribution: AttributionParams? = nil,
        defaults: AttributionDefaults? = nil,
        productUtmContent: String? = nil
    ) -> String? {
        SharingLinkBuilder.build(
            baseURL: baseURL,
            context: context,
            attribution: attribution,
            defaults: defaults,
            productUtmContent: productUtmContent
        )
    }

    @Test("attaches the context and the default source")
    func attachesContextAndDefaultSource() {
        #expect(
            build("https://acme.example/p/1")
                == "https://acme.example/p/1?fCtx=\(Self.encodedContext)&utm_source=frak"
        )
    }

    @Test("preserves the merchant's own query and fragment")
    func preservesTheMerchantsOwnURL() {
        #expect(
            build("https://acme.example/p?size=XL&utm_source=newsletter#reviews")
                == "https://acme.example/p?size=XL&utm_source=newsletter&fCtx=\(Self.encodedContext)#reviews"
        )
    }

    @Test("replaces an existing context whatever case it arrived in")
    func replacesAnExistingContext() {
        #expect(
            build("https://acme.example/p?fctx=stale&a=1")
                == "https://acme.example/p?a=1&fCtx=\(Self.encodedContext)&utm_source=frak"
        )
    }

    @Test("lets per-call attribution win over merchant defaults")
    func perCallAttributionWins() throws {
        let link = try #require(
            build(
                "https://acme.example/p",
                attribution: AttributionParams(utmSource: "ios-app"),
                defaults: AttributionDefaults(utmSource: "web", utmMedium: "referral")
            )
        )
        #expect(link.contains("utm_source=ios-app"))
        #expect(link.contains("utm_medium=referral"))
    }

    @Test("takes utm_content from the product, never from merchant defaults")
    func utmContentComesFromTheProduct() throws {
        let link = try #require(
            build(
                "https://acme.example/p",
                attribution: AttributionParams(utmContent: "per-call"),
                productUtmContent: "sku-42"
            )
        )
        #expect(link.contains("utm_content=sku-42"))
    }

    @Test("percent-encodes attribution values per RFC 3986")
    func percentEncodesAttributionValues() throws {
        let link = try #require(
            build("https://acme.example/p", attribution: AttributionParams(utmCampaign: "spring sale&more"))
        )
        // `%20`, not `+`: this is a query string, not a form body.
        #expect(link.contains("utm_campaign=spring%20sale%26more"))
    }

    @Test("refuses a context with no identity, and a base that is not a url")
    func refusesUnusableInput() {
        let withoutIdentity = FrakContext.V2(
            merchantId: Self.context.merchantId,
            timestamp: Self.context.timestamp
        )
        #expect(build("https://acme.example", context: withoutIdentity) == nil)
        #expect(build("acme.example/p") == nil)
    }

    @Test("parses a context back out of a link it built")
    func parsesItsOwnLink() throws {
        let link = try #require(build("https://acme.example/p"))
        #expect(SharingLinkBuilder.parse(link) == .v2(Self.context))
    }

    @Test("parses a context from a lowercased parameter key")
    func parsesALowercasedKey() {
        #expect(
            SharingLinkBuilder.parse("https://acme.example/p?fctx=\(Self.encodedContext)") == .v2(Self.context)
        )
    }

    @Test("parses a context a channel percent-encoded in transit")
    func parsesAPercentEncodedContext() {
        let mangled =
            Self.encodedMangleable
            .replacingOccurrences(of: "-", with: "%2D")
            .replacingOccurrences(of: "_", with: "%5F")
        #expect(mangled != Self.encodedMangleable)
        #expect(
            SharingLinkBuilder.parse("https://acme.example/p?fCtx=\(mangled)") == .v2(Self.mangleableContext)
        )
    }

    @Test("yields nil for a link carrying no context or a corrupt one")
    func yieldsNilForALinkWithoutAContext() {
        #expect(SharingLinkBuilder.parse("https://acme.example/p?a=1") == nil)
        #expect(SharingLinkBuilder.parse("https://acme.example/p?fCtx=not-a-context") == nil)
    }
}
