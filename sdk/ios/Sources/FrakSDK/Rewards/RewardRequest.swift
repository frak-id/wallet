/// What to look a reward up for.
///
/// One value rather than a parameter list so the two SDKs read the same on the hottest path:
/// Android has to group these (a Kotlin default argument is a binary break), and a request that
/// grows a field grows it in one place on both.
public struct RewardRequest: Sendable, Hashable {
    /// Which interaction the reward is for, e.g. `purchase`. Free-form; a typo silently never matches.
    public var targetInteraction: String?

    /// Referrer or referee. `nil` ranks both.
    public var audience: RewardAudience?

    /// Products currently in view, when known. Advisory: a campaign scoped to none of them is
    /// ranked below one matching at least one.
    public var products: [ProductDetails]

    public init(
        targetInteraction: String? = nil,
        audience: RewardAudience? = nil,
        products: [ProductDetails] = []
    ) {
        self.targetInteraction = targetInteraction
        self.audience = audience
        self.products = products
    }

    /// The core encodes empty and absent identically; this type holds the non-empty shape, exactly
    /// as `RewardsApi.best` does on Android.
    var wireProducts: [ProductDetails]? {
        products.isEmpty ? nil : products
    }
}
