package id.frak.sdk.sharing

import id.frak.sdk.core.ProductDetails

/** One product to advertise on the sharing sheet. Not a `data class`, see note in `FrakConfig`. */
public class SharingProduct(
    public val title: String,
    public val link: String,
    public val imageUrl: String? = null,
    /** `utm_content` for a link built from this product; highest-priority source for that field. */
    public val utmContent: String? = null,
    /**
     * Scope fields for reward selection (`bestReward`, the sharing page's own selection).
     * Composed rather than flattened: this type's fields are display copy, [ProductDetails]'
     * are what a `productScope` can match on, and merging them would force every render-only
     * call site to also decide what its scope fields are.
     */
    public val details: ProductDetails? = null,
)

/** What to share; passed to `buildSharingLink`. Not a `data class`, see note in `FrakConfig`. */
public class SharingRequest(
    /** Falls back to the merchant's `homepageLink`, then [id.frak.sdk.core.FrakMetadata.homepageLink]. */
    public val link: String? = null,
    public val products: List<SharingProduct> = emptyList(),
    public val attribution: AttributionParams? = null,
    public val targetInteraction: String? = null,
    /** Which configured placement's copy to render, e.g. `product-page`. Accepted but not yet acted on. */
    public val placement: String? = null,
    public val logoUrl: String? = null,
)
