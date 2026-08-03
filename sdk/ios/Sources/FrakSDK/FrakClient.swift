import Foundation

/// Everything the SDK can do. Obtained from `Frak.client`.
///
/// A concrete class, not a protocol: adding a member here is additive on both platforms,
/// where adding a requirement to a protocol invalidates every witness table built before
/// it (`09-api-shape.md`). There is no supported way for a merchant to substitute a fake;
/// point `FrakEnvironment.custom(wallet:backend:)` at a stub server instead and exercise
/// the real client.
///
/// Capabilities are grouped into five namespaces — ``config``, ``rewards``, ``sharing``,
/// ``tracking``, ``appLink`` — rather than kept flat, so the wallet-session cluster (SSO,
/// embedded wallet, pairing) can land as a new namespace without touching this one.
public final class FrakClient: Sendable {
    let core: DefaultFrakClient

    init(core: DefaultFrakClient) {
        self.core = core
        self.config = ConfigAPI(core: core)
        self.rewards = RewardsAPI(core: core)
        self.sharing = SharingAPI(core: core)
        self.tracking = TrackingAPI(core: core)
        self.appLink = AppLinkAPI(core: core)
    }

    /// The stage this client talks to. Merchants never set it directly, see `FrakConfig.env`.
    public nonisolated var environment: FrakEnvironment { core.environment }

    /// Nil when tracking is disabled or the device refused key material.
    public nonisolated var anonymousId: String? { core.anonymousId }

    /// Destroys the keypair (next `anonymousId` read mints a new one) and purges the queue.
    /// For GDPR erasure; does not delete history already attributed to the old id.
    public nonisolated func resetAnonymousId() { core.resetAnonymousId() }

    /// Config resolution and its live stream.
    public let config: ConfigAPI

    /// Campaigns and the single best reward to advertise.
    public let rewards: RewardsAPI

    /// Share link construction.
    public let sharing: SharingAPI

    /// Interaction and purchase tracking.
    public let tracking: TrackingAPI

    /// Inbound referral links and the wallet app handoff.
    public let appLink: AppLinkAPI
}

public enum OpenAppResult: Sendable, Hashable {
    case openedApp
    case openedStore
    case failed
}
