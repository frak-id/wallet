package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakResult
import id.frak.sdk.tracking.Interaction
import java.util.concurrent.CompletableFuture

/** Interaction and purchase tracking. Obtained from [FrakClient.tracking]. */
public class TrackingApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Records an [Interaction]; succeeds once durable, not once delivered (queued, oldest-first). */
    public suspend fun track(interaction: Interaction): FrakResult<Unit> = core.track(interaction)

    /** [track] for Java. */
    public fun trackAsync(interaction: Interaction): CompletableFuture<FrakResult<Unit>> =
        core.asFuture { core.track(interaction) }

    /** Records a purchase; same enqueue-then-send contract as [track]. */
    public suspend fun purchase(
        customerId: String,
        orderId: String,
        token: String,
    ): FrakResult<Unit> = core.trackPurchase(customerId, orderId, token)

    /** [purchase] for Java. */
    public fun purchaseAsync(
        customerId: String,
        orderId: String,
        token: String,
    ): CompletableFuture<FrakResult<Unit>> = core.asFuture { core.trackPurchase(customerId, orderId, token) }
}
