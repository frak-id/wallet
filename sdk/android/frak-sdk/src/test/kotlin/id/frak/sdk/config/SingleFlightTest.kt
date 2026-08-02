package id.frak.sdk.config

import id.frak.sdk.core.FrakError
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.newSingleThreadContext
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

/**
 * Uses [Dispatchers.Default], not `StandardTestDispatcher`, so callers get a real chance to run
 * concurrently — the single-threaded test dispatcher never caught the race this class guards.
 * Every "one execution for N callers" test gates the work block on a barrier so the flight can't
 * finish before every caller has registered; without it, a slower caller could legitimately start
 * a second, non-overlapping execution. The barrier must gate on registration, not just "reached
 * the call site": callers are dispatched onto one [newSingleThreadContext], then the gate-opener
 * dispatched onto that same context afterwards, so FIFO guarantees every caller already hit its
 * first suspension point (i.e. registered) before the gate can open.
 */
class SingleFlightTest {
    @OptIn(ObsoleteCoroutinesApi::class)
    @Test
    fun `N concurrent callers share exactly one execution`() =
        runBlocking {
            val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
            val singleFlight = SingleFlight(scope)
            val executions = AtomicInteger(0)
            val gate = CompletableDeferred<Unit>()
            val registrationDispatcher = newSingleThreadContext("single-flight-test-registration")
            try {
                val calls =
                    List(CALLERS) {
                        async(registrationDispatcher) {
                            singleFlight.run("key") {
                                gate.await()
                                executions.incrementAndGet()
                                "value"
                            }
                        }
                    }
                launch(registrationDispatcher) { gate.complete(Unit) }
                val results = calls.awaitAll()

                assertEquals("the block must run exactly once", 1, executions.get())
                assertEquals("every caller must see the same value", List(CALLERS) { "value" }, results)
            } finally {
                scope.cancel()
                registrationDispatcher.close()
            }
        }

    @OptIn(ObsoleteCoroutinesApi::class)
    @Test
    fun `a failure is propagated to every waiter, unwrapped and by identity`() =
        runBlocking {
            val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
            val singleFlight = SingleFlight(scope)
            val gate = CompletableDeferred<Unit>()
            val registrationDispatcher = newSingleThreadContext("single-flight-test-registration")
            try {
                // Fresh exception per execution: "every waiter sees the same instance" only holds
                // if the block ran exactly once, unlike a shared pre-built instance would.
                val calls =
                    List(CALLERS) {
                        async(registrationDispatcher) {
                            runCatching {
                                singleFlight.run<Unit>("key") {
                                    gate.await()
                                    throw IllegalStateException("boom")
                                }
                            }
                        }
                    }
                launch(registrationDispatcher) { gate.complete(Unit) }
                val outcomes = calls.awaitAll()

                val first = outcomes.first().exceptionOrNull()
                assertTrue("the block must have thrown", first != null)
                assertTrue(
                    "every waiter must see the same failure instance, unwrapped",
                    outcomes.all { it.exceptionOrNull() === first },
                )
            } finally {
                scope.cancel()
                registrationDispatcher.close()
            }
        }

    @Test
    fun `a completed entry does not become immortal — a later call for the same key re-executes`() =
        runBlocking {
            // Unconfined: work block has no suspension point, so scope.launch runs it (and its
            // invokeOnCompletion cleanup) eagerly before run() reaches fresh.await(), making this deterministic.
            val scope = CoroutineScope(Dispatchers.Unconfined + SupervisorJob())
            val singleFlight = SingleFlight(scope)
            val executions = AtomicInteger(0)

            try {
                repeat(ITERATIONS) { iteration ->
                    singleFlight.run("key") { executions.incrementAndGet() }
                    singleFlight.run("key") { executions.incrementAndGet() }
                    assertEquals(
                        "a later call for the same key must start a new execution, not replay a stale result",
                        (iteration + 1) * 2,
                        executions.get(),
                    )
                }
            } finally {
                scope.cancel()
            }
        }

    /**
     * Fails against the original `computeIfAbsent`/`scope.async` implementation: a `Deferred`
     * left cancelled by the runtime throws the bare `CancellationException` from `await()`
     * regardless of what the body caught, killing an innocent waiter's coroutine silently. This
     * implementation hands such a waiter a catchable [FrakError.Network] instead.
     */
    @Test
    fun `the shared flight's own cancellation reaches a waiter as a catchable FrakError`() =
        runBlocking {
            val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
            val singleFlight = SingleFlight(scope)
            val started = CompletableDeferred<Unit>()

            val waiter =
                async(Dispatchers.Default) {
                    runCatching {
                        singleFlight.run("key") {
                            started.complete(Unit)
                            awaitCancellation()
                        }
                    }
                }
            started.await()
            scope.cancel()

            val failure = waiter.await().exceptionOrNull()
            assertTrue(
                "a waiter not itself cancelled must see a catchable FrakError, got $failure",
                failure is FrakError.Network,
            )
        }

    /** Same underlying reason as above, for a scope already cancelled before `run()` is called. */
    @Test
    fun `run on an already-cancelled scope fails fast with a catchable FrakError instead of hanging`() =
        runBlocking {
            val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
            scope.cancel()
            val singleFlight = SingleFlight(scope)

            val failure =
                withTimeout(5_000) {
                    runCatching { singleFlight.run("key") { "value" } }.exceptionOrNull()
                }

            assertTrue("expected a catchable FrakError, got $failure", failure is FrakError.Network)
        }

    private companion object {
        const val CALLERS = 50
        const val ITERATIONS = 5
    }
}
