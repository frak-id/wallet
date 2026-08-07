/// What the backend knows about this merchant, as resolved by `GET /user/merchant/resolve`.
///
/// The whole tree is `public` because its actual reader, the sharing sheet, lives in the
/// separate `FrakSDKUI` target. `css`, `productId` and `allowedDomains` are deliberately absent.
public struct FrakResolvedConfig: Sendable, Hashable {
    /// Server-issued merchant UUID; the identity everything else is keyed by.
    public let merchantId: String
    public let name: String
    /// Merchant's canonical domain, not whatever domain was queried.
    public let domain: String
    public let lang: FrakLanguage?
    /// Informational only — reward formatting always reads currency from `FrakMetadata`.
    public let currency: FrakCurrency?
    /// Merchant asked to be hidden from the explorer. Rarely relevant natively.
    public let hidden: Bool
    public let sdkConfig: ResolvedSdkConfig?

    /// Name to show a user: the `sdkConfig` override when the backend sent one, else ``name``.
    public var displayName: String { sdkConfig?.name ?? name }

    /// Logo to show alongside ``displayName``, or nil when the backend has none on file.
    public var displayLogoURL: String? { sdkConfig?.logoURL }

    public init(
        merchantId: String,
        name: String,
        domain: String,
        lang: FrakLanguage? = nil,
        currency: FrakCurrency? = nil,
        hidden: Bool = false,
        sdkConfig: ResolvedSdkConfig? = nil
    ) {
        self.merchantId = merchantId
        self.name = name
        self.domain = domain
        self.lang = lang
        self.currency = currency
        self.hidden = hidden
        self.sdkConfig = sdkConfig
    }
}

/// The `sdkConfig` block of a resolve response: merchant-configured copy overrides,
/// translations, per-placement components and attribution defaults.
public struct ResolvedSdkConfig: Decodable, Sendable, Hashable {
    public let name: String?
    public let logoURL: String?
    public let homepageLink: String?
    public let currency: FrakCurrency?
    public let lang: FrakLanguage?
    public let hidden: Bool
    /// Overrides keyed by translation key (e.g. `"sharing.title"`).
    public let translations: [String: String]
    /// Keyed by placement id.
    public let placements: [String: ResolvedPlacement]
    /// Merchant-global component copy, used when a placement does not override it.
    public let components: ResolvedComponents?
    public let attribution: AttributionDefaults?

    public init(
        name: String? = nil,
        logoURL: String? = nil,
        homepageLink: String? = nil,
        currency: FrakCurrency? = nil,
        lang: FrakLanguage? = nil,
        hidden: Bool = false,
        translations: [String: String] = [:],
        placements: [String: ResolvedPlacement] = [:],
        components: ResolvedComponents? = nil,
        attribution: AttributionDefaults? = nil
    ) {
        self.name = name
        self.logoURL = logoURL
        self.homepageLink = homepageLink
        self.currency = currency
        self.lang = lang
        self.hidden = hidden
        self.translations = translations
        self.placements = placements
        self.components = components
        self.attribution = attribution
    }

    private enum CodingKeys: String, CodingKey {
        case name, logoURL = "logoUrl", homepageLink, currency, lang, hidden, translations, placements, components,
            attribution
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // A wrong-typed or unrecognised optional field reads as nil rather than failing the
        // whole decode. Empty strings normalise to nil, matching the Android twin.
        name = (try? container.decodeIfPresent(String.self, forKey: .name))?.nonEmpty
        logoURL = (try? container.decodeIfPresent(String.self, forKey: .logoURL))?.nonEmpty
        homepageLink = (try? container.decodeIfPresent(String.self, forKey: .homepageLink))?.nonEmpty
        hidden = (try? container.decodeIfPresent(Bool.self, forKey: .hidden)) ?? false
        translations = (try? container.decodeIfPresent([String: String].self, forKey: .translations)) ?? [:]
        placements = Self.decodePlacements(from: container)
        components = try? container.decodeIfPresent(ResolvedComponents.self, forKey: .components)
        attribution = try? container.decodeIfPresent(AttributionDefaults.self, forKey: .attribution)
        currency = try? container.decodeIfPresent(FrakCurrency.self, forKey: .currency)
        lang = try? container.decodeIfPresent(FrakLanguage.self, forKey: .lang)
    }

    // `try? container.decodeIfPresent([String: ResolvedPlacement].self, ...)` looked like the
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
            if let placement = try? nested.decode(ResolvedPlacement.self, forKey: key) {
                result[key.stringValue] = placement
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

/// Copy and component overrides scoped to one placement, such as a product page.
public struct ResolvedPlacement: Decodable, Sendable, Hashable {
    public let components: ResolvedComponents?
    /// The interaction type this placement targets, e.g. `"purchase"`.
    public let targetInteraction: String?
    public let translations: [String: String]

    public init(
        components: ResolvedComponents? = nil,
        targetInteraction: String? = nil,
        translations: [String: String] = [:]
    ) {
        self.components = components
        self.targetInteraction = targetInteraction
        self.translations = translations
    }

    private enum CodingKeys: String, CodingKey {
        case components, targetInteraction, translations
    }

    /// Hand-written rather than synthesized: a synthesized `Decodable` would throw
    /// `keyNotFound` for the non-optional `translations` whenever the backend omits it.
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        components = try? container.decodeIfPresent(ResolvedComponents.self, forKey: .components)
        targetInteraction = (try? container.decodeIfPresent(String.self, forKey: .targetInteraction))?.nonEmpty
        translations = (try? container.decodeIfPresent([String: String].self, forKey: .translations)) ?? [:]
    }
}

/// Merchant-configured copy for each SDK-rendered component.
public struct ResolvedComponents: Decodable, Sendable, Hashable {
    public let buttonShare: ButtonShareConfig?
    public let buttonWallet: ButtonWalletConfig?
    public let openInApp: OpenInAppConfig?
    public let postPurchase: PostPurchaseConfig?
    public let banner: BannerConfig?

    public init(
        buttonShare: ButtonShareConfig? = nil,
        buttonWallet: ButtonWalletConfig? = nil,
        openInApp: OpenInAppConfig? = nil,
        postPurchase: PostPurchaseConfig? = nil,
        banner: BannerConfig? = nil
    ) {
        self.buttonShare = buttonShare
        self.buttonWallet = buttonWallet
        self.openInApp = openInApp
        self.postPurchase = postPurchase
        self.banner = banner
    }
}

/// Copy for the share button.
public struct ButtonShareConfig: Decodable, Sendable, Hashable {
    public let text: String?
    public let noRewardText: String?
    public let clickAction: String?

    public init(
        text: String? = nil,
        noRewardText: String? = nil,
        clickAction: String? = nil
    ) {
        self.text = text
        self.noRewardText = noRewardText
        self.clickAction = clickAction
    }
}

/// Copy for the wallet button.
public struct ButtonWalletConfig: Decodable, Sendable, Hashable {
    public let position: String?

    public init(position: String? = nil) {
        self.position = position
    }
}

/// Copy for the "open in app" prompt.
public struct OpenInAppConfig: Decodable, Sendable, Hashable {
    public let text: String?

    public init(text: String? = nil) {
        self.text = text
    }
}

/// Copy shown after a purchase, for both the referee and referrer.
public struct PostPurchaseConfig: Decodable, Sendable, Hashable {
    public let badgeText: String?
    public let refereeText: String?
    public let refereeNoRewardText: String?
    public let referrerText: String?
    public let referrerNoRewardText: String?
    public let ctaText: String?
    public let ctaNoRewardText: String?
    public let imageUrl: String?

    public init(
        badgeText: String? = nil,
        refereeText: String? = nil,
        refereeNoRewardText: String? = nil,
        referrerText: String? = nil,
        referrerNoRewardText: String? = nil,
        ctaText: String? = nil,
        ctaNoRewardText: String? = nil,
        imageUrl: String? = nil
    ) {
        self.badgeText = badgeText
        self.refereeText = refereeText
        self.refereeNoRewardText = refereeNoRewardText
        self.referrerText = referrerText
        self.referrerNoRewardText = referrerNoRewardText
        self.ctaText = ctaText
        self.ctaNoRewardText = ctaNoRewardText
        self.imageUrl = imageUrl
    }
}

/// Copy for the referral banner, in both the referral and in-app contexts.
public struct BannerConfig: Decodable, Sendable, Hashable {
    public let referralTitle: String?
    public let referralDescription: String?
    public let referralCta: String?
    public let inappTitle: String?
    public let inappDescription: String?
    public let inappCta: String?
    public let imageUrl: String?

    public init(
        referralTitle: String? = nil,
        referralDescription: String? = nil,
        referralCta: String? = nil,
        inappTitle: String? = nil,
        inappDescription: String? = nil,
        inappCta: String? = nil,
        imageUrl: String? = nil
    ) {
        self.referralTitle = referralTitle
        self.referralDescription = referralDescription
        self.referralCta = referralCta
        self.inappTitle = inappTitle
        self.inappDescription = inappDescription
        self.inappCta = inappCta
        self.imageUrl = imageUrl
    }
}

/// Default attribution parameters applied to a share link when the caller omits them.
public struct AttributionDefaults: Decodable, Sendable, Hashable {
    public let utmSource: String?
    public let utmMedium: String?
    public let utmCampaign: String?
    public let utmTerm: String?
    public let via: String?
    public let ref: String?

    public init(
        utmSource: String? = nil,
        utmMedium: String? = nil,
        utmCampaign: String? = nil,
        utmTerm: String? = nil,
        via: String? = nil,
        ref: String? = nil
    ) {
        self.utmSource = utmSource
        self.utmMedium = utmMedium
        self.utmCampaign = utmCampaign
        self.utmTerm = utmTerm
        self.via = via
        self.ref = ref
    }
}

extension String {
    /// nil for an empty string, self otherwise. Matches the Android twin's `JsonReader.string`.
    fileprivate var nonEmpty: String? { isEmpty ? nil : self }
}
