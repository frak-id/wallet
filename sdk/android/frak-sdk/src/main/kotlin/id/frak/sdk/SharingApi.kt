package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.sharing.SharingRequest
import java.util.concurrent.CompletableFuture

/**
 * Share link construction. Obtained from [FrakClient.sharing].
 *
 * `*Async` twins, and why: see [ConfigApi].
 */
public class SharingApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Builds a share link for [request]; null when there's no identity to build from. */
    public suspend fun buildLink(request: SharingRequest): String? = core.buildSharingLink(request)

    /** [buildLink] for Java. Completes with null on the same "nothing to share" paths. */
    public fun buildLinkAsync(request: SharingRequest): CompletableFuture<String?> =
        core.asFuture { core.buildSharingLink(request) }
}
