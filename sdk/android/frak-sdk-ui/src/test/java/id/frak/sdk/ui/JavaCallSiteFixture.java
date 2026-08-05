package id.frak.sdk.ui;

import androidx.activity.ComponentActivity;

import java.util.Collections;

import id.frak.sdk.sharing.SharingProduct;
import id.frak.sdk.sharing.SharingRequest;

/**
 * Proof that the sharing sheet's public API is callable from Java. Compiled by
 * {@code :frak-sdk-ui:test}; never executed.
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

    void onShareTapped() {
        SharingProduct product = new SharingProduct(
                "Babies camel cuir velours bout carre",
                "https://example.com/product-1",
                null,
                null,
                null);
        SharingRequest request = new SharingRequest(
                null,
                Collections.singletonList(product),
                null,
                "purchase",
                "product-page",
                null);
        sharing.present(request);
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
