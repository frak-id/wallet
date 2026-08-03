import Foundation

/// Everything the SDK can do, as one facade. Obtained from `Frak.client`.
public protocol FrakClient: Sendable {
    var currentConfig: FrakResolvedConfig? { get async }

    // Multicast, replays latest value to new subscribers.
    var configUpdates: AsyncStream<FrakResolvedConfig> { get async }

    var environment: FrakEnvironment { get }

    // Nil when tracking is disabled or the device refused key material.
    // Derived from a platform-held P-256 keypair: self-authenticating, dies with the app.
    var anonymousId: String? { get }

    // Destroys the keypair (next anonymousId read mints a new one) and purges the queue.
    // For GDPR erasure; does not delete history already attributed to the old id.
    func resetAnonymousId()

    // Stale-while-revalidate cache; forceRefresh still respects failure backoff.
    func resolveConfig(forceRefresh: Bool) async throws -> FrakResolvedConfig

    func campaigns(forceRefresh: Bool) async throws -> [Campaign]

    // products is advisory context (a product page, a cart, an order's line items). A
    // campaign scoped to none of them is deprioritized server-side; omitting it preserves
    // the unscoped ranking.
    func bestReward(
        targetInteraction: String?,
        audience: RewardAudience?,
        products: [ProductDetails]?,
        forceRefresh: Bool
    ) async throws -> BestReward?

    // Nil (not throw) when there's no identity to build from. No network request of its own.
    func buildSharingLink(_ request: SharingRequest) async -> String?

    // Succeeds once durable, not once delivered.
    @discardableResult
    func track(_ interaction: Interaction) async -> Result<Void, FrakError>

    @discardableResult
    func trackPurchase(customerId: String, orderId: String, token: String) async -> Result<Void, FrakError>

    /// - Returns: whether the link carried a Frak referral context. Not a "stop routing"
    ///   signal — still navigate to the URL either way.
    @discardableResult
    func handleReferralLink(_ url: String) async -> Bool

    // Requires FrakConfig.env's walletScheme in LSApplicationQueriesSchemes to answer true.
    func isFrakAppInstalled() async -> Bool

    func openFrakApp() async -> OpenAppResult

    // No network request, no identity carried (no Play-style install referrer on iOS).
    func installURL() async -> String?

    /// The wallet's hosted install page for this device, or nil without an identity or a
    /// merchant to resolve.
    ///
    /// Not the store listing — that is `installURL()`. This page shows the install code that
    /// carries attribution across an install, plus the store link, and it carries a freshly
    /// minted `frak-install-v1` proof. The sharing sheet navigates to it in place, so the user
    /// never leaves the merchant app to reach it.
    ///
    /// Defaulted, so adding it does not break a merchant's hand-written fake — the reason
    /// `preloadSharing` was pulled back off this protocol (`06-abi-decisions.md`). A fake that
    /// ignores it returns nil, and the sheet takes the store handoff.
    func installPageURL(returnScheme: String, sessionId: String) async -> String?
}

public enum OpenAppResult: Sendable, Hashable {
    case openedApp
    case openedStore
    case failed
}

extension FrakClient {
    // Protocol requirements can't carry default args; overloads live here instead.

    /// Nothing to hand an install page. Only `DefaultFrakClient` can mint the proof this
    /// carries, so a substitute has nothing useful to return.
    public func installPageURL(returnScheme: String, sessionId: String) async -> String? { nil }

    public func resolveConfig() async throws -> FrakResolvedConfig {
        try await resolveConfig(forceRefresh: false)
    }

    public func campaigns() async throws -> [Campaign] {
        try await campaigns(forceRefresh: false)
    }

    public func bestReward(
        targetInteraction: String? = nil,
        audience: RewardAudience? = nil,
        products: [ProductDetails]? = nil
    ) async throws -> BestReward? {
        try await bestReward(
            targetInteraction: targetInteraction,
            audience: audience,
            products: products,
            forceRefresh: false
        )
    }

    @discardableResult
    public func handleReferralLink(_ url: URL) async -> Bool {
        await handleReferralLink(url.absoluteString)
    }
}
