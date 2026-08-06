package id.frak.sdk.core

import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlin.coroutines.CoroutineContext

/**
 * Posts to the main looper; what the `*Async` twins complete on. Hand-rolled because
 * `Dispatchers.Main` lives in `kotlinx-coroutines-android`, which is on no classpath here. The
 * handler is `by lazy` so `Looper.getMainLooper()` is only touched on the first dispatch.
 */
internal object MainThreadDispatcher : CoroutineDispatcher() {
    private val handler by lazy { Handler(Looper.getMainLooper()) }

    override fun dispatch(
        context: CoroutineContext,
        block: Runnable,
    ) {
        if (handler.post(block)) return
        // `post` returns false only when the looper is exiting; cancel and run the block anyway, so
        // the coroutine resumes and finishes instead of staying suspended forever.
        context.cancel(CancellationException("Frak's main looper is shutting down"))
        Dispatchers.IO.dispatch(context, block)
    }
}
