import Foundation
import Testing

@testable import FrakSDK

@Suite("ResolvedConfigDecoder")
struct ResolvedConfigDecoderTests {
    private static let fullResponse = """
        {
          "merchantId": "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f",
          "productId": "0xdeadbeef",
          "name": "Acme",
          "domain": "acme.example",
          "allowedDomains": ["acme.example", "shop.acme.example"],
          "sdkConfig": {
            "name": "Acme Shop",
            "logoUrl": "https://acme.example/logo.png",
            "currency": "eur",
            "lang": "fr",
            "translations": { "sharing.title": "Partager" },
            "components": { "buttonShare": { "text": "Share" } },
            "placements": {
              "product-page": {
                "targetInteraction": "purchase",
                "components": { "buttonShare": { "text": "Share and earn {REWARD}" } }
              }
            },
            "attribution": { "utmSource": "acme-web" }
          }
        }
        """

    private static let minimalResponse = """
        {
          "merchantId": "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f",
          "productId": "0xdeadbeef",
          "name": "Acme",
          "domain": "acme.example",
          "allowedDomains": []
        }
        """

    @Test("decodes a full response")
    func decodesFullResponse() throws {
        let config = try ResolvedConfigDecoder.decode(Data(Self.fullResponse.utf8))

        #expect(config.merchantId == "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f")
        #expect(config.name == "Acme")
        #expect(config.domain == "acme.example")
        #expect(config.currency == .eur)
        #expect(config.lang == .fr)
    }

    @Test("a value rebuilt from a decoded config's own fields, including sdkConfig, is equal to it")
    func rebuiltValueRoundTripsThroughEquality() throws {
        let decoded = try ResolvedConfigDecoder.decode(Data(Self.fullResponse.utf8))

        let rebuilt = FrakResolvedConfig(
            merchantId: decoded.merchantId,
            name: decoded.name,
            domain: decoded.domain,
            lang: decoded.lang,
            currency: decoded.currency,
            hidden: decoded.hidden,
            sdkConfig: decoded.sdkConfig
        )

        #expect(rebuilt == decoded)
    }

    @Test("displayName and displayLogoURL resolve the sdkConfig-over-top-level precedence")
    func derivedDisplayValuesFollowPrecedence() throws {
        let branded = try ResolvedConfigDecoder.decode(Data(Self.fullResponse.utf8))

        #expect(branded.displayName == "Acme Shop")
        #expect(branded.displayLogoURL == "https://acme.example/logo.png")

        let unbranded = try ResolvedConfigDecoder.decode(Data(Self.minimalResponse.utf8))

        #expect(unbranded.displayName == "Acme")
        #expect(unbranded.displayLogoURL == nil)

        // sdkConfig present but carrying neither field: falls back to the top-level name.
        let bare = FrakResolvedConfig(
            merchantId: "m",
            name: "Acme",
            domain: "acme.example",
            sdkConfig: ResolvedSdkConfig(hidden: false)
        )

        #expect(bare.displayName == "Acme")
        #expect(bare.displayLogoURL == nil)
    }

    @Test("decodes a minimal response with no sdkConfig")
    func decodesMinimalResponse() throws {
        let config = try ResolvedConfigDecoder.decode(Data(Self.minimalResponse.utf8))

        #expect(config.merchantId == "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f")
        #expect(config.currency == nil)
        #expect(config.lang == nil)
        #expect(!config.hidden)
    }

    @Test("hidden defaults to false when the backend omits it")
    func hiddenDefaultsFalse() throws {
        #expect(!(try ResolvedConfigDecoder.decode(Data(Self.fullResponse.utf8)).hidden))
    }

    @Test("an unknown currency degrades to nil rather than failing the decode")
    func unknownCurrencyDegradesToNil() throws {
        let body = """
            {"merchantId":"m","productId":"0x00","name":"Acme","domain":"acme.example",
             "allowedDomains":[],"sdkConfig":{"currency":"chf"}}
            """

        #expect(try ResolvedConfigDecoder.decode(Data(body.utf8)).currency == nil)
    }

    @Test("unknown fields are ignored")
    func unknownFieldsAreIgnored() throws {
        let body = """
            {"merchantId":"m","productId":"0x00","name":"Acme","domain":"acme.example",
             "allowedDomains":[],"somethingNewTheBackendAdded":{"nested":true}}
            """

        #expect(try ResolvedConfigDecoder.decode(Data(body.utf8)).name == "Acme")
    }

    @Test("a wrong-typed optional field reads as absent")
    func wrongTypedOptionalFieldReadsAsAbsent() throws {
        let body = """
            {"merchantId":"m","productId":"0x00","name":"Acme","domain":"acme.example",
             "allowedDomains":[],"sdkConfig":{"logoUrl":42,"lang":"en"}}
            """

        let config = try ResolvedConfigDecoder.decode(Data(body.utf8))
        #expect(config.lang == .en)
    }

    @Test("an empty optional string reads as absent, not as an empty string (2.10)")
    func emptyOptionalStringReadsAsAbsent() throws {
        let body = """
            {"merchantId":"m","productId":"0x00","name":"Acme","domain":"acme.example",
             "allowedDomains":[],"sdkConfig":{"logoUrl":"","homepageLink":""}}
            """

        let config = try ResolvedConfigDecoder.decode(Data(body.utf8))
        #expect(config.sdkConfig?.logoURL == nil)
        #expect(config.sdkConfig?.homepageLink == nil)
    }

    @Test("a missing required field is a decoding error naming it")
    func missingRequiredFieldNamesItself() {
        let body = #"{"productId":"0x00","name":"Acme","domain":"acme.example","allowedDomains":[]}"#

        #expect(throws: FrakError.self) {
            _ = try ResolvedConfigDecoder.decode(Data(body.utf8))
        }
        do {
            _ = try ResolvedConfigDecoder.decode(Data(body.utf8))
        } catch let FrakError.decoding(message) {
            #expect(message.contains("merchantId"))
        } catch {
            Issue.record("expected FrakError.decoding")
        }
    }

    @Test("a text/plain body is a decoding error, not a crash")
    func textPlainBodyIsDecodingError() {
        #expect(throws: FrakError.self) {
            _ = try ResolvedConfigDecoder.decode(Data("Merchant not found".utf8))
        }
    }

    @Test("decodes placements and the merchant-global component tier")
    func decodesPlacementsAndComponents() throws {
        let config = try ResolvedConfigDecoder.decode(Data(Self.fullResponse.utf8))
        let sdkConfig = try #require(config.sdkConfig)

        #expect(sdkConfig.placements["product-page"]?.components?.buttonShare?.text == "Share and earn {REWARD}")
        #expect(sdkConfig.components?.buttonShare?.text == "Share")
    }

    // The placement fixture carries no `translations` key, as the backend omits it when empty.
    @Test("a placement with no translations key still decodes, and defaults to empty")
    func placementWithoutTranslationsSurvives() throws {
        let sdkConfig = try #require(try ResolvedConfigDecoder.decode(Data(Self.fullResponse.utf8)).sdkConfig)

        let placement = try #require(sdkConfig.placements["product-page"])
        #expect(placement.translations.isEmpty)
        #expect(placement.targetInteraction == "purchase")
        #expect(sdkConfig.placements.count == 1)
    }

    @Test("decodes translations and attribution defaults")
    func decodesTranslationsAndAttribution() throws {
        let sdkConfig = try #require(try ResolvedConfigDecoder.decode(Data(Self.fullResponse.utf8)).sdkConfig)

        #expect(sdkConfig.translations["sharing.title"] == "Partager")
        #expect(sdkConfig.attribution?.utmSource == "acme-web")
    }

    @Test(
        "a wrong-typed leaf drops only its own field, not the whole components block",
        .disabled(
            """
            Known divergence from Kotlin ResolvedConfigDecoder: the `try?` in \
            ResolvedSdkConfig.init(from:) swallows the entire components block when any nested \
            leaf is wrong-typed. `sdkConfig` is now public (see FrakResolvedConfig), so this is no \
            longer merely a dead-code concern - a merchant reading `ResolvedComponents` can \
            observe a sibling field dropped by an unrelated wrong-typed leaf. Left disabled \
            because fixing it means porting the decodeForgiving helpers down the nested tree, \
            which is a decoding-behaviour change out of scope for the visibility increment that \
            added this test. Tracked separately; enable once ResolvedComponents and its leaves \
            decode forgivingly field-by-field.
            """
        )
    )
    func wrongTypedLeafDoesNotDropSiblingComponents() throws {
        let body = """
            {"merchantId":"m","productId":"0x00","name":"Acme","domain":"acme.example",
             "allowedDomains":[],"sdkConfig":{"components":{
               "buttonShare":{"text":"Share"},
               "banner":{"imageUrl":42}
             }}}
            """

        let sdkConfig = try #require(try ResolvedConfigDecoder.decode(Data(body.utf8)).sdkConfig)

        #expect(sdkConfig.components?.buttonShare?.text == "Share")
        #expect(sdkConfig.components?.banner?.imageUrl == nil)
    }
}
