package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakEnvironment
import java.util.concurrent.CompletableFuture

/**
 * Everything the SDK can do. Obtained from [Frak.client].
 *
 * A concrete class, not an interface: adding a member here stays binary-compatible, where
 * adding one to an interface breaks every implementer. Point
 * [id.frak.sdk.core.FrakEnvironment.Custom] at a stub server to fake the backend.
 *
 * Every suspending member has a `*Async` twin returning a [CompletableFuture]. Kotlin callers use the
 * `suspend` form; a Java caller cannot name a `Continuation` and so could not call *any* of these
 * before the twins existed. Two async idioms coexist on this SDK on purpose: a request/response call
 * returns a future, and a *session outcome* — `FrakSharing`'s — stays a `@MainThread` callback, because
 * a sheet reports once, later, from a lifecycle the caller does not own. See
 * [id.frak.sdk.core.DefaultFrakClient.asFuture] for the twins' threading contract, and
 * [ConfigApi] for how a `FrakError` surfaces to a Java caller.
 */
public class FrakClient internal constructor(
    internal val core: DefaultFrakClient,
) {
    /** The stage this client talks to. Merchants never set it directly, see [id.frak.sdk.core.FrakConfig.env]. */
    public val environment: FrakEnvironment get() = core.environment

    /** Anonymous id, or null when tracking is disabled or the device refused key material. */
    public suspend fun anonymousId(): String? = core.anonymousId()

    /** [anonymousId] for Java. */
    public fun anonymousIdAsync(): CompletableFuture<String?> = core.asFuture { core.anonymousId() }

    /**
     * Destroys the keypair so the next [anonymousId] mints a new identity. For GDPR erasure; does not delete history already attributed to the old id.
     *
     * @return false when the platform keystore refused to erase the key; the identity did not rotate.
     */
    public suspend fun resetAnonymousId(): Boolean = core.resetAnonymousId()

    /** [resetAnonymousId] for Java. */
    public fun resetAnonymousIdAsync(): CompletableFuture<Boolean> = core.asFuture { core.resetAnonymousId() }

    /**
     * Turns tracking on or off at runtime and persists the decision for this install.
     *
     * `false` stops tracking immediately and purges anything still queued. `true` re-enables it
     * unless this build ships a config with `trackingEnabled(false)`, a floor a runtime call
     * cannot lift.
     *
     * Does not destroy the identity — call [resetAnonymousId] too for a full withdrawal of
     * consent. Purging the queue can discard purchase events not yet sent to the backend.
     */
    public suspend fun setTrackingEnabled(enabled: Boolean): Unit = core.setTrackingEnabled(enabled)

    /**
     * [setTrackingEnabled] for Java.
     *
     * `CompletableFuture<Void?>`, not `CompletableFuture<Unit>`: `kotlin.Unit` on a Java signature is
     * noise, and this is the one place mirroring the suspending member costs more than it buys.
     */
    public fun setTrackingEnabledAsync(enabled: Boolean): CompletableFuture<Void?> =
        core.asFuture {
            core.setTrackingEnabled(enabled)
            null
        }

    /** Whether tracking is currently allowed: `FrakConfig.trackingEnabled` AND the persisted runtime decision. */
    public suspend fun isTrackingEnabled(): Boolean = core.isTrackingEnabled()

    /** [isTrackingEnabled] for Java. */
    public fun isTrackingEnabledAsync(): CompletableFuture<Boolean> = core.asFuture { core.isTrackingEnabled() }

    // No shutdown() here — teardown is [Frak.shutdown] only. A shutdown here would leave
    // `Frak.instance` pointing at a dead client, so `Frak.client` would hand out a corpse and
    // `Frak.initialize` would no-op.

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
