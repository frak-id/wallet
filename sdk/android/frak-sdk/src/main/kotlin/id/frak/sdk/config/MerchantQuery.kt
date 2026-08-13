package id.frak.sdk.config

import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.Uuid

/** Route to `GET /user/merchant/resolve`: explicit [ById] or resolved [ByPackageId]. */
internal sealed interface MerchantQuery {
    fun parameters(): Map<String, String?>

    /** Stable cache key; two routes resolving to the same merchant may still have different `lang`. */
    fun cacheKey(): String

    class ById(
        private val merchantId: String,
        private val lang: String?,
    ) : MerchantQuery {
        override fun parameters(): Map<String, String?> = mapOf("merchantId" to merchantId, "lang" to lang)

        override fun cacheKey(): String = "id:$merchantId:${lang.orEmpty()}"
    }

    /** `platform` sent unconditionally with `packageId`, else backend 400s INVALID_PACKAGE_ID_PAIRING. */
    class ByPackageId(
        private val packageId: String,
        private val lang: String?,
    ) : MerchantQuery {
        override fun parameters(): Map<String, String?> =
            mapOf(
                "packageId" to packageId,
                "platform" to ANDROID_PLATFORM,
                "lang" to lang,
            )

        override fun cacheKey(): String = "pkg:$ANDROID_PLATFORM:${packageId.lowercase()}:${lang.orEmpty()}"
    }

    companion object {
        const val ANDROID_PLATFORM: String = "android"

        /**
         * Picks the route: `packageId` first, `merchantId` only without one. Querying by a
         * configured id can only echo it back — the backend resolves strict first-match — so
         * routing by `packageId` is what lets the backend actually determine the merchant.
         */
        fun from(config: FrakConfig): MerchantQuery {
            val lang = config.metadata.lang?.wireValue
            val packageId = config.packageId?.trim()?.takeIf { it.isNotEmpty() }
            if (packageId != null) return ByPackageId(packageId, lang)

            val merchantId = config.merchantId?.trim()?.takeIf { it.isNotEmpty() }
            if (merchantId != null) {
                // Checked here, not left to the backend: a non-UUID comes back as a bare 422 the
                // SDK deliberately does not log the body of, so the merchant sees no cause.
                if (!Uuid.REGEX.matches(merchantId)) {
                    throw FrakError.MerchantResolutionFailed(
                        "FrakConfig.merchantId must be a UUID, got: $merchantId",
                    )
                }
                return ById(merchantId, lang)
            }

            throw FrakError.MerchantResolutionFailed(
                "FrakConfig carries neither a merchantId nor a packageId. " +
                    "Set FrakConfig.merchantId, or leave packageId null so it is read from the Context.",
            )
        }
    }
}
