/// Attribution parameters to hang off a share link, overriding the merchant's defaults.
public struct AttributionParams: Sendable, Hashable {
    public let utmSource: String?
    public let utmMedium: String?
    public let utmCampaign: String?
    /// What was shared. Only ever per-call or per-product — a merchant-level default
    /// cannot know it.
    public let utmContent: String?
    public let utmTerm: String?
    public let via: String?
    public let ref: String?

    public init(
        utmSource: String? = nil,
        utmMedium: String? = nil,
        utmCampaign: String? = nil,
        utmContent: String? = nil,
        utmTerm: String? = nil,
        via: String? = nil,
        ref: String? = nil
    ) {
        self.utmSource = utmSource
        self.utmMedium = utmMedium
        self.utmCampaign = utmCampaign
        self.utmContent = utmContent
        self.utmTerm = utmTerm
        self.via = via
        self.ref = ref
    }
}

/// One product card on the sharing page.
public struct SharingProduct: Sendable, Hashable {
    public let title: String
    public let link: String
    public let imageURL: String?
    /// Highest-priority source for `utm_content`.
    public let utmContent: String?
    /// Scope fields a campaign's `productScope` can target. Composed rather than flattened
    /// so `bestReward(products:)` can take scope-only products with no `title` at all.
    public let details: ProductDetails?

    public init(
        title: String,
        link: String,
        imageURL: String? = nil,
        utmContent: String? = nil,
        details: ProductDetails? = nil
    ) {
        self.title = title
        self.link = link
        self.imageURL = imageURL
        self.utmContent = utmContent
        self.details = details
    }
}

/// What to share, and how to attribute it.
public struct SharingRequest: Sendable, Hashable {
    /// Base URL to build the link from. Falls back to the first product's link, then the
    /// merchant's homepage.
    public let link: String?
    public let products: [SharingProduct]
    public let attribution: AttributionParams?
    /// Narrows the seeded reward to campaigns with this trigger, e.g. `purchase`.
    public let targetInteraction: String?
    /// Where in the app the share was offered, e.g. `product-page`.
    public let placement: String?
    public let logoURL: String?
    /// Per-call overrides for the OS share sheet's title/body/preview image; highest precedence.
    public let shareTitle: String?
    public let shareText: String?
    public let shareImageURL: String?

    public init(
        link: String? = nil,
        products: [SharingProduct] = [],
        attribution: AttributionParams? = nil,
        targetInteraction: String? = nil,
        placement: String? = nil,
        logoURL: String? = nil,
        shareTitle: String? = nil,
        shareText: String? = nil,
        shareImageURL: String? = nil
    ) {
        self.link = link
        self.products = products
        self.attribution = attribution
        self.targetInteraction = targetInteraction
        self.placement = placement
        self.logoURL = logoURL
        self.shareTitle = shareTitle
        self.shareText = shareText
        self.shareImageURL = shareImageURL
    }
}
