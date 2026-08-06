package id.frak.sdk.core

import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlin.coroutines.CoroutineContext

/**
 * Posts to the main looper. What the `*Async` twins complete on, so a Java caller's
 * `future.thenAccept { textView.text = … }` lands where a `View` can be touched.
 *
 * **Hand-rolled rather than `Dispatchers.Main`,** which lives in `kotlinx-coroutines-android` and is
 * on no classpath in this build. Touching it throws
 * `IllegalStateException: Module with the Main dispatcher had failed to initialize` inside the
 * merchant's process. Adding the artifact would fix a twelve-line dispatcher at the cost of a second
 * runtime dependency in a library that advertises one — and it would not even buy testability, since
 * its `Dispatchers.Main` resolves through `Looper.getMainLooper()`, which throws
 * `Method … not mocked` on the stubbed `android.jar` these tests run against. The seam that does work
 * is constructor injection, which is what `DefaultFrakClient` uses.
 *
 * `:frak-sdk-ui` has a near-twin, `SharingHost.kt`'s `MainThreadDispatcher`, for the same reason.
 * Deliberately duplicated rather than shared: sharing means promoting this to
 * `@InternalFrakApi public`, which would couple it to a `nonPublicMarkers` mechanism that has not
 * fired against a real `apiDump` yet (`09-android-api-surface.md` §3a). Revisit after it has.
 *
 * **The handler is `by lazy`, and that is not a micro-optimisation.** `:frak-sdk`'s unit tests run
 * against the stubbed `android.jar`, so `Looper.getMainLooper()` throws there. Deferring it to the
 * first `dispatch` means class initialisation is free, constructing a client is free, and only an
 * `*Async` call that did *not* inject a dispatcher ever reaches the framework.
 *
 * Always dispatches, never runs inline: `future.complete` must not run on the thread that happened to
 * finish the work.
 */
internal object MainThreadDispatcher : CoroutineDispatcher() {
    private val handler by lazy { Handler(Looper.getMainLooper()) }

    override fun dispatch(
        context: CoroutineContext,
        block: Runnable,
    ) {
        if (handler.post(block)) return
        // `post` returns false only when the looper is exiting, i.e. the process is going away.
        // Dropping the block would leave whatever is waiting on this resumption suspended forever —
        // for a `*Async` twin, a future that never completes. Cancel and then run it anyway, so the
        // coroutine resumes, observes the cancellation and finishes. This is what
        // `kotlinx-coroutines-android`'s own `HandlerContext` does, and the reason to copy it rather
        // than reinvent it.
        context.cancel(CancellationException("Frak's main looper is shutting down"))
        Dispatchers.IO.dispatch(context, block)
    }
}
