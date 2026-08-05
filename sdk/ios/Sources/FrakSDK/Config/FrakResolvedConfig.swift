/// What the backend knows about this merchant, as resolved by `GET /user/merchant/resolve`.
///
/// The whole tree is `public`, not just the fields acted on directly here: its actual
/// reader, the sharing sheet, lives in the separate `FrakSDKUI` target, which only sees
/// `public` API.
///
/// Deliberately absent from the public surface: `css` (no native use), `productId`
/// (legacy), and `allowedDomains` (a browser-only origin check with no native equivalent).
public struct FrakResolvedConfig: Sendable, Hashable {
    /// Server-issued merchant UUID; the identity everything else is keyed by.
    public let merchantId: String
    public let name: String
    /// Merchant's canonical domain, not whatever domain was queried.
    public let domain: String
    /// Language the backend resolved for this merchant. Nil for an unrecognised value.
    public let lang: FrakLanguage?
    /// Currency the merchant configured. Informational only — reward formatting always
    /// reads currency from `FrakMetadata`, never from this response.
    public let currency: FrakCurrency?
    /// Merchant asked to be hidden from the explorer. Rarely relevant natively.
    public let hidden: Bool
    /// Placement- and component-level copy overrides, translations and attribution
    /// defaults. Nil when the backend omitted the block, or this value was built directly
    /// rather than decoded from a resolve response.
    public let sdkConfig: ResolvedSdkConfig?

    /// Name to show a user: the `sdkConfig` override when the backend sent one, else ``name``.
    ///
    /// A derived property rather than a fold each reader writes for itself — the sharing sheet needs
    /// exactly this, and so does an app rendering its own share affordance. Resolving the precedence
    /// here makes it a rule rather than an implementation detail, and keeps `FrakSDKUI` off the deep
    /// tree.
    ///
    /// `display`-prefixed on purpose, and mirrored on Android as `displayName`/`displayLogoUrl`: it
    /// is derived, not a wire field, so the top level of the resolve response stays free to grow a
    /// real field of its own name later.
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
/// translations, per-placement components and attribution defaults for the SDK's
/// native surfaces.
public struct ResolvedSdkConfig: Decodable, Sendable, Hashable {
    /// Merchant display name from the `sdkConfig` block. May differ from the
    /// top-level `FrakResolvedConfig.name`.
    public let name: String?
    public let logoURL: String?
    public let homepageLink: String?
    public let currency: FrakCurrency?
    public let lang: FrakLanguage?
    public let hidden: Bool
    /// Translation overrides, keyed by translation key (e.g. `"sharing.title"`).
    public let translations: [String: String]
    /// Per-placement copy and component overrides, keyed by placement id.
    public let placements: [String: ResolvedPlacement]
    /// Merchant-global component copy, used when a placement does not override it.
    public let components: ResolvedComponents?
    /// Default attribution parameters applied when a share link omits them.
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
        // whole decode: a missing logo beats a bricked config. Empty strings normalise to nil
        // too, matching the Android twin's `JsonReader.string`, so the same wire response
        // decodes identically on both platforms.
        name = (try? container.decodeIfPresent(String.self, forKey: .name))?.nonEmpty
        logoURL = (try? container.decodeIfPresent(String.self, forKey: .logoURL))?.nonEmpty
        homepageLink = (try? container.decodeIfPresent(String.self, forKey: .homepageLink))?.nonEmpty
        hidden = (try? container.decodeIfPresent(Bool.self, forKey: .hidden)) ?? false
        translations = (try? container.decodeIfPresent([String: String].self, forKey: .translations)) ?? [:]
        placements =
            (try? container.decodeIfPresent([String: ResolvedPlacement].self, forKey: .placements)) ?? [:]
        components = try? container.decodeIfPresent(ResolvedComponents.self, forKey: .components)
        attribution = try? container.decodeIfPresent(AttributionDefaults.self, forKey: .attribution)
        currency = try? container.decodeIfPresent(FrakCurrency.self, forKey: .currency)
        lang = try? container.decodeIfPresent(FrakLanguage.self, forKey: .lang)
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

    /// Hand-written rather than synthesized: `translations` is non-optional, matching the
    /// Kotlin twin where an absent key decodes to `emptyMap()`. A synthesized `Decodable`
    /// would call `decode(_:forKey:)` for a non-optional property and throw `keyNotFound`
    /// when the backend omits `translations`, as it does whenever a placement has none —
    /// which `ResolvedSdkConfig`'s `try?` would swallow into dropping every placement.
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
    /// Button text when a reward applies.
    public let text: String?
    /// Button text when no reward applies.
    public let noRewardText: String?
    /// The action key fired when the button is tapped.
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
    /// Where the button is anchored on screen.
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
    /// Copy shown to the referee when a reward applies.
    public let refereeText: String?
    /// Copy shown to the referee when no reward applies.
    public let refereeNoRewardText: String?
    /// Copy shown to the referrer when a reward applies.
    public let referrerText: String?
    /// Copy shown to the referrer when no reward applies.
    public let referrerNoRewardText: String?
    /// Call-to-action text when a reward applies.
    public let ctaText: String?
    /// Call-to-action text when no reward applies.
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
    /// nil for an empty string, self otherwise. Matches the Android twin's `JsonReader.string`,
    /// which normalises the same way for every optional string field on the wire.
    fileprivate var nonEmpty: String? { isEmpty ? nil : self }
}
