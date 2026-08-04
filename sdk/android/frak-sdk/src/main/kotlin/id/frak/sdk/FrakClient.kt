package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakEnvironment

/**
 * Everything the SDK can do. Obtained from [Frak.client].
 *
 * A concrete class, not an interface: adding a member here is additive on both
 * platforms, where adding a member to an interface is an unconditional compile break
 * for every implementer (`02-sdk-design.md`). There is no supported way for a merchant
 * to substitute a fake; point [id.frak.sdk.core.FrakEnvironment.Custom] at a stub
 * server instead and exercise the real client.
 *
 * Capabilities are grouped into five namespaces — [config], [rewards], [sharing],
 * [tracking], [appLink] — rather than kept flat, so the wallet-session cluster
 * (SSO, embedded wallet, pairing) can land as a new namespace without touching this one.
 */
public class FrakClient internal constructor(
    internal val core: DefaultFrakClient,
) {
    /** The stage this client talks to. Merchants never set it directly, see [id.frak.sdk.core.FrakConfig.env]. */
    public val environment: FrakEnvironment get() = core.environment

    /** Anonymous id, or null when tracking is disabled or the device refused key material. */
    public suspend fun anonymousId(): String? = core.anonymousId()

    /**
     * Destroys the keypair so the next [anonymousId] mints a new identity. For GDPR erasure; does
     * not delete history already attributed to the old id.
     *
     * @return false when the platform keystore refused to erase the key — the old identity is
     *   still live and the id did NOT rotate. Callers with a legal erasure obligation must check.
     */
    public suspend fun resetAnonymousId(): Boolean = core.resetAnonymousId()

    /**
     * Turns tracking on or off at runtime, and persists the decision for this install. Call it
     * from your consent-management flow; call it as often as the user changes their mind.
     *
     * `false` stops all tracking immediately and purges anything still queued. `true` re-enables
     * it **unless** this build ships `FrakConfig(trackingEnabled = false)`, which is a hard floor
     * a runtime call cannot lift.
     *
     * This does **not** destroy the identity: a user who opts back in is still the same
     * `anonymousId`, which is what makes a temporary opt-out a pause rather than an amputation.
     * For a genuine withdrawal-of-consent, the recipe is both calls in this order:
     *
     * ```kotlin
     * Frak.client.setTrackingEnabled(false)   // stop, and drop what is queued
     * Frak.client.resetAnonymousId()          // then sever the device from the id
     * ```
     *
     * Purging the queue can discard purchase events that have not reached the backend yet. That
     * is deliberate — they were captured under a consent decision that no longer holds — but it
     * is a revenue consequence, not only a privacy one.
     */
    public suspend fun setTrackingEnabled(enabled: Boolean): Unit = core.setTrackingEnabled(enabled)

    /**
     * Whether tracking is currently allowed: `FrakConfig.trackingEnabled` AND the persisted
     * runtime decision. For a consent screen that has to render the current state, and for the
     * accountability record a data-protection authority asks for.
     */
    public suspend fun isTrackingEnabled(): Boolean = core.isTrackingEnabled()

    // Deliberately NO `shutdown()` here — teardown is [Frak.shutdown] only (S6b/C7). A shutdown on
    // this class would leave `Frak.instance` pointing at the client it just killed, so
    // `Frak.client` would keep handing out a corpse and `Frak.initialize` would no-op: a public
    // method whose only documented use is "do not call this, call the other one". The iOS twin
    // omits it for the same reason.

    /** Config resolution and its live stream. */
    public val config: ConfigApi = ConfigApi(core)

    /** Campaigns and the single best reward to advertise. */
    public val rewards: RewardsApi = RewardsApi(core)

    /** Share link construction. */
    public val sharing: SharingApi = SharingApi(core)

    /** Interaction and purchase tracking. */
    public val tracking: TrackingApi = TrackingApi(core)

    /** Inbound referral links and the wallet app handoff. */
    public val appLink: AppLinkApi = AppLinkApi(core)
}

public enum class OpenAppResult {
    OpenedApp,
    OpenedStore,

    Failed,
}
