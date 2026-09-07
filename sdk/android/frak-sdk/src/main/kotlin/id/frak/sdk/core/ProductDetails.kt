package id.frak.sdk.core

/**
 * The purchase line item fields a campaign's `productScope` can target. Build with [Builder], or
 * `ProductDetails { }` from Kotlin. Also returned by the SDK, on
 * [id.frak.sdk.rewards.BestReward.matchedProducts], hence `equals`/`hashCode`.
 */
public class ProductDetails internal constructor(
    public val productId: String?,
    public val sku: String?,
    public val name: String?,
    public val quantity: Double?,
    public val unitPrice: Double?,
    public val totalPrice: Double?,
) {
    public class Builder {
        public var productId: String? = null

        public var sku: String? = null

        public var name: String? = null

        public var quantity: Double? = null

        public var unitPrice: Double? = null

        public var totalPrice: Double? = null

        public fun productId(productId: String?): Builder = apply { this.productId = productId }

        public fun sku(sku: String?): Builder = apply { this.sku = sku }

        public fun name(name: String?): Builder = apply { this.name = name }

        public fun quantity(quantity: Double?): Builder = apply { this.quantity = quantity }

        public fun unitPrice(unitPrice: Double?): Builder = apply { this.unitPrice = unitPrice }

        public fun totalPrice(totalPrice: Double?): Builder = apply { this.totalPrice = totalPrice }

        public fun build(): ProductDetails = ProductDetails(productId, sku, name, quantity, unitPrice, totalPrice)
    }

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

/** Kotlin sugar over [ProductDetails.Builder]. */
public fun ProductDetails(configure: ProductDetails.Builder.() -> Unit): ProductDetails =
    ProductDetails.Builder().apply(configure).build()
