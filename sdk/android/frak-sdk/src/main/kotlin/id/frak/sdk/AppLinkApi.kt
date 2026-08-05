package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient

/** Inbound referral links and the wallet app handoff. Obtained from [FrakClient.appLink]. */
public class AppLinkApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Decodes referral context, guards self-referral, tracks arrival. Not a "stop routing" signal. */
    public suspend fun handleReferral(url: String): Boolean = core.handleReferralLink(url)

    public fun isFrakAppInstalled(): Boolean = core.isFrakAppInstalled()

    /** Opens the wallet app if installed, else the Play Store listing with an install referrer. */
    public suspend fun openFrakApp(): OpenAppResult = core.openFrakApp()

    public suspend fun installUrl(): String? = core.installUrl()

    /** Wallet's hosted install page for this device, carrying a fresh `frak-install-v1` proof, or null without an identity or a merchant to resolve. Not the store listing — that is [installUrl]. */
    public suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? = core.installPageUrl(returnScheme, sessionId)
}
