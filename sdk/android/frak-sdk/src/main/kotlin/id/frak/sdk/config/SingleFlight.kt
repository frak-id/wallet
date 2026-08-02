package id.frak.sdk.config

import id.frak.sdk.core.FrakError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Collapses concurrent calls for the same key into one execution; late callers join the run
 * already in progress. Not `computeIfAbsent`: an already-complete Job's `invokeOnCompletion`
 * fires synchronously and re-entrantly, which would deadlock/corrupt the map.
 *
 * Work runs on [scope], not the caller's, so a caller leaving composition can't cancel other
 * waiters. A cancelled shared coroutine is delivered to waiters as [FrakError.Network] (never a
 * bare [CancellationException] they don't own, which `frakCall` would rethrow and silently kill
 * their coroutine).
 *
 * Cleanup is driven by the Job's `invokeOnCompletion`, not the coroutine body: if [scope] is
 * already cancelled, `launch` never runs the body (or its `finally`) at all.
 */
internal class SingleFlight(
    private val scope: CoroutineScope,
) {
    private val inFlight = ConcurrentHashMap<String, Deferred<*>>()

    @Suppress("UNCHECKED_CAST")
    suspend fun <T> run(
        key: String,
        block: suspend () -> T,
    ): T {
        val fresh = CompletableDeferred<Result<T>>()
        val existing = inFlight.putIfAbsent(key, fresh)
        if (existing == null) {
            try {
                val job =
                    scope.launch {
                        try {
                            fresh.complete(Result.success(block()))
                        } catch (cancelled: CancellationException) {
                            fresh.complete(Result.failure(FrakError.Network(cancelled)))
                            throw cancelled
                        } catch (failure: Throwable) {
                            fresh.complete(Result.failure(failure))
                        }
                    }
                job.invokeOnCompletion { cause ->
                    // Fires even if `launch`'s block never started; otherwise fresh hangs forever.
                    if (fresh.isActive) {
                        fresh.complete(
                            Result.failure(
                                FrakError.Network(
                                    cause ?: CancellationException("Frak SDK scope is no longer active"),
                                ),
                            ),
                        )
                    }
                    // remove(key, value): a slow completion must not evict a newer entry.
                    inFlight.remove(key, fresh)
                }
            } catch (failure: Throwable) {
                // scope.launch itself can throw (e.g. RejectedExecutionException) before a Job
                // exists to hang invokeOnCompletion off of; complete/evict here or fresh hangs forever.
                fresh.complete(Result.failure(failure))
                inFlight.remove(key, fresh)
                throw failure
            }
        }
        return ((existing ?: fresh) as Deferred<Result<T>>).await().getOrThrow()
    }
}
