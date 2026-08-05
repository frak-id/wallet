package id.frak.sdk.sharing

import id.frak.sdk.core.ProductDetails
import java.util.Collections

/*
 * The two types a merchant touches on every share, and the reference shape for every
 * merchant-constructed type in this SDK.
 *
 * Three rules, and the reasoning for each, stated once here rather than repeated on every type:
 *
 * 1. **No default arguments on a public constructor, ever.** A default compiles to the full-arity
 *    `<init>` plus a synthetic `<init>(…, int mask, DefaultConstructorMarker)` encoding parameter
 *    count and a bitmask. Adding a field changes both descriptors, so a merchant binary already in
 *    the Play Store gets `NoSuchMethodError` — unfixable by them, since it is their shipped app that
 *    breaks. That is finding A3, and `FrakConfig` already grew 8→9 parameters once.
 * 2. **A `Builder` is the implementation, not a wrapper.** The primary constructor is `internal`, so
 *    it never enters the frozen surface and the SDK's own decoders can still use it. A new option is
 *    one new setter plus one new `var` — additive forever, and Java-callable, which a Kotlin-only DSL
 *    is not. This is where every merchant SDK that serves Java converges: Stripe (which migrated *to*
 *    it from data classes), RevenueCat, Braze, OkHttp, Coil.
 * 3. **The Kotlin sugar is the same Builder, not a second one.** `SharingRequest { link = … }` is a
 *    top-level function taking `Builder.() -> Unit` — the "fake constructor" idiom Compose uses for
 *    `AnnotatedString`. The Builder's `var`s *are* the scope, so a default has exactly one home and
 *    the two entry points cannot drift. `@JvmOverloads` is never used: it fixes Java and leaves
 *    Kotlin callers resolving through `$default` anyway.
 *
 * Setters mirror the field's nullability rather than insisting on non-null, so a Java caller can pass
 * a value it computed as nullable without a null check at the call site. Not calling a setter is how
 * you say "absent"; passing null means the same thing.
 *
 * Two costs of this shape, accepted rather than overlooked. Each *optional* option freezes three
 * declarations, not one — `getX()`, `setX(T)` and `x(T): Builder` — because the `var` is what makes
 * the Kotlin sugar possible, and hiding the accessors with `@JvmSynthetic` would also hide a
 * genuinely-linked symbol from the dump. That also means Java autocomplete offers a `void setX(T)`
 * beside the chaining `x(T)`; the fluent one is the documented form everywhere. A *required* field
 * (`SharingProduct`'s `title`/`link`) gets no `var` and no setter, only the constructor argument.
 *
 * `build()` snapshots: it can be called more than once, and a Builder mutated afterwards does not
 * reach back into an object it already produced. `SharingRequest` copies its product list to make that
 * true of the one collection these six types put on the surface. It is not the only collection the SDK
 * exposes — `Interaction.Custom.data`, `ResolvedSdkConfig.translations`/`placements` and
 * `BestReward.matchedProducts` are others, none of them copied — but those all come *out* of the SDK
 * rather than in, so no caller holds the original.
 */

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
    /**
     * Scope fields for reward selection. Composed rather than flattened: this type's fields are
     * display copy, [ProductDetails]' are what a `productScope` can match on.
     */
    public val details: ProductDetails?,
) {
    /**
     * [title] and [link] are constructor arguments because there is no sensible product without
     * them — the sheet renders the one and shares the other.
     */
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

/**
 * Kotlin sugar over [SharingProduct.Builder]. Same Builder, same defaults, assignment syntax:
 *
 * ```kotlin
 * SharingProduct(title = product.title, link = product.url) {
 *     imageUrl = product.image
 *     details = ProductDetails { sku = product.sku }
 * }
 * ```
 */
public fun SharingProduct(
    title: String,
    link: String,
    configure: SharingProduct.Builder.() -> Unit,
): SharingProduct = SharingProduct.Builder(title, link).apply(configure).build()

/**
 * Title and link only, which is the common case: no `{ }` to write when there is nothing to
 * configure. An explicit overload rather than a default lambda — it takes exactly the two required
 * fields, so a new optional field never changes its signature.
 */
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
) {
    /**
     * Every field is optional, so this takes no constructor arguments: a bare
     * `new SharingRequest.Builder().build()` shares the merchant's homepage, which is a real and
     * supported request.
     */
    public class Builder {
        public var link: String? = null

        public var products: List<SharingProduct> = emptyList()

        public var attribution: AttributionParams? = null

        public var targetInteraction: String? = null

        public var placement: String? = null

        public var logoUrl: String? = null

        public fun link(link: String?): Builder = apply { this.link = link }

        public fun products(products: List<SharingProduct>): Builder = apply { this.products = products }

        /**
         * Appends one product. Exists for Java, where building a `List` inline is
         * `Collections.singletonList(...)` or `Arrays.asList(...)` and reads worse than a second
         * chained call.
         */
        public fun addProduct(product: SharingProduct): Builder = apply { this.products = this.products + product }

        public fun attribution(attribution: AttributionParams?): Builder = apply { this.attribution = attribution }

        public fun targetInteraction(targetInteraction: String?): Builder =
            apply { this.targetInteraction = targetInteraction }

        public fun placement(placement: String?): Builder = apply { this.placement = placement }

        public fun logoUrl(logoUrl: String?): Builder = apply { this.logoUrl = logoUrl }

        /**
         * Copies [products] rather than handing the caller's list through. Without it a caller that
         * kept a reference to a mutable list could change a request it had already built, and
         * `getProducts()` would hand Java a list whose mutability depended on whether the request was
         * built with [products] or [addProduct]. `unmodifiableList` over a fresh copy makes both
         * questions have one answer.
         */
        public fun build(): SharingRequest =
            SharingRequest(
                link,
                Collections.unmodifiableList(ArrayList(products)),
                attribution,
                targetInteraction,
                placement,
                logoUrl,
            )
    }
}

/**
 * Kotlin sugar over [SharingRequest.Builder]. Same Builder, same defaults, assignment syntax:
 *
 * ```kotlin
 * val request = SharingRequest {
 *     products = listOf(SharingProduct(product.title, product.url))
 *     targetInteraction = "purchase"
 *     placement = "product-page"
 * }
 * ```
 */
public fun SharingRequest(configure: SharingRequest.Builder.() -> Unit): SharingRequest =
    SharingRequest.Builder().apply(configure).build()
