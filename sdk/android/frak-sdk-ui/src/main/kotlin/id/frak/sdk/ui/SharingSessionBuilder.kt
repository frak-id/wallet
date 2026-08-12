package id.frak.sdk.ui

import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

/** What one [SharingSessionBuilder.build] produced. */
internal sealed interface SharingBuild {
    /** A session to run. May still have no page — that is tier 3, not a failure. */
    class Ready(
        val session: SharingSession,
    ) : SharingBuild

    /** There is nothing to share at all, so no sheet can be shown. */
    class Unavailable(
        val error: FrakError,
    ) : SharingBuild
}

/**
 * Turns a request into a [SharingSession]: the sharing link, the identity, the merchant config and
 * the seeded reward, folded into the page URLs.
 *
 * Holds no session state, so [build] can run wherever the caller wants and hand back one value.
 */
internal class SharingSessionBuilder(
    private val dependencies: SharingDependencies,
    private val packageId: String,
    private val sessionId: String,
    /**
     * BCP-47, and it must be the same value the pool warmed on: `warmBaseUrl` is compared to the
     * warm URL string-for-string, so a mismatch costs the warm view and does a full load.
     */
    private val language: String?,
) {
    /**
     * Under a hard ceiling, so a `resolveConfig()` that hangs rather than throws still answers. A
     * liveness backstop, not a second UX budget — tier 3 enforces the user-facing one.
     *
     * The catch-all is deliberate: the caller has no exception handler between it and the merchant's
     * process, so an unexpected throw has to come back as a value.
     */
    suspend fun build(request: SharingRequest): SharingBuild =
        try {
            withTimeoutOrNull(BUILD_DEADLINE_MILLIS) { resolve(request) }
                ?: SharingBuild.Unavailable(
                    FrakError.Network(
                        IOException("the sharing sheet was not ready within ${BUILD_DEADLINE_MILLIS}ms"),
                    ),
                )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (unexpected: Throwable) {
            SharingBuild.Unavailable(
                unexpected as? FrakError
                    ?: FrakError.InternalFailure("the sharing sheet could not be prepared"),
            )
        }

    private suspend fun resolve(request: SharingRequest): SharingBuild {
        val link = dependencies.buildSharingLink(request)
        val clientId = dependencies.anonymousId()
        if (link == null || clientId == null) {
            return SharingBuild.Unavailable(
                FrakError.MerchantResolutionFailed("no anonymous id or merchant to build a sharing link from"),
            )
        }

        val walletOrigin = dependencies.environment().wallet
        val returnScheme = SharingPageUrl.returnScheme(packageId)
        val merchant =
            try {
                dependencies.resolveConfig()
            } catch (resolveFailed: FrakError) {
                // Tier 3: the link stands alone. A no-page session, not a failed one. Config is
                // unreachable on this path by construction, so the fallback copy cannot read it —
                // see docs/plans/native-sdk/10-native-share-payload.md §7.
                val fallback = tier3ShareCopy(request)
                return SharingBuild.Ready(
                    SharingSession(
                        returnScheme = returnScheme,
                        link = link,
                        shareTitle = fallback.title,
                        shareText = fallback.text,
                        pageUrl = null,
                    ),
                )
            }

        val seededReward = seedReward(request)

        val appName = merchant.displayName
        val requestLogoUrl = request.logoUrl
        val pageLink = request.link ?: request.products.firstOrNull()?.link
        val products = productsJson(request)
        return SharingBuild.Ready(
            SharingSession(
                returnScheme = returnScheme,
                link = link,
                // Not read on this path: a session with a page gets its OS-share copy from the
                // page's own `action=share` payload, not from here.
                shareTitle = appName,
                pageUrl =
                    SharingPageUrl.build(
                        walletOrigin = walletOrigin,
                        merchantId = merchant.merchantId,
                        clientId = clientId,
                        packageId = packageId,
                        sessionId = sessionId,
                        appName = appName,
                        logoUrl = requestLogoUrl ?: merchant.logoUrl,
                        link = pageLink,
                        products = products,
                        seededReward = seededReward,
                        language = language,
                        shareTitle = request.shareTitle,
                        shareText = request.shareText,
                        shareImage = request.shareImageUrl,
                    ),
                // Rebuilt from the same resolved config as pageUrl. If the pool warmed against
                // anything else the strings differ, and the session does a full load instead of
                // activating.
                warmBaseUrl =
                    SharingPageUrl.warm(
                        walletOrigin = walletOrigin,
                        merchantId = merchant.merchantId,
                        clientId = clientId,
                        packageId = packageId,
                        appName = appName,
                        logoUrl = merchant.logoUrl,
                        language = language,
                    ),
                activationFragment =
                    SharingPageUrl.activationFragment(
                        sessionId = sessionId,
                        link = pageLink,
                        products = products,
                        // Only when the request overrides the config: the warm URL already carries
                        // the config's own logo.
                        logoUrl = requestLogoUrl,
                        seededReward = seededReward,
                        shareTitle = request.shareTitle,
                        shareText = request.shareText,
                        shareImage = request.shareImageUrl,
                    ),
            ),
        )
    }

    /**
     * Seeds the page's headline so it opens on content. Opportunistic: sized for a cache hit, and on
     * a miss the page fetches the same value itself. Scoped like the page's own selection so the two
     * never disagree on a product-gated campaign.
     */
    private suspend fun seedReward(request: SharingRequest): String? {
        val scopedProducts = request.products.mapNotNull { it.details }.ifEmpty { null }
        return withTimeoutOrNull(SEED_TIMEOUT_MILLIS) {
            try {
                dependencies.bestReward(request.targetInteraction, scopedProducts)?.formatted
            } catch (unavailable: FrakError) {
                null
            }
        }
    }

    /**
     * Tier-3 copy: per-call override, then the first product's title, then a built-in default.
     * Never reads `sdkConfig` — see the call site. `{{productName}}` binds to
     * [id.frak.sdk.core.FrakMetadata.name], which is local and survives a config failure; no
     * reward-bearing placeholder exists here, since that needs the network that just failed.
     */
    private fun tier3ShareCopy(request: SharingRequest): Tier3ShareCopy {
        val defaults = Tier3Defaults.forLang(dependencies.metadataLang())
        val name = dependencies.metadataName()
        val title =
            request.shareTitle
                ?: request.products.firstOrNull()?.title
                ?: interpolateProductName(defaults.title, name)
        val text = request.shareText ?: interpolateProductName(defaults.text, name)
        return Tier3ShareCopy(title = title, text = text)
    }

    /**
     * Drops the placeholder entirely when there is no name, rather than rendering "null" or an
     * empty gap. The surrounding space collapses with it so "Discover !" cannot happen.
     */
    private fun interpolateProductName(
        template: String,
        productName: String?,
    ): String {
        if (productName != null) return template.replace(PRODUCT_NAME_PLACEHOLDER, productName)
        return template
            .replace(" $PRODUCT_NAME_PLACEHOLDER", "")
            .replace(PRODUCT_NAME_PLACEHOLDER, "")
            .trim()
    }

    private class Tier3ShareCopy(
        val title: String,
        val text: String,
    )

    /**
     * Null rather than `[]` when empty — the page skips the card section on null and renders an
     * empty one on `[]`. Mirrored in iOS's `sharingPageProductsJSON` (SharingSheetLogic.swift); keep both in step.
     */
    private fun productsJson(request: SharingRequest): String? {
        if (request.products.isEmpty()) return null
        val array = JSONArray()
        for (product in request.products) {
            val entry =
                JSONObject()
                    .put("title", product.title)
                    .put("link", product.link)
                    .put("imageUrl", product.imageUrl)
                    .put("utmContent", product.utmContent)
            product.details?.let { details ->
                entry.put("productId", details.productId)
                entry.put("sku", details.sku)
                entry.put("name", details.name)
                // finiteOrNull: JSONObject.put throws on NaN/Infinity, which would crash this launch.
                entry.put("quantity", details.quantity.finiteOrNull())
                entry.put("unitPrice", details.unitPrice.finiteOrNull())
                entry.put("totalPrice", details.totalPrice.finiteOrNull())
            }
            array.put(entry)
        }
        return array.toString()
    }

    /** Null for NaN/Infinity, which [JSONObject.put] rejects outright. */
    private fun Double?.finiteOrNull(): Double? = this?.takeIf { it.isFinite() }

    /**
     * Bundled `sharing.title`/`sharing.text` defaults, mirrored from
     * `packages/wallet-shared/src/i18n/locales/{en,fr}/common.json` and from iOS's `tier3Defaults`.
     * Kept in step by hand — `04-golden-fixtures.md` pins codecs, not prose. A `when` over the enum
     * rather than a map, so a third language fails the build here instead of silently degrading a
     * share to the English copy.
     */
    private object Tier3Defaults {
        fun forLang(lang: FrakLanguage?): Tier3ShareCopy =
            when (lang) {
                FrakLanguage.FR -> {
                    Tier3ShareCopy(
                        title = "Lien d'invitation $PRODUCT_NAME_PLACEHOLDER",
                        text = "Découvrez ce produit incroyable !",
                    )
                }

                FrakLanguage.EN, null -> {
                    Tier3ShareCopy(
                        title = "$PRODUCT_NAME_PLACEHOLDER invite link",
                        text = "Discover this amazing product!",
                    )
                }
            }
    }

    private companion object {
        /** Sized for a cache hit and nothing more; a miss needs the network, which the page does itself. */
        const val SEED_TIMEOUT_MILLIS = 40L

        /** Hard ceiling on a build. A liveness backstop, sized never to fire on a merely slow device. */
        const val BUILD_DEADLINE_MILLIS = 8_000L

        const val PRODUCT_NAME_PLACEHOLDER = "{{productName}}"
    }
}
