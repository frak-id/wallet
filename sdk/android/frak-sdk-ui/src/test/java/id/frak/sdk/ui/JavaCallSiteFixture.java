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
 * javac accepting this file is the assertion: a {@code suspend} member reaching the public surface, or a
 * {@code $default} bridge, fails to compile here. Compiled by {@code :frak-sdk-ui:test}; never executed.
 */
@SuppressWarnings("unused")
final class JavaCallSiteFixture {

    private FrakSharing sharing;

    /** The lambda requires {@code ResultCallback} to stay a {@code fun interface}. */
    void onCreate(ComponentActivity activity) {
        sharing = new FrakSharing.Builder(this::onShareResult)
                .heightFraction(0.9f)
                .build(activity);
    }

    void onShareSurfaceVisible() {
        sharing.warm();
    }

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

    static FrakConfig configWithoutMerchantId() {
        return new FrakConfig.Builder().packageId("com.acme.app").build();
    }

    /** Without {@code @JvmStatic} these would read {@code Interaction.Companion.custom(...)}. */
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

    static boolean twoIdenticalSharesAreEqual() {
        return Interaction.sharing("order-1").equals(Interaction.sharing("order-1"));
    }

    /** The Kotlin {@code object} arms are compared by identity against {@code INSTANCE}. */
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

    /** {@code HEIGHT_FRACTION} is a {@code @JvmStatic val}: a static getter, not an inlined literal. */
    static float defaultHeightFraction() {
        return FrakSharingDefaults.getHEIGHT_FRACTION();
    }

    private void log(String message) {
        // Intentionally empty: this file is a compile-time assertion, not a runtime one.
    }
}
