package id.frak.sdk.ui;

import androidx.activity.ComponentActivity;

import id.frak.sdk.core.FrakConfig;
import id.frak.sdk.core.FrakCurrency;
import id.frak.sdk.core.FrakLogLevel;
import id.frak.sdk.core.FrakMetadata;
import id.frak.sdk.core.ProductDetails;
import id.frak.sdk.sharing.AttributionParams;
import id.frak.sdk.sharing.SharingProduct;
import id.frak.sdk.sharing.SharingRequest;
import id.frak.sdk.tracking.Interaction;

import java.util.Collections;

/**
 * Proof that the SDK's public API is callable from Java. Compiled by {@code :frak-sdk-ui:test};
 * never executed.
 *
 * <p>It started as a sharing-sheet fixture and has outgrown that: it now covers {@code :frak-sdk}
 * types too ({@code FrakConfig}, {@code Interaction}, the sharing input Builders), which are on this
 * module's test compile classpath through {@code api(project(":frak-sdk"))}. That is the wrong home
 * for them, and step 4 of {@code docs/plans/native-sdk/09-android-api-surface.md} gives
 * {@code :frak-sdk} its own fixture alongside the {@code *Async} twins; these move there then.
 *
 * <p>This exists because the claim that motivated the whole Builder rewrite -- "a merchant on an
 * XML or Java codebase cannot use this SDK at all" -- was, until it landed, unverified in both
 * directions. Every test and both example apps drive the SDK from inside a Compose or SwiftUI
 * tree, and CI does not build {@code example/native-android} at all. A Java source file in the
 * unit-test source set is the cheapest thing that actually fails when the API stops being
 * Java-shaped: no lambda where a SAM interface was promised, no {@code INSTANCE} where a static
 * was promised, no {@code $default} bridge a Java caller cannot name.
 *
 * <p>Deliberately <em>not</em> a JUnit test. There is nothing to assert at runtime -- the assertion
 * is that javac accepts this file.
 *
 * <p>Since every merchant-constructed type moved to a {@code Builder}, this file is also the only
 * check that the Builders are genuinely Java-shaped: a {@code $default} bridge a Java caller cannot
 * name, a setter that returns {@code Unit} instead of {@code Builder} and so breaks chaining, or a
 * {@code var} whose generated setter collides with the fluent method of the same name would all fail
 * here and nowhere else.
 */
@SuppressWarnings("unused")
final class JavaCallSiteFixture {

    private FrakSharing sharing;

    /**
     * The XML/Java build site: one Builder, a lambda for the callback (so {@code ResultCallback}
     * must stay a {@code fun interface}), and a chained setter.
     */
    void onCreate(ComponentActivity activity) {
        sharing = new FrakSharing.Builder(this::onShareResult)
                .heightFraction(0.9f)
                .build(activity);
    }

    /** Warming is explicit for a non-Compose caller; this is the whole reason it is public. */
    void onShareSurfaceVisible() {
        sharing.warm();
    }

    /**
     * The whole point of the Builder rewrite, from the Java side. Before it, this read
     * {@code new SharingRequest(null, list, null, "purchase", "product-page", null)} -- six
     * positional arguments of which four were noise, and an arity that could never grow.
     */
    void onShareTapped() {
        SharingProduct product = new SharingProduct.Builder(
                        "Babies camel cuir velours bout carre",
                        "https://example.com/product-1")
                .details(new ProductDetails.Builder().sku("SHOE-42").quantity(2.0).build())
                .build();

        SharingRequest request = new SharingRequest.Builder()
                .addProduct(product)
                .attribution(new AttributionParams.Builder().utmSource("android-app").build())
                .targetInteraction("purchase")
                .placement("product-page")
                .build();

        sharing.present(request);
    }

    /**
     * {@code FrakConfig}, the type that motivated the ban on default arguments: it grew from eight
     * parameters to nine after the last {@code .api} dump was taken, which would have been a
     * {@code NoSuchMethodError} on every shipped merchant binary.
     */
    static FrakConfig configWithMerchantId() {
        return new FrakConfig.Builder("merchant-id")
                .metadata(new FrakMetadata.Builder()
                        .name("Acme")
                        .currency(FrakCurrency.EUR)
                        .build())
                .trackingEnabled(false)
                .logLevel(FrakLogLevel.DEBUG)
                .build();
    }

    /** The no-merchant-id overload: the merchant is resolved from the package id instead. */
    static FrakConfig configWithoutMerchantId() {
        return new FrakConfig.Builder().packageId("com.acme.app").build();
    }

    /**
     * All seven of {@code Interaction}'s static factories. This is the half of the collapse only javac
     * can check: without {@code @JvmStatic} on each one these would read
     * {@code Interaction.Companion.custom(...)}, which is the exact ergonomic regression the opaque
     * shape exists to avoid. The old sealed hierarchy needed an {@code instanceof} chain here; there is
     * nothing to match on now, which is the point.
     */
    static Interaction[] everyInteractionShape() {
        return new Interaction[] {
            Interaction.arrival("0xwallet", "client-id", "merchant-id", 1_709_654_400L),
            Interaction.sharing(),
            Interaction.sharing("order-1"),
            Interaction.sharing(1_709_654_400L, "order-1"),
            Interaction.custom("checkout"),
            Interaction.custom("checkout", Collections.singletonMap("step", "2")),
            Interaction.custom("checkout", Collections.singletonMap("step", "2"), "merchant-key"),
        };
    }

    /**
     * {@code Interaction} is comparable and printable from Java too, which is what makes a merchant's
     * own tracking code testable. {@code equals} is structural over the payload.
     */
    static boolean twoIdenticalSharesAreEqual() {
        return Interaction.sharing("order-1").equals(Interaction.sharing("order-1"));
    }

    /**
     * Every arm of {@link SharingResult} reached the Java way. {@code InstallStarted} and
     * {@code Dismissed} are Kotlin {@code object}s, so they are compared by identity against
     * {@code INSTANCE}.
     */
    private void onShareResult(SharingResult result) {
        if (result instanceof SharingResult.Shared) {
            log(((SharingResult.Shared) result).getLink());
        } else if (result instanceof SharingResult.Copied) {
            log(((SharingResult.Copied) result).getLink());
        } else if (result == SharingResult.InstallStarted.INSTANCE) {
            log("install started");
        } else if (result == SharingResult.Dismissed.INSTANCE) {
            log("dismissed");
        } else if (result instanceof SharingResult.Failed) {
            log(((SharingResult.Failed) result).getError().getMessage());
        }
    }

    /** {@code HEIGHT_FRACTION} is a {@code @JvmStatic val}, not a {@code const}: a static getter, not an inlined literal. */
    static float defaultHeightFraction() {
        return FrakSharingDefaults.getHEIGHT_FRACTION();
    }

    private void log(String message) {
        // Intentionally empty: this file is a compile-time assertion, not a runtime one.
    }
}
