package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import java.util.concurrent.CompletableFuture

/**
 * Inbound referral links and the wallet app handoff. Obtained from [FrakClient.appLink].
 *
 * `*Async` twins, and why: see [ConfigApi]. [isFrakAppInstalled] has none — it does not suspend, so
 * Java can already call it.
 */
public class AppLinkApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Decodes referral context, guards self-referral, tracks arrival. Not a "stop routing" signal. */
    public suspend fun handleReferral(url: String): Boolean = core.handleReferralLink(url)

    /** [handleReferral] for Java. */
    public fun handleReferralAsync(url: String): CompletableFuture<Boolean> =
        core.asFuture { core.handleReferralLink(url) }

    public fun isFrakAppInstalled(): Boolean = core.isFrakAppInstalled()

    /** Opens the wallet app if installed, else the Play Store listing with an install referrer. */
    public suspend fun openFrakApp(): OpenAppResult = core.openFrakApp()

    /** [openFrakApp] for Java. */
    public fun openFrakAppAsync(): CompletableFuture<OpenAppResult> = core.asFuture { core.openFrakApp() }

    public suspend fun installUrl(): String? = core.installUrl()

    /** [installUrl] for Java. */
    public fun installUrlAsync(): CompletableFuture<String?> = core.asFuture { core.installUrl() }

    /** Wallet's hosted install page for this device, carrying a fresh `frak-install-v1` proof, or null without an identity or a merchant to resolve. Not the store listing — that is [installUrl]. */
    public suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? = core.installPageUrl(returnScheme, sessionId)

    /** [installPageUrl] for Java. */
    public fun installPageUrlAsync(
        returnScheme: String,
        sessionId: String,
    ): CompletableFuture<String?> = core.asFuture { core.installPageUrl(returnScheme, sessionId) }
}
