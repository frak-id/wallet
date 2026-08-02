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

    func bestReward(
        targetInteraction: String?,
        audience: RewardAudience?,
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
}

public enum OpenAppResult: Sendable, Hashable {
    case openedApp
    case openedStore
    case failed
}

extension FrakClient {
    // Protocol requirements can't carry default args; overloads live here instead.

    public func resolveConfig() async throws -> FrakResolvedConfig {
        try await resolveConfig(forceRefresh: false)
    }

    public func campaigns() async throws -> [Campaign] {
        try await campaigns(forceRefresh: false)
    }

    public func bestReward(
        targetInteraction: String? = nil,
        audience: RewardAudience? = nil
    ) async throws -> BestReward? {
        try await bestReward(targetInteraction: targetInteraction, audience: audience, forceRefresh: false)
    }

    @discardableResult
    public func handleReferralLink(_ url: URL) async -> Bool {
        await handleReferralLink(url.absoluteString)
    }
}
