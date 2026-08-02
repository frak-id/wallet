import Testing

@testable import FrakSDK

@Suite("MerchantQuery")
struct MerchantQueryTests {
    private static let merchantId = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"

    @Test("a merchantId takes precedence over a bundleId")
    func merchantIdTakesPrecedence() throws {
        let query = try MerchantQuery.from(FrakConfig(merchantId: Self.merchantId, bundleId: "com.example.app"))
        let parameters = query.parameters

        #expect((parameters["merchantId"] ?? nil) == Self.merchantId)
        #expect((parameters["packageId"] ?? nil) == nil)
        #expect((parameters["platform"] ?? nil) == nil)
    }

    @Test("a bundleId is sent on the wire as packageId, always paired with a platform")
    func bundleIdIsPairedWithPlatform() throws {
        let parameters = try MerchantQuery.from(FrakConfig(bundleId: "com.example.app")).parameters

        #expect((parameters["packageId"] ?? nil) == "com.example.app")
        #expect((parameters["platform"] ?? nil) == "ios")
        #expect((parameters["bundleId"] ?? nil) == nil)
    }

    @Test("lang is sent only when the merchant configured one")
    func langSentOnlyWhenConfigured() throws {
        let withLang = try MerchantQuery.from(
            FrakConfig(merchantId: Self.merchantId, metadata: FrakMetadata(lang: .fr))
        ).parameters
        #expect((withLang["lang"] ?? nil) == "fr")

        let withoutLang = try MerchantQuery.from(FrakConfig(merchantId: Self.merchantId)).parameters
        #expect((withoutLang["lang"] ?? nil) == nil)
    }

    @Test("cache keys separate the two resolution routes")
    func cacheKeysSeparateRoutes() throws {
        let byId = try MerchantQuery.from(FrakConfig(merchantId: Self.merchantId)).cacheKey
        let byBundle = try MerchantQuery.from(FrakConfig(bundleId: "com.example.app")).cacheKey

        #expect(byId.hasPrefix("id:"))
        #expect(byBundle.hasPrefix("pkg:"))
    }

    @Test("cache keys separate languages")
    func cacheKeysSeparateLanguages() throws {
        let english = try MerchantQuery.from(
            FrakConfig(merchantId: Self.merchantId, metadata: FrakMetadata(lang: .en))
        ).cacheKey
        let french = try MerchantQuery.from(
            FrakConfig(merchantId: Self.merchantId, metadata: FrakMetadata(lang: .fr))
        ).cacheKey

        #expect(english != french)
    }

    @Test("bundle-id cache keys are case-insensitive")
    func bundleIdCacheKeysAreCaseInsensitive() throws {
        let lower = try MerchantQuery.from(FrakConfig(bundleId: "com.example.app")).cacheKey
        let upper = try MerchantQuery.from(FrakConfig(bundleId: "COM.EXAMPLE.APP")).cacheKey

        #expect(lower == upper)
    }

    @Test("a config with neither identifier fails with a merchant resolution error")
    func noIdentifierFails() {
        #expect(throws: FrakError.self) {
            _ = try MerchantQuery.from(FrakConfig())
        }
    }

    @Test("blank identifiers are treated as absent")
    func blankIdentifiersAreAbsent() throws {
        let query = try MerchantQuery.from(FrakConfig(merchantId: "   ", bundleId: "com.example.app"))

        #expect((query.parameters["packageId"] ?? nil) == "com.example.app")
    }
}
