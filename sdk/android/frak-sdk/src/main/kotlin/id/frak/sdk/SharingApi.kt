package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.sharing.SharingRequest

/** Share link construction. Obtained from [FrakClient.sharing]. */
public class SharingApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Builds a share link for [request]; null when there's no identity to build from. */
    public suspend fun buildLink(request: SharingRequest): String? = core.buildSharingLink(request)
}
