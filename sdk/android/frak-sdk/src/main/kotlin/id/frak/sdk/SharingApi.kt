package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest
import java.util.concurrent.CompletableFuture

/** Share link construction. Obtained from [FrakClient.sharing]. */
public class SharingApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /**
     * Builds a share link for [request].
     *
     * @return null only when there is nothing to link to: the request carried no link, none of its
     *   products did, and neither the resolved config nor [id.frak.sdk.core.FrakMetadata.homepageLink]
     *   supplies one. That is answerable without a network round trip, so it is an absence rather
     *   than a failure.
     * @throws FrakError when a link could have been built but could not be: tracking is disabled,
     *   the device refused key material, or no merchant could be resolved.
     */
    @Throws(FrakError::class)
    public suspend fun buildLink(request: SharingRequest): String? = core.buildSharingLink(request)

    /**
     * [buildLink] for Java. Completes with null on the same "nothing to link to" path, and
     * completes exceptionally with a [FrakError] wrapped in a `CompletionException` otherwise.
     */
    public fun buildLinkAsync(request: SharingRequest): CompletableFuture<String?> =
        core.asFuture { core.buildSharingLink(request) }
}
