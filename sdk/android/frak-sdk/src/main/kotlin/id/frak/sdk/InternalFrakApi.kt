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
// PROPERTY as well as CLASS: `FrakSdkVersion`'s wire constants are members of an otherwise
// merchant-facing object, so the marker has to land on the property, not the enclosing type.
@Target(AnnotationTarget.CLASS, AnnotationTarget.PROPERTY, AnnotationTarget.FUNCTION)
public annotation class InternalFrakApi
