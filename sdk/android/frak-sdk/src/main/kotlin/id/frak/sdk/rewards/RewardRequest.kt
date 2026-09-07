package id.frak.sdk.rewards

import id.frak.sdk.core.ProductDetails
import java.util.Collections

/** What to look a reward up for. Build with [Builder], or `RewardRequest { }` from Kotlin. */
public class RewardRequest internal constructor(
    /** Which interaction the reward is for, e.g. `purchase`. Free-form; a typo silently never matches. */
    public val targetInteraction: String?,
    /** Referrer or referee. Null ranks both. */
    public val audience: RewardAudience?,
    /**
     * Products currently in view, when known. Advisory: a campaign scoped to none of them is ranked
     * below one matching at least one.
     */
    public val products: List<ProductDetails>,
) {
    public class Builder {
        public var targetInteraction: String? = null

        public var audience: RewardAudience? = null

        public var products: List<ProductDetails> = emptyList()

        public fun targetInteraction(targetInteraction: String?): Builder =
            apply { this.targetInteraction = targetInteraction }

        public fun audience(audience: RewardAudience?): Builder = apply { this.audience = audience }

        public fun products(products: List<ProductDetails>): Builder = apply { this.products = products }

        public fun addProduct(product: ProductDetails): Builder = apply { this.products = this.products + product }

        /** Copies [products], so mutating the caller's list cannot change an already-built request. */
        public fun build(): RewardRequest =
            RewardRequest(
                targetInteraction,
                audience,
                Collections.unmodifiableList(ArrayList(products)),
            )
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is RewardRequest) return false
        return targetInteraction == other.targetInteraction &&
            audience == other.audience &&
            products == other.products
    }

    override fun hashCode(): Int {
        var result = targetInteraction?.hashCode() ?: 0
        result = 31 * result + (audience?.hashCode() ?: 0)
        result = 31 * result + products.hashCode()
        return result
    }

    override fun toString(): String =
        "RewardRequest(targetInteraction=$targetInteraction, audience=$audience, products=$products)"
}

/** Kotlin sugar over [RewardRequest.Builder]. */
public fun RewardRequest(configure: RewardRequest.Builder.() -> Unit): RewardRequest =
    RewardRequest.Builder().apply(configure).build()
