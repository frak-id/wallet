package id.frak.sdk.core

/**
 * The purchase line item fields a campaign's `productScope` can target. A field outside this
 * set cannot have been published, and a native app sending one would silently never match.
 *
 * `Double`, not `Int`, for every numeric field: an `Int` would silently truncate a fractional
 * `unitPrice`.
 */
public class ProductDetails(
    public val productId: String? = null,
    public val sku: String? = null,
    public val name: String? = null,
    public val quantity: Double? = null,
    public val unitPrice: Double? = null,
    public val totalPrice: Double? = null,
) {
    override fun toString(): String =
        "ProductDetails(productId=$productId, sku=$sku, name=$name, quantity=$quantity, " +
            "unitPrice=$unitPrice, totalPrice=$totalPrice)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ProductDetails) return false
        return productId == other.productId &&
            sku == other.sku &&
            name == other.name &&
            quantity == other.quantity &&
            unitPrice == other.unitPrice &&
            totalPrice == other.totalPrice
    }

    override fun hashCode(): Int {
        var result = productId?.hashCode() ?: 0
        result = 31 * result + (sku?.hashCode() ?: 0)
        result = 31 * result + (name?.hashCode() ?: 0)
        result = 31 * result + (quantity?.hashCode() ?: 0)
        result = 31 * result + (unitPrice?.hashCode() ?: 0)
        result = 31 * result + (totalPrice?.hashCode() ?: 0)
        return result
    }
}
