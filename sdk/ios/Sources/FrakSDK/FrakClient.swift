import Foundation

/// Everything the SDK can do. Obtained from `Frak.client`.
///
/// A concrete class, not a protocol: adding a member here is additive on both platforms,
/// where adding a requirement to a protocol invalidates every witness table built before
/// it. There is no supported way for a merchant to substitute a fake; point
/// `FrakEnvironment.custom(wallet:backend:)` at a stub server instead and exercise
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
    public var anonymousId: String? {
        get async { await core.anonymousId }
    }

    /// Destroys the keypair (next `anonymousId` read mints a new one) and purges the queue.
    ///
    /// This is a local identity rotation, not an Art. 17 erasure: events already sent stay
    /// attributed to the old id on Frak's side. Route an actual erasure request to
    /// https://frak.id/account-deletion.
    ///
    /// Returns false when erasure failed and the id did NOT rotate. On this platform the
    /// underlying delete cannot fail, so this always returns true — the value exists to keep one
    /// cross-platform contract for merchants writing shared erasure logic.
    @discardableResult
    public func resetAnonymousId() async -> Bool { await core.resetAnonymousId() }

    /// Turns tracking on or off at runtime, and persists the decision for this install. Call it
    /// from your consent-management flow; call it as often as the user changes their mind.
    ///
    /// `false` stops all tracking immediately and purges anything still queued. `true` re-enables
    /// it **unless** this build ships `FrakConfig(trackingEnabled: false)`, which is a hard floor
    /// a runtime call cannot lift.
    ///
    /// This does **not** destroy the identity: a user who opts back in is still the same
    /// `anonymousId`, which is what makes a temporary opt-out a pause rather than an amputation.
    /// For a genuine withdrawal of consent, the recipe is both calls in this order:
    ///
    /// ```swift
    /// await client.setTrackingEnabled(false)   // stop, and drop what is queued
    /// await client.resetAnonymousId()          // then sever the device from the id
    /// ```
    ///
    /// Purging the queue can discard purchase events that have not reached the backend yet. That
    /// is deliberate — they were captured under a consent decision that no longer holds — but it
    /// is a revenue consequence, not only a privacy one.
    public func setTrackingEnabled(_ enabled: Bool) async { await core.setTrackingEnabled(enabled) }

    /// Whether tracking is currently allowed: `FrakConfig.trackingEnabled` AND the persisted
    /// runtime decision. For a consent screen that has to render the current state, and for the
    /// accountability record a data-protection authority asks for.
    public func isTrackingEnabled() async -> Bool { await core.isTrackingEnabled() }

    // Deliberately no `shutdown()` here — teardown is `Frak.shutdown()` only. A shutdown on
    // this class would leave `Frak.instance` pointing at the client it just killed, so
    // `Frak.client` would keep handing out a corpse and `Frak.initialize` would no-op: a public
    // method whose only documented use is "do not call this, call the other one". The Kotlin
    // twin omits it for the same reason.

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
