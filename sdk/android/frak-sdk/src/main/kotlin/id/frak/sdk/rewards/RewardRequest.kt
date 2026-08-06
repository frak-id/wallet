package id.frak.sdk.rewards

import id.frak.sdk.core.ProductDetails
import java.util.Collections

/**
 * What to look a reward up for. Build with [Builder], or `RewardRequest { }` from Kotlin.
 *
 * Exists because [id.frak.sdk.RewardsApi.best] used to take four optional parameters, all defaulted —
 * and a Kotlin default freezes an arity in the ABI (see the note at the top of
 * `sharing/SharingRequest.kt`). Four optionals is exactly the combinatorial problem a parameter object
 * solves; the alternative, sixteen overloads, is absurd.
 *
 * `forceRefresh` is deliberately **not** a field here, and that is the interesting part. It is cache
 * control, not a description of the reward wanted — this type is conceptually the cache *key*
 * (`RewardsApi.best`'s own doc notes the cache is keyed on the encoded product list), and a field that
 * is not part of the key does not belong in it. It also invites a live bug: a merchant who builds one
 * request in a ViewModel and reuses it per screen would carry `forceRefresh = true` forever with no
 * diagnostic. It stays a parameter on `best`, spelled the same way as on `resolve` and `campaigns`.
 *
 * Carries `equals`/`hashCode`/`toString`, unlike the older input types. Those predate the rule and are
 * inconsistent with each other; a new type has no excuse, and adding equality after the `.api` dump is
 * committed is a behaviour change with an unchanged descriptor that no dump can catch.
 */
public class RewardRequest internal constructor(
    /** Which interaction the reward is for, e.g. `purchase`. Free-form; a typo silently never matches. */
    public val targetInteraction: String?,
    /** Referrer or referee. Null ranks both. */
    public val audience: RewardAudience?,
    /**
     * Products currently in view, when known. Advisory: a campaign scoped to none of them is ranked
     * below one matching at least one.
     *
     * Non-null with an empty default, matching `SharingRequest.products`, and deliberately not
     * nullable. `RewardRepository` encodes an empty list and an absent one to the same wire value and
     * the same cache key, so a nullable would let two `RewardRequest`s that produce a byte-identical
     * request compare unequal — in the one request type that has equality, and whose KDoc invites a
     * merchant to treat it as the key. It is also what lets `getProducts()` have one answer from Java
     * rather than "null, or an unmodifiable list".
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

        /** Appends one product, for a Java caller who would otherwise write `Arrays.asList(...)` inline. */
        public fun addProduct(product: ProductDetails): Builder = apply { this.products = this.products + product }

        /** Copies [products] for the same reason `SharingRequest.Builder.build` does. */
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
        result = 31 * result + (products?.hashCode() ?: 0)
        return result
    }

    override fun toString(): String =
        "RewardRequest(targetInteraction=$targetInteraction, audience=$audience, products=$products)"
}

/**
 * Kotlin sugar over [RewardRequest.Builder]:
 *
 * ```kotlin
 * val reward = Frak.client.rewards.best(
 *     RewardRequest {
 *         targetInteraction = "purchase"
 *         products = visibleProducts.map { ProductDetails { sku = it.sku } }
 *     },
 * )
 * ```
 */
public fun RewardRequest(configure: RewardRequest.Builder.() -> Unit): RewardRequest =
    RewardRequest.Builder().apply(configure).build()
