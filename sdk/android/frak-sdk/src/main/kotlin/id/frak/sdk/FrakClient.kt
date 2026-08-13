package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakEnvironment
import java.util.concurrent.CompletableFuture

/**
 * Everything the SDK can do. Obtained from [Frak.client]. Every suspending member has a `*Async`
 * twin returning a [CompletableFuture], since a Java caller cannot name a `Continuation`.
 *
 * How failure is signalled, one tier per kind of answer:
 * - `T?` means **absence** — nothing was there, and that is a normal answer ([anonymousId],
 *   [RewardsApi.best], [SharingApi.buildLink]'s null arm).
 * - A sealed or enum type means **outcome** — several ends are all valid ([OpenAppResult]).
 * - `Boolean` means **predicate** ([AppLinkApi.isFrakAppInstalled]).
 * - A thrown [id.frak.sdk.core.FrakError] means **failure** — the call could have worked and did
 *   not ([ConfigApi.resolve], [RewardsApi.campaigns], [SharingApi.buildLink],
 *   [AppLinkApi.installPageUrl]). Through an `*Async` twin this arrives as a `CompletionException`
 *   whose `cause` is the [id.frak.sdk.core.FrakError].
 *
 * [TrackingApi] is the one deliberate exception: it returns [id.frak.sdk.core.FrakResult] and never
 * throws, because it is called from hot paths where a disabled-tracking refusal is expected rather
 * than exceptional. A tier change is invisible to the ABI dump, so it needs a `!` commit.
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
     * Destroys the keypair so the next [anonymousId] mints a new identity.
     *
     * This is a local identity rotation, not an Art. 17 erasure: events already sent stay
     * attributed to the old id on Frak's side. Route an actual erasure request to
     * https://frak.id/account-deletion.
     *
     * @return false when the platform keystore refused to erase the key; the identity did not rotate.
     */
    public suspend fun resetAnonymousId(): Boolean = core.resetAnonymousId()

    /** [resetAnonymousId] for Java. */
    public fun resetAnonymousIdAsync(): CompletableFuture<Boolean> = core.asFuture { core.resetAnonymousId() }

    /**
     * Turns tracking on or off at runtime and persists the decision for this install. `false`
     * purges anything still queued, which can discard purchase events not yet sent; `true` cannot
     * lift a build shipping `trackingEnabled(false)`. Identity survives — see [resetAnonymousId].
     */
    public suspend fun setTrackingEnabled(enabled: Boolean): Unit = core.setTrackingEnabled(enabled)

    /** [setTrackingEnabled] for Java. */
    public fun setTrackingEnabledAsync(enabled: Boolean): CompletableFuture<Void?> =
        core.asFuture {
            core.setTrackingEnabled(enabled)
            null
        }

    /** Whether tracking is currently allowed: `FrakConfig.trackingEnabled` AND the persisted runtime decision. */
    public suspend fun isTrackingEnabled(): Boolean = core.isTrackingEnabled()

    /** [isTrackingEnabled] for Java. */
    public fun isTrackingEnabledAsync(): CompletableFuture<Boolean> = core.asFuture { core.isTrackingEnabled() }

    // No shutdown() here — teardown is [Frak.shutdown] only, otherwise `Frak.client` would hand out
    // a dead client and `Frak.initialize` would no-op.

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
