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

    /** Anonymous id, or null when tracking disabled or device refused key material. */
    public val anonymousId: String? get() = core.anonymousId

    /** Destroys the keypair so [anonymousId] mints a new identity. For GDPR erasure; does not delete history. */
    public fun resetAnonymousId(): Unit = core.resetAnonymousId()

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
