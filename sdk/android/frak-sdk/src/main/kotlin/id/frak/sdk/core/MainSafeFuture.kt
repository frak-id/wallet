package id.frak.sdk.core

import android.os.Looper
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/** True on the thread the Java `*Async` twins complete on. */
internal fun isMainThread(): Boolean = Looper.myLooper() == Looper.getMainLooper()

/**
 * A future that refuses to block the one thread its own completion needs. The `*Async` twins
 * complete on the main looper so a merchant's `thenAccept` can touch views, which leaves
 * `get()`/`join()` from that thread unanswerable — so it fails there instead of hanging to an ANR.
 */
internal class MainSafeFuture<T>(
    private val onMainThread: () -> Boolean = ::isMainThread,
) : CompletableFuture<T>() {
    override fun get(): T {
        refuseOnMainThread()
        return super.get()
    }

    override fun get(
        timeout: Long,
        unit: TimeUnit,
    ): T {
        refuseOnMainThread()
        return super.get(timeout, unit)
    }

    override fun join(): T {
        refuseOnMainThread()
        return super.join()
    }

    /** Carries the guard into `thenApply`-style derivatives, on the API levels that consult it. */
    override fun <U> newIncompleteFuture(): CompletableFuture<U> = MainSafeFuture(onMainThread)

    private fun refuseOnMainThread() {
        check(!onMainThread()) {
            "A Frak *Async future completes on the main thread, so blocking on one from the main " +
                "thread deadlocks. Use thenAccept/whenComplete, or block from a background thread."
        }
    }
}

/**
 * Mirrors this future into one that cannot be blocked on from the main thread, and routes a
 * caller's cancellation back so the coroutine behind it stops with the copy they hold.
 */
internal fun <T> CompletableFuture<T>.mainSafe(onMainThread: () -> Boolean = ::isMainThread): CompletableFuture<T> {
    val guarded = MainSafeFuture<T>(onMainThread)
    whenComplete { value, failure ->
        if (failure == null) guarded.complete(value) else guarded.completeExceptionally(failure)
    }
    guarded.whenComplete { _, failure -> if (failure is CancellationException) cancel(true) }
    return guarded
}
