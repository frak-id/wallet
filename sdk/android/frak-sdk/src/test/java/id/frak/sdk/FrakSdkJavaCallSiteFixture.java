package id.frak.sdk;

import id.frak.sdk.config.FrakResolvedConfig;
import id.frak.sdk.core.FrakConfig;
import id.frak.sdk.core.FrakError;
import id.frak.sdk.core.FrakResult;
import id.frak.sdk.core.ProductDetails;
import id.frak.sdk.rewards.BestReward;
import id.frak.sdk.rewards.Campaign;
import id.frak.sdk.rewards.RewardRequest;
import id.frak.sdk.sharing.SharingRequest;
import id.frak.sdk.tracking.Interaction;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

/**
 * javac accepting this file is the assertion: a {@code suspend} member reaching {@code :frak-sdk}'s public
 * surface, or a {@code $default} bridge, fails to compile here. Compiled by {@code :frak-sdk:test}; never executed.
 */
@SuppressWarnings("unused")
final class FrakSdkJavaCallSiteFixture {

    /** Identity and consent. */
    static void identity(FrakClient client) {
        CompletableFuture<String> anonymousId = client.anonymousIdAsync();
        CompletableFuture<Boolean> reset = client.resetAnonymousIdAsync();
        CompletableFuture<Void> disabled = client.setTrackingEnabledAsync(false);
        CompletableFuture<Boolean> enabled = client.isTrackingEnabledAsync();

        // A naive `thenAccept` has to land on the main thread, because this is what a merchant writes.
        anonymousId.thenAccept(FrakSdkJavaCallSiteFixture::log);
    }

    /** Config, and the error model: a {@code FrakError} arrives wrapped in a {@code CompletionException}. */
    static void config(FrakClient client) {
        CompletableFuture<FrakResolvedConfig> cached = client.getConfig().resolveAsync();
        CompletableFuture<FrakResolvedConfig> fresh = client.getConfig().resolveAsync(true);

        cached.whenComplete((resolved, failure) -> {
            if (failure instanceof CompletionException && failure.getCause() instanceof FrakError) {
                log(failure.getCause().getMessage());
            } else if (resolved != null) {
                log(resolved.getDisplayName());
            }
        });
        fresh.exceptionally(failure -> null);
    }

    /** Rewards. */
    static void rewards(FrakClient client) {
        CompletableFuture<List<Campaign>> campaigns = client.getRewards().campaignsAsync();
        CompletableFuture<List<Campaign>> freshCampaigns = client.getRewards().campaignsAsync(true);

        RewardRequest request = new RewardRequest.Builder()
                .targetInteraction("purchase")
                .addProduct(new ProductDetails.Builder().sku("SHOE-42").build())
                .build();

        CompletableFuture<BestReward> best = client.getRewards().bestAsync(request);
        CompletableFuture<BestReward> freshBest = client.getRewards().bestAsync(request, true);

        best.thenAccept(reward -> log(reward == null ? "no reward" : reward.getFormatted()));
    }

    /** Sharing and tracking. */
    static void sharingAndTracking(FrakClient client) {
        CompletableFuture<String> link = client.getSharing()
                .buildLinkAsync(new SharingRequest.Builder().targetInteraction("purchase").build());

        CompletableFuture<FrakResult<kotlin.Unit>> tracked = client.getTracking()
                .trackAsync(Interaction.custom("checkout"));
        CompletableFuture<FrakResult<kotlin.Unit>> purchased = client.getTracking()
                .purchaseAsync("customer-1", "order-1", "token");

        tracked.thenAccept(FrakSdkJavaCallSiteFixture::logResult);
        purchased.thenAccept(FrakSdkJavaCallSiteFixture::logResult);
        link.thenAccept(FrakSdkJavaCallSiteFixture::log);
    }

    /**
     * Takes {@code FrakResult<?>}, not {@code FrakResult<Unit>}: {@code Failure} is Kotlin's
     * {@code FrakResult<Nothing>}, which javac reads as {@code FrakResult<Void>}, so {@code instanceof}
     * against a {@code FrakResult<Unit>} is an "inconvertible types" error. The wildcard is the fix.
     */
    private static void logResult(FrakResult<?> result) {
        if (result instanceof FrakResult.Success) {
            log("queued");
        } else if (result instanceof FrakResult.Failure) {
            log(((FrakResult.Failure) result).getError().getMessage());
        }
    }

    /** The wallet handoff. {@code isFrakAppInstalled} needs no twin -- it never suspended. */
    static void appLink(FrakClient client) {
        boolean installed = client.getAppLink().isFrakAppInstalled();

        CompletableFuture<Boolean> handled = client.getAppLink().handleReferralAsync("https://acme.example/?fCtx=x");
        CompletableFuture<OpenAppResult> opened = client.getAppLink().openFrakAppAsync();
        CompletableFuture<String> storeUrl = client.getAppLink().installUrlAsync();
        CompletableFuture<String> installPage = client.getAppLink()
                .installPageUrlAsync("acmeapp", "session-1");

        opened.thenAccept(result -> log(result == OpenAppResult.OpenedApp ? "app" : "store"));
    }

    /** Teardown. {@code shutdownAsync} needs {@code @JvmStatic}: {@code Frak} is a Kotlin {@code object}. */
    static void teardown(FrakConfig config) {
        Frak.shutdownAsync().thenRun(() -> log("torn down"));
    }

    private static void log(String message) {
        // Intentionally empty: this file is a compile-time assertion, not a runtime one.
    }
}
