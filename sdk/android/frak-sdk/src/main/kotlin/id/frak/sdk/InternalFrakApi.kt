package id.frak.sdk

/**
 * Marks a declaration that is `public` only because a second Gradle module has to see it, and
 * carries no compatibility guarantee whatsoever.
 *
 * `public` in Kotlin means two unrelated things at once here: "a merchant may call this" and
 * "the sibling artifact may call this". `internal` is per-module, so anything `:frak-sdk-ui`
 * needs from `:frak-sdk` has to be `public` even when no merchant should ever name it. This
 * marker separates the two.
 *
 * **What it does today:** a Kotlin consumer naming a marked declaration gets a compile error.
 * That is the whole of it. binary-compatibility-validator is not applied to this build yet, so the
 * second half of the intent — `nonPublicMarkers` keeping marked declarations out of the committed
 * `.api` dump, instead of freezing them there by accident — arrives with the dump, as the last step
 * of `docs/plans/native-sdk/09-android-api-surface.md`. Until then this annotation is documentation
 * plus a compiler error.
 *
 * **`@Target(CLASS)` deliberately, and nothing else.** A marker on a `val` is resolved by Kotlin
 * against `param → property → field` and, on either of the first two, never reaches the class
 * file as a Java annotation — it lives in `@Metadata` and a synthetic `getX$annotations()`
 * holder, which the validator filters out. So a property-level marker would gate the Kotlin
 * compiler and leave the getter frozen in the dump: the worst of both. A class-level marker
 * propagates to every member for the compiler *and* removes the whole class from the dump. If a
 * single member of an otherwise merchant-facing type seems to need this, the type is
 * misclassified — split it instead.
 *
 * The `CLASS`-only restriction is a starting point chosen for dump visibility, not a principle. It
 * can be widened additively if a non-class declaration genuinely has to cross the module boundary —
 * but a constructor or function marker must be checked against a real `apiDump` first, since the
 * whole reason for the restriction is that not every placement survives to the class file.
 *
 * **Kotlin-only, and that is a real hole now that Java is a supported consumer.** `@RequiresOptIn`
 * is a Kotlin-compiler concept with no javac enforcement: a Java merchant gets no diagnostic. The
 * guarantee this annotation actually buys is the honest dump, plus a Kotlin compile error. Nothing
 * gives a Java merchant a diagnostic: `internal` is emitted `public` in bytecode, and while Kotlin
 * name-mangles `internal` *functions*, it cannot mangle a constructor. So the resolved-config tree's
 * `internal` constructors stop a Kotlin merchant outright and put nothing in the `.api` dump — which
 * is the compatibility contract — while a Java caller who goes looking is simply outside it.
 */
@RequiresOptIn(
    level = RequiresOptIn.Level.ERROR,
    message = "Internal to the Frak SDK; not covered by compatibility guarantees.",
)
@Retention(AnnotationRetention.BINARY)
@Target(AnnotationTarget.CLASS)
public annotation class InternalFrakApi
