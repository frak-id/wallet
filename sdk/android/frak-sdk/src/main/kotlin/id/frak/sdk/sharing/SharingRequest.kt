package id.frak.sdk.sharing

import id.frak.sdk.core.ProductDetails
import java.util.Collections

/* SDK-wide: no default arguments on any public constructor. A default compiles to a synthetic $default bridge
 * whose descriptor encodes the arity, so adding a field is a NoSuchMethodError in a merchant binary already
 * shipped. Builders / explicit overloads instead. */

/**
 * One product to advertise on the sharing sheet. Build with [Builder], or
 * `SharingProduct(title, link) { }` from Kotlin.
 */
public class SharingProduct internal constructor(
    public val title: String,
    public val link: String,
    public val imageUrl: String?,
    /** `utm_content` for a link built from this product; highest-priority source for that field. */
    public val utmContent: String?,
    /** Scope fields for reward selection; [ProductDetails] is what a `productScope` matches on. */
    public val details: ProductDetails?,
) {
    public class Builder(
        private val title: String,
        private val link: String,
    ) {
        public var imageUrl: String? = null

        public var utmContent: String? = null

        public var details: ProductDetails? = null

        public fun imageUrl(imageUrl: String?): Builder = apply { this.imageUrl = imageUrl }

        public fun utmContent(utmContent: String?): Builder = apply { this.utmContent = utmContent }

        public fun details(details: ProductDetails?): Builder = apply { this.details = details }

        public fun build(): SharingProduct = SharingProduct(title, link, imageUrl, utmContent, details)
    }
}

/** Kotlin sugar over [SharingProduct.Builder]. */
public fun SharingProduct(
    title: String,
    link: String,
    configure: SharingProduct.Builder.() -> Unit,
): SharingProduct = SharingProduct.Builder(title, link).apply(configure).build()

/** Title and link only. */
public fun SharingProduct(
    title: String,
    link: String,
): SharingProduct = SharingProduct.Builder(title, link).build()

/**
 * What to share; passed to `buildSharingLink` or to the sheet. Build with [Builder], or
 * `SharingRequest { }` from Kotlin.
 */
public class SharingRequest internal constructor(
    /** Falls back to the merchant's `homepageLink`, then [id.frak.sdk.core.FrakMetadata.homepageLink]. */
    public val link: String?,
    public val products: List<SharingProduct>,
    public val attribution: AttributionParams?,
    public val targetInteraction: String?,
    /** Which configured placement's copy to render, e.g. `product-page`. Accepted but not yet acted on. */
    public val placement: String?,
    public val logoUrl: String?,
    /** Highest-precedence override for the OS share sheet's title. See `docs/plans/native-sdk/10-native-share-payload.md` §5. */
    public val shareTitle: String?,
    /** Highest-precedence override for the OS share sheet's body text. */
    public val shareText: String?,
    /** Highest-precedence override for the OS share sheet's preview image. iOS only — Android ships no preview, see §7. */
    public val shareImageUrl: String?,
) {
    public class Builder {
        public var link: String? = null

        public var products: List<SharingProduct> = emptyList()

        public var attribution: AttributionParams? = null

        public var targetInteraction: String? = null

        public var placement: String? = null

        public var logoUrl: String? = null

        public var shareTitle: String? = null

        public var shareText: String? = null

        public var shareImageUrl: String? = null

        public fun link(link: String?): Builder = apply { this.link = link }

        public fun products(products: List<SharingProduct>): Builder = apply { this.products = products }

        public fun addProduct(product: SharingProduct): Builder = apply { this.products = this.products + product }

        public fun attribution(attribution: AttributionParams?): Builder = apply { this.attribution = attribution }

        public fun targetInteraction(targetInteraction: String?): Builder =
            apply { this.targetInteraction = targetInteraction }

        public fun placement(placement: String?): Builder = apply { this.placement = placement }

        public fun logoUrl(logoUrl: String?): Builder = apply { this.logoUrl = logoUrl }

        public fun shareTitle(shareTitle: String?): Builder = apply { this.shareTitle = shareTitle }

        public fun shareText(shareText: String?): Builder = apply { this.shareText = shareText }

        public fun shareImageUrl(shareImageUrl: String?): Builder = apply { this.shareImageUrl = shareImageUrl }

        /** Copies [products], so mutating the caller's list cannot change an already-built request. */
        public fun build(): SharingRequest =
            SharingRequest(
                link,
                Collections.unmodifiableList(ArrayList(products)),
                attribution,
                targetInteraction,
                placement,
                logoUrl,
                shareTitle,
                shareText,
                shareImageUrl,
            )
    }
}

/** Kotlin sugar over [SharingRequest.Builder]. */
public fun SharingRequest(configure: SharingRequest.Builder.() -> Unit): SharingRequest =
    SharingRequest.Builder().apply(configure).build()
