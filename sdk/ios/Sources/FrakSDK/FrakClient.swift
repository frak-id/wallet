import Foundation

/// Everything the SDK can do. Obtained from `Frak.client`.
///
/// A concrete class, not a protocol: adding a member is additive, where adding a protocol
/// requirement invalidates every witness table built before it. There is no supported way to
/// substitute a fake — point `FrakEnvironment.custom(wallet:backend:)` at a stub server.
/// The five namespaces exist so a later cluster (SSO, pairing) lands as a new one rather than
/// flattening into this class.
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

    /// Wire plumbing for `FrakSDKUI`'s tier-3 fallback, not merchant API.
    @_spi(FrakInternal)
    public nonisolated var metadataName: String? { core.metadataName }

    /// Wire plumbing for `FrakSDKUI`'s tier-3 fallback, not merchant API.
    @_spi(FrakInternal)
    public nonisolated var metadataLang: FrakLanguage? { core.metadataLang }

    /// Nil when tracking is disabled or the device refused key material.
    public var anonymousId: String? {
        get async { await core.anonymousId }
    }

    /// Destroys the keypair (next `anonymousId` read mints a new one) and purges the queue. A
    /// local rotation, not an Art. 17 erasure: events already sent stay attributed to the id it
    /// replaces — route an erasure request to https://frak.id/account-deletion. False would mean
    /// the erasure failed and the id did NOT rotate; the underlying delete cannot fail here.
    @discardableResult
    public func resetAnonymousId() async -> Bool { await core.resetAnonymousId() }

    /// Turns tracking on or off at runtime, and persists the decision for this install.
    ///
    /// `false` stops all tracking immediately and purges anything still queued — which can discard
    /// purchase events that have not reached the backend yet. `true` re-enables it **unless** this
    /// build ships `FrakConfig(trackingEnabled: false)`, a hard floor no runtime call lifts. The
    /// identity survives; for a genuine withdrawal, follow with `resetAnonymousId()`.
    public func setTrackingEnabled(_ enabled: Bool) async { await core.setTrackingEnabled(enabled) }

    /// Whether tracking is currently allowed: `FrakConfig.trackingEnabled` AND the persisted
    /// runtime decision. For a consent screen that has to render the current state, and for the
    /// accountability record a data-protection authority asks for.
    public func isTrackingEnabled() async -> Bool { await core.isTrackingEnabled() }

    // Deliberately no `shutdown()` here — teardown is `Frak.shutdown()` only. A shutdown on this
    // class would leave `Frak.instance` pointing at the client it just killed, so `Frak.client`
    // would keep handing out a corpse and `Frak.initialize` would no-op.

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
