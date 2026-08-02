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

    public init(title: String, link: String, imageURL: String? = nil, utmContent: String? = nil) {
        self.title = title
        self.link = link
        self.imageURL = imageURL
        self.utmContent = utmContent
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

    public init(
        link: String? = nil,
        products: [SharingProduct] = [],
        attribution: AttributionParams? = nil,
        targetInteraction: String? = nil,
        placement: String? = nil,
        logoURL: String? = nil
    ) {
        self.link = link
        self.products = products
        self.attribution = attribution
        self.targetInteraction = targetInteraction
        self.placement = placement
        self.logoURL = logoURL
    }
}
