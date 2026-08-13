package id.frak.example.android;

import androidx.annotation.NonNull;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

import id.frak.sdk.Frak;
import id.frak.sdk.FrakClient;
import id.frak.sdk.core.FrakResult;
import id.frak.sdk.tracking.Interaction;

/**
 * Compiles the {@code *Async} surface from Java, which nothing else in the repo does — it is frozen
 * in {@code frak-sdk.api} and had no consumer, so a signature only Kotlin can call would have
 * shipped unnoticed. Wired to a debug button, so the calls are executed and not merely compiled.
 */
public final class JavaInterop {

    private JavaInterop() {}

    /** Every {@code *Async} entry point a Java merchant would reach for, in one pass. */
    public static void exercise(@NonNull Consumer<String> log) {
        if (!Frak.isInitialized()) {
            log.accept("Java interop: SDK not initialized yet.");
            return;
        }
        FrakClient client = Frak.getClient();

        // Unwrapped, not FrakResult: the suspend originals return the value itself.
        client.anonymousIdAsync()
                .thenAccept(id -> log.accept("Java anonymousIdAsync -> " + id));
        client.getConfig().resolveAsync()
                .thenAccept(config -> log.accept("Java resolveAsync -> " + config));

        // Consent and identity hang off the client; only events live on `tracking`.
        client.isTrackingEnabledAsync()
                .thenAccept(enabled -> log.accept("Java isTrackingEnabledAsync -> " + enabled));

        Map<String, String> data = new LinkedHashMap<>();
        data.put("source", "java-interop");
        client.getTracking().trackAsync(Interaction.custom("java_probe", data))
                .thenAccept(result -> log.accept("Java trackAsync -> " + describe(result)));

        // Bound but not completed: calling it would enqueue a real purchase row. The point is that
        // the signature is compiled against from Java at all.
        CompletableFuture<FrakResult<kotlin.Unit>> purchase =
                client.getTracking().purchaseAsync("customer", "order", "token");
        log.accept("Java purchaseAsync signature bound: " + (purchase != null));

        log.accept("Java isFrakAppInstalled -> " + client.getAppLink().isFrakAppInstalled());
    }

    /**
     * {@code Failure} is {@code FrakResult<Nothing>}, so Java sees it as raw while {@code Success}
     * stays generic. The unchecked cast below is what a Java merchant has to write.
     */
    private static String describe(FrakResult<?> result) {
        if (result instanceof FrakResult.Success) {
            return "Success(" + ((FrakResult.Success<?>) result).getValue() + ")";
        }
        if (result instanceof FrakResult.Failure) {
            return "Failure(" + ((FrakResult.Failure) result).getError() + ")";
        }
        return String.valueOf(result);
    }
}
