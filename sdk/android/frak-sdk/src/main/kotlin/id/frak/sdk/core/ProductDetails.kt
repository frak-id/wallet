package id.frak.sdk.core

/**
 * The purchase line item fields a campaign's `productScope` can target. Mirrors the
 * backend's `PRODUCT_SCOPE_FIELDS` allowlist and `sdk/core`'s `ProductDetails` exactly —
 * a field outside this set cannot have been published, and a native app sending one
 * would silently never match.
 *
 * Standalone rather than folded into [id.frak.sdk.sharing.SharingProduct]: reward
 * selection ([id.frak.sdk.RewardsApi.best]) needs scope-only products with no
 * `title`, so a merchant with just an order's line items (no display copy) can still
 * ask "what would this basket earn".
 *
 * `Double`, not `Int`, for every numeric field: the wire type is a JSON number the
 * backend compares numerically, and an `Int` would silently truncate a fractional
 * `unitPrice`.
 */
public class ProductDetails(
    public val productId: String? = null,
    public val sku: String? = null,
    public val name: String? = null,
    public val quantity: Double? = null,
    public val unitPrice: Double? = null,
    public val totalPrice: Double? = null,
)
