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
 * Proof that {@code :frak-sdk}'s public API is callable from Java. Compiled by
 * {@code :frak-sdk:test}; never executed.
 *
 * <p>The twin of {@code :frak-sdk-ui}'s {@code JavaCallSiteFixture}, and the file
 * {@code docs/plans/native-sdk/09-android-api-surface.md} §6 asks for alongside the {@code *Async}
 * work. It exists because there is exactly one thing that can go wrong here and no runtime test can
 * see it: a {@code suspend} function compiles to a method taking a {@code kotlin.coroutines.Continuation},
 * which a Java caller cannot name or supply. Before the twins, a Java merchant could call
 * <em>none</em> of the fifteen suspending members of {@code FrakClient} and its five namespaces. The
 * assertion is that javac accepts this file.
 *
 * <p>Deliberately <em>not</em> a JUnit test. There is nothing to assert at runtime; nothing here is
 * ever invoked, so no client has to be initialised and no {@code Looper} is ever touched.
 *
 * <p>What it catches, concretely: a {@code Continuation} reaching the public surface; a
 * {@code $default} bridge a Java caller cannot name (which is why every one of these calls passes
 * every argument); a missing {@code @JvmStatic} on {@code Frak}; and a twin that returns
 * {@code CompletableFuture<Unit>} where {@code Void} was meant.
 */
@SuppressWarnings("unused")
final class FrakSdkJavaCallSiteFixture {

    /**
     * Identity and consent. Note {@code setTrackingEnabledAsync} is {@code CompletableFuture<Void>},
     * not {@code CompletableFuture<Unit>} -- {@code kotlin.Unit} on a Java signature is noise.
     */
    static void identity(FrakClient client) {
        CompletableFuture<String> anonymousId = client.anonymousIdAsync();
        CompletableFuture<Boolean> reset = client.resetAnonymousIdAsync();
        CompletableFuture<Void> disabled = client.setTrackingEnabledAsync(false);
        CompletableFuture<Boolean> enabled = client.isTrackingEnabledAsync();

        // The reason invariant 1 exists: a naive `thenAccept` has to land on the main thread, because
        // this is what a merchant writes.
        anonymousId.thenAccept(FrakSdkJavaCallSiteFixture::log);
    }

    /**
     * Config, and the error model. A {@code FrakError} arrives wrapped in a
     * {@code CompletionException}; the {@code suspend} twin throws it directly. One error idiom per
     * language, rather than a second result type layered over the future.
     */
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

    /**
     * Rewards. {@code best} takes a {@code RewardRequest} rather than four optional parameters, which
     * from Java is the difference between one Builder and four positional nulls.
     */
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

    /** Sharing and tracking. {@code trackAsync} mirrors {@code track}'s {@code FrakResult}, unwrapped by nobody. */
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
     * Matching a {@code FrakResult} from Java, and a trap worth recording: this takes
     * {@code FrakResult<?>}, not {@code FrakResult<Unit>}. {@code Failure} is Kotlin's
     * {@code FrakResult<Nothing>}, which javac sees as a final class implementing
     * {@code FrakResult<Void>} -- and Kotlin's declaration-site {@code out T} is metadata javac does
     * not read, so {@code FrakResult<Unit>} and {@code FrakResult<Void>} are provably distinct and
     * {@code instanceof FrakResult.Failure} on a {@code FrakResult<Unit>} is an "inconvertible types"
     * error. A wildcard is the fix, and it is the shape a Java merchant should copy.
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

    /**
     * Teardown. {@code shutdownAsync} needs {@code @JvmStatic} -- {@code Frak} is a Kotlin
     * {@code object}, so without it this would read {@code Frak.INSTANCE.shutdownAsync()}.
     */
    static void teardown(FrakConfig config) {
        Frak.shutdownAsync().thenRun(() -> log("torn down"));
    }

    private static void log(String message) {
        // Intentionally empty: this file is a compile-time assertion, not a runtime one.
    }
}
