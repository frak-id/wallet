import Foundation

/// Turns a `GET /user/merchant/resolve` body into a `FrakResolvedConfig`.
///
/// The wire types stay `private` so no `Decodable` conformance reaches the public tree in
/// `FrakResolvedConfig.swift`; the cost is one mapping per type.
enum ResolvedConfigDecoder {
    private struct Wire: Decodable {
        let merchantId: String
        let name: String
        let domain: String
        let sdkConfig: SdkConfigWire?
    }

    static func decode(_ body: Data) throws -> FrakResolvedConfig {
        let wire = try JSONDecoding.decode(Wire.self, from: body)
        let sdkConfig = wire.sdkConfig?.value
        return FrakResolvedConfig(
            merchantId: wire.merchantId,
            name: wire.name,
            domain: wire.domain,
            lang: sdkConfig?.lang,
            currency: sdkConfig?.currency,
            hidden: sdkConfig?.hidden ?? false,
            sdkConfig: sdkConfig
        )
    }
}

private struct SdkConfigWire: Decodable {
    let value: ResolvedSdkConfig

    private enum CodingKeys: String, CodingKey {
        case name, logoURL = "logoUrl", homepageLink, currency, lang, hidden, translations, placements, components,
            attribution
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // A wrong-typed or unrecognised optional field reads as nil rather than failing the
        // whole decode. Empty strings normalise to nil, matching the Android twin.
        value = ResolvedSdkConfig(
            name: (try? container.decodeIfPresent(String.self, forKey: .name))?.nonEmpty,
            logoURL: (try? container.decodeIfPresent(String.self, forKey: .logoURL))?.nonEmpty,
            homepageLink: (try? container.decodeIfPresent(String.self, forKey: .homepageLink))?.nonEmpty,
            currency: try? container.decodeIfPresent(FrakCurrency.self, forKey: .currency),
            lang: try? container.decodeIfPresent(FrakLanguage.self, forKey: .lang),
            hidden: (try? container.decodeIfPresent(Bool.self, forKey: .hidden)) ?? false,
            translations: (try? container.decodeIfPresent([String: String].self, forKey: .translations)) ?? [:],
            placements: Self.decodePlacements(from: container),
            components: (try? container.decodeIfPresent(ComponentsWire.self, forKey: .components))?.value,
            attribution: (try? container.decodeIfPresent(AttributionWire.self, forKey: .attribution))?.value
        )
    }

    // `try? container.decodeIfPresent([String: PlacementWire].self, ...)` looked like the
    // same tolerance as every field above, but Swift's synthesized dictionary decoding fails
    // wholesale the moment one value in the dictionary throws — one malformed placement was
    // silently discarding every good one. Android's twin, `net/JsonReader.kt`'s `objectMap`,
    // walks the JSONObject's keys and skips only the entry that fails to parse; this nested
    // container is the Swift shape of that same per-entry policy. An absent `placements`, a
    // null, or a `placements` that isn't an object at all all still fall through to [:], same
    // as every other field in this initializer.
    private static func decodePlacements(
        from container: KeyedDecodingContainer<CodingKeys>
    ) -> [String: ResolvedPlacement] {
        guard
            let nested = try? container.nestedContainer(keyedBy: PlacementCodingKey.self, forKey: .placements)
        else {
            return [:]
        }
        var result: [String: ResolvedPlacement] = [:]
        for key in nested.allKeys {
            if let placement = try? nested.decode(PlacementWire.self, forKey: key) {
                result[key.stringValue] = placement.value
            }
        }
        return result
    }
}

/// Stand-in `CodingKey` used only to walk `placements`' keys, which aren't known ahead of
/// time (they're merchant-defined placement ids, not a fixed enum).
private struct PlacementCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    init?(intValue: Int) {
        self.stringValue = String(intValue)
        self.intValue = intValue
    }
}

private struct PlacementWire: Decodable {
    let value: ResolvedPlacement

    private enum CodingKeys: String, CodingKey {
        case components, targetInteraction, translations
    }

    /// Hand-written rather than synthesized: a synthesized `Decodable` would throw
    /// `keyNotFound` for the non-optional `translations` whenever the backend omits it.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        value = ResolvedPlacement(
            components: (try? container.decodeIfPresent(ComponentsWire.self, forKey: .components))?.value,
            targetInteraction: (try? container.decodeIfPresent(String.self, forKey: .targetInteraction))?.nonEmpty,
            translations: (try? container.decodeIfPresent([String: String].self, forKey: .translations)) ?? [:]
        )
    }
}

private struct ComponentsWire: Decodable {
    let buttonShare: ButtonShareWire?
    let buttonWallet: ButtonWalletWire?
    let openInApp: OpenInAppWire?
    let postPurchase: PostPurchaseWire?
    let banner: BannerWire?

    var value: ResolvedComponents {
        ResolvedComponents(
            buttonShare: buttonShare?.value,
            buttonWallet: buttonWallet?.value,
            openInApp: openInApp?.value,
            postPurchase: postPurchase?.value,
            banner: banner?.value
        )
    }
}

private struct ButtonShareWire: Decodable {
    let text: String?
    let noRewardText: String?
    let clickAction: String?

    var value: ButtonShareConfig {
        ButtonShareConfig(text: text, noRewardText: noRewardText, clickAction: clickAction)
    }
}

private struct ButtonWalletWire: Decodable {
    let position: String?

    var value: ButtonWalletConfig { ButtonWalletConfig(position: position) }
}

private struct OpenInAppWire: Decodable {
    let text: String?

    var value: OpenInAppConfig { OpenInAppConfig(text: text) }
}

private struct PostPurchaseWire: Decodable {
    let badgeText: String?
    let refereeText: String?
    let refereeNoRewardText: String?
    let referrerText: String?
    let referrerNoRewardText: String?
    let ctaText: String?
    let ctaNoRewardText: String?
    let imageUrl: String?

    var value: PostPurchaseConfig {
        PostPurchaseConfig(
            badgeText: badgeText,
            refereeText: refereeText,
            refereeNoRewardText: refereeNoRewardText,
            referrerText: referrerText,
            referrerNoRewardText: referrerNoRewardText,
            ctaText: ctaText,
            ctaNoRewardText: ctaNoRewardText,
            imageUrl: imageUrl
        )
    }
}

private struct BannerWire: Decodable {
    let referralTitle: String?
    let referralDescription: String?
    let referralCta: String?
    let inappTitle: String?
    let inappDescription: String?
    let inappCta: String?
    let imageUrl: String?

    var value: BannerConfig {
        BannerConfig(
            referralTitle: referralTitle,
            referralDescription: referralDescription,
            referralCta: referralCta,
            inappTitle: inappTitle,
            inappDescription: inappDescription,
            inappCta: inappCta,
            imageUrl: imageUrl
        )
    }
}

private struct AttributionWire: Decodable {
    let utmSource: String?
    let utmMedium: String?
    let utmCampaign: String?
    let utmTerm: String?
    let via: String?
    let ref: String?

    var value: AttributionDefaults {
        AttributionDefaults(
            utmSource: utmSource,
            utmMedium: utmMedium,
            utmCampaign: utmCampaign,
            utmTerm: utmTerm,
            via: via,
            ref: ref
        )
    }
}

extension String {
    /// nil for an empty string, self otherwise. Matches the Android twin's `JsonReader.string`.
    fileprivate var nonEmpty: String? { isEmpty ? nil : self }
}
