package id.frak.sdk

/**
 * Marks a declaration that is `public` only so the sibling `:frak-sdk-ui` module can see it, with no
 * compatibility guarantee. Wired into binary-compatibility-validator's `nonPublicMarkers`, so marked
 * types stay out of the committed `.api` dump.
 */
@RequiresOptIn(
    level = RequiresOptIn.Level.ERROR,
    message = "Internal to the Frak SDK; not covered by compatibility guarantees.",
)
@Retention(AnnotationRetention.BINARY)
@Target(AnnotationTarget.CLASS)
public annotation class InternalFrakApi
