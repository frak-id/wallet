import Foundation

/// Whether the SDK may mint an identity and talk to the backend, as a runtime decision rather
/// than the build-time-only `FrakConfig.trackingEnabled` it replaces at the read sites.
///
/// Tri-state on purpose, and the third state is not "unset means off":
///
/// | persisted | `FrakConfig.trackingEnabled` | `isEnabled()` |
/// |---|---|---|
/// | absent    | true  | true — every integration shipped before this type existed behaves exactly as it did |
/// | absent    | false | false |
/// | `granted` | true  | true |
/// | `granted` | false | false — the compile-time flag is a hard floor, see below |
/// | `denied`  | true  | false |
/// | `denied`  | false | false |
///
/// The compile-time `false` is a floor no persisted value can lift: a merchant who shipped
/// `FrakConfig(trackingEnabled: false)` must not discover that a `setTrackingEnabled(true)` call
/// somewhere in their app silently switched the SDK on. The grant is still written to disk, so it
/// takes effect if they later ship a build with the flag on; it simply cannot take effect against
/// a build that says no. `setEnabled` logs when it is called into that floor.
///
/// Stored in the identity `KeyValueStore` suite, never the config suite: the config suite is the
/// SDK's own cache of someone else's data and is safe to throw away at any time, whereas a
/// consent decision is the only record that the user was ever asked.
///
/// An actor, matching `AnonymousIdStore`: the memo below is mutable state read from several
/// tasks, and actor isolation is what makes that safe without a lock.
actor TrackingConsent {
    private let store: any KeyValueStore
    /// `FrakConfig.trackingEnabled`. A `false` here can never be lifted by a persisted grant.
    private let configDefault: Bool
    private let logger: FrakLogger

    /// The persisted decision once read, so only the first call touches the suite. Holds the
    /// persisted state only — the `configDefault` floor is applied on every read, never baked
    /// into this value.
    private var persisted: Bool?

    init(store: any KeyValueStore, configDefault: Bool, logger: FrakLogger) {
        self.store = store
        self.configDefault = configDefault
        self.logger = logger
    }

    /// Anything that is not an explicit denial reads as "not decided" and follows the config, so a
    /// corrupt or partially-written value fails towards the behaviour the merchant compiled in
    /// rather than towards a silently dead SDK.
    ///
    /// Two deliberate divergences from the Kotlin twin: `KeyValueStore.string(forKey:)` is
    /// non-throwing here, unlike `SharedPreferences`, so there is no separate "read failed" case
    /// to distinguish from "key absent". And `UserDefaults` keeps a suite in memory after
    /// `cfprefsd` hands it over, so this needs no IO-dispatcher hop the way Kotlin's lazy file
    /// open does.
    func isEnabled() -> Bool {
        guard configDefault else { return false }
        if let persisted { return persisted }
        let enabled = store.string(forKey: Self.key) != Self.denied
        persisted = enabled
        return enabled
    }

    /// Persists the decision and updates the memo. The caller — `DefaultFrakClient.setTrackingEnabled`
    /// — owns the side effects (purging the queue); this only records the decision.
    func setEnabled(_ enabled: Bool) {
        store.set(enabled ? Self.granted : Self.denied, forKey: Self.key)
        persisted = enabled
        if enabled, !configDefault {
            logger.warn(
                "setTrackingEnabled(true) was recorded but has no effect: this build ships "
                    + "FrakConfig(trackingEnabled: false), which the SDK treats as a hard floor."
            )
        }
    }

    private static let key = "tracking-consent"
    private static let granted = "granted"
    private static let denied = "denied"
}
