package id.frak.sdk.identity

import id.frak.sdk.config.KeyValueStore
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.TrackingConsent
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import kotlin.coroutines.coroutineContext

/**
 * One P-256 keypair per app installation, and the id derived from it:
 * `clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])`.
 *
 * The key is the identity; the id is never read back from storage, only re-derived from the key
 * and memoised. No unprovable fallback: when the platform can't produce key material,
 * [anonymousId] is null (not a random unsigned id) and the SDK behaves as if tracking were off.
 *
 * 4.5: generation is a suspend/coroutine-native single-flight rather than a blocking
 * `synchronized`/`@Volatile` pair, so a keystore round-trip never blocks a caller's thread
 * (previously the main thread, on the very first read). [startEagerGeneration] kicks off the
 * mint as soon as this store exists; a caller racing that warm-up now awaits the SAME in-flight
 * [Deferred] instead of redundantly re-entering [load] behind a lock.
 */
internal class AnonymousIdStore(
    private val keyStore: DeviceKeyStore,
    private val store: KeyValueStore,
    private val logger: FrakLogger,
    /** Whatever identifies this merchant in `FrakConfig` — its id when set, its package id otherwise. */
    private val merchantMarker: String,
    /**
     * S6a/C7: the runtime consent handle, not the build-time `FrakConfig.trackingEnabled` boolean
     * this parameter used to be. Read fresh at the single gate site ([current]) rather than
     * captured once, so a `setTrackingEnabled(false)` mid-session actually stops the next mint
     * instead of taking effect only after the merchant's app is relaunched.
     *
     * One gate here, two on iOS: `startEagerGeneration` is `suspend`-free on this platform (it only
     * launches into a scope), so it can defer the whole decision to [current]; the Swift twin's
     * equivalent has to make the cross-actor read itself before it can decide whether to start a
     * `Task` at all.
     */
    private val consent: TrackingConsent,
    private val ioDispatcher: CoroutineDispatcher,
) {
    private class Identity(
        val key: DeviceKey,
        val id: String,
    )

    private val mutex = Mutex()
    private var generation: Deferred<Identity?>? = null

    /**
     * Bound at [startEagerGeneration]; every [async] this store starts is a child of it, never of
     * an ad-hoc scope. `@Volatile`: written outside [mutex] by [startEagerGeneration] and read
     * inside a `mutex.withLock` block that may run on a different thread ([current] via
     * [requireEagerScope]) — without this, that read has no guaranteed happens-before edge to the
     * write, since a `Mutex` is not a memory barrier over state it did not itself protect the write of.
     */
    @Volatile
    private var eagerScope: CoroutineScope? = null

    /**
     * Starts the keystore mint now, off the caller's thread. Called once by
     * [id.frak.sdk.core.DefaultFrakClient]'s `init`, so a later [anonymousId] read usually awaits
     * an already-completed [Deferred] rather than starting the round-trip itself. Fire-and-forget
     * by design — see the caller for why nothing awaits this. [scope] is also retained as the
     * parent for any later [async] this store starts (a caller racing ahead of this warm-up, or a
     * fresh mint after [reset]), so every generation this store ever starts is structured under
     * the client's own lifetime rather than a scope of its own.
     */
    fun startEagerGeneration(scope: CoroutineScope) {
        eagerScope = scope
        // No consent pre-check here: [current] makes the same call and is the single gate. A
        // check here as well would be a second read of a suspend value from a non-suspend
        // function, which is exactly how the two gates drift apart.
        scope.launch { current() }
    }

    /** Awaits the in-flight or already-completed generation; never null purely on a timing race. */
    suspend fun anonymousId(): String? = current()?.id

    /** Never throws; callers must treat proofs as always-optional. */
    suspend fun signProof(
        op: ProofOp,
        merchantId: String,
        binding: ByteArray = ByteArray(0),
        ts: Long = System.currentTimeMillis() / 1000,
    ): String? {
        val identity = current() ?: return null
        return try {
            val message = ProofCodec.buildMessage(op, merchantId, identity.id, binding, ts)
            ProofCodec.encodeProof(identity.key.publicKeyUncompressed, ts, identity.key.sign(message))
        } catch (failure: Exception) {
            logger.warn("Could not sign a ${op.wireValue} proof", failure)
            null
        }
    }

    /**
     * Destroys the keypair; caller is responsible for purging anything already queued under the
     * dead id — but only when this returns true. The in-flight/cached generation is cleared
     * either way, but that alone does not rotate the id: a throwing `deleteEntry` leaves the entry
     * itself alive in the keystore, so the very next [anonymousId] call falls through to [load],
     * which reads that same surviving key back and re-derives the *same* id, undoing the reset.
     * Returning false lets the caller keep queued events under the id they were actually captured
     * under, rather than purge them on the assumption a rotation happened that did not.
     *
     * Clearing [generation] under the same lock a fresh mint reads it from (4.5) closes a race
     * the previous `@Volatile` version had: a generation already in flight when [reset] runs can
     * no longer publish the OLD identity afterwards, because the next [current] call sees
     * `generation == null` and starts a brand new one rather than awaiting the stale one.
     *
     * The in-flight [Deferred], if any, is also cancelled before being cleared: an in-flight
     * [load] racing this call must not write [MERCHANT_MARKER_KEY] back after the removal below
     * removes it — mirrors the iOS twin's `generation?.cancel()` plus [load]'s
     * `coroutineContext.isActive` guard on the marker write. Cancellation never changes what THIS
     * call returns: [keyStore.delete] either succeeds or fails on its own, independent of what a
     * cancelled generation was doing.
     *
     * The keystore delete and the SharedPreferences removal both move to [ioDispatcher] (4.5):
     * this is a suspend fun a merchant calls from `lifecycleScope`, typically `Dispatchers.Main`,
     * and `keyStore.delete()` is the same blocking keystore I/O this whole finding exists to keep
     * off that thread. The `withContext` hop happens AFTER `generation = null`, and nothing it
     * reaches ([DeviceKeyStore.delete], [KeyValueStore.remove]) ever calls back into this store,
     * so it cannot re-acquire [mutex] — Kotlin's [Mutex] is not reentrant, and a nested acquisition
     * here would be a silent permanent deadlock.
     */
    suspend fun reset(): Boolean =
        mutex.withLock {
            generation?.cancel()
            generation = null
            withContext(ioDispatcher) {
                val erased =
                    runCatching { keyStore.delete() }
                        .onFailure {
                            logger.error("Could not destroy the identity keypair; anonymousId was not reset", it)
                        }.isSuccess
                if (erased) store.remove(MERCHANT_MARKER_KEY)
                erased
            }
        }

    /**
     * `await()` deliberately happens OUTSIDE the lock: awaiting a keystore round-trip while
     * holding [mutex] would serialise every reader behind the first one in, reintroducing the
     * exact blocking 4.5 exists to remove.
     *
     * A refusal is never cached (see the KDoc on the recovery test): a keystore can refuse for
     * reasons that pass — a locked device before first unlock, a transient JCE hiccup — and
     * caching the failure would turn one refusal into an install that never tracks again. So
     * after awaiting a [Deferred] that resolved to null, this clears [generation] under the lock
     * — but ONLY if `generation` is STILL the exact same [Deferred] instance (`===`) this call
     * awaited. That identity check is what makes the clear race-safe: if a concurrent [reset] or
     * a newer [current] call already replaced `generation` (with `null`, or with a fresh mint),
     * this call's `withLock` block leaves it alone instead of clobbering something newer than the
     * failure it observed.
     */
    private suspend fun current(): Identity? {
        // The one gate. Checked before `generation` is read, so a DENIED consent short-circuits
        // ahead of any keystore work — including on the first launch of a build that reads a denial
        // already on disk, which is what makes "denied consent, no key material" true rather than
        // merely claimed.
        //
        // Note what that does NOT say. The shipped default is `trackingEnabled = true` with no
        // recorded decision, which this treats as permitted (see TrackingConsent's table), so the
        // keypair IS minted on first launch before any CMP has spoken. A merchant who needs
        // consent-before-anything ships `FrakConfig(trackingEnabled = false)` and lifts nothing
        // — or, more usefully, calls setTrackingEnabled(false) before the first tracked event.
        //
        // Nor is this a barrier: a withdrawal landing AFTER this returns but before `load()`
        // finishes still completes that mint. `reset()` cancels an in-flight generation;
        // `setTrackingEnabled(false)` deliberately does not, because it is a pause, not an erasure.
        if (!consent.isEnabled()) return null
        val existing = mutex.withLock { generation }
        if (existing != null) return awaitAndDropIfFailed(existing)
        val started =
            mutex.withLock {
                generation ?: requireEagerScope().async(ioDispatcher) { load() }.also { generation = it }
            }
        return awaitAndDropIfFailed(started)
    }

    private suspend fun awaitAndDropIfFailed(deferred: Deferred<Identity?>): Identity? {
        val identity =
            try {
                deferred.await()
            } catch (cancelled: CancellationException) {
                // The shared Deferred was cancelled by a concurrent reset() (Fix 3), not by
                // OUR caller. If it were our own coroutine that got cancelled, this catch is
                // moot: the enclosing suspend point (this very `await`) already saw it and the
                // exception below would be identical either way, so ensureActive() re-raises
                // it precisely when this coroutine's own job, not the shared Deferred's, is
                // the one that is gone. Reset already dropped `generation` itself, so there is
                // nothing to clear here — unlike the null-result path below, which drops it on
                // this call's behalf only if reset (or a newer mint) has not already done so.
                coroutineContext.ensureActive()
                null
            }
        if (identity == null) {
            mutex.withLock { if (generation === deferred) generation = null }
        }
        return identity
    }

    /**
     * [startEagerGeneration] always runs before any suspend function on this store can be called
     * — [id.frak.sdk.core.DefaultFrakClient]'s `init` calls it synchronously as its first line,
     * before publishing `this` to anything that could call [anonymousId]/[signProof]/[reset]. A
     * null [eagerScope] here means that invariant broke; rather than crash a merchant's app on
     * what would be an SDK construction-order bug, this logs and falls back to the identity-is-
     * unavailable outcome the rest of the store already uses for every other kind of refusal.
     */
    private fun requireEagerScope(): CoroutineScope =
        eagerScope ?: run {
            logger.error(
                "AnonymousIdStore.startEagerGeneration did not run before anonymousId()/signProof()/reset(); " +
                    "this is an SDK bug, please report it. Tracking will be inert.",
            )
            CoroutineScope(ioDispatcher)
        }

    private suspend fun load(): Identity? =
        try {
            // Changed merchant id = different merchant; checked before the key is read so a stale key is never used.
            if (store.getString(MERCHANT_MARKER_KEY).let { it != null && it != merchantMarker }) {
                logger.info("Merchant changed for this install; regenerating the anonymous id.")
                keyStore.delete()
            }
            val key = keyStore.loadOrCreate()
            // A `reset()` that ran while this was in flight already removed the marker (and
            // cancelled this call); writing it back here would resurrect it for a key this
            // generation no longer owns. Mirrors the iOS twin's `Task.isCancelled` check.
            if (coroutineContext.isActive) {
                store.putString(MERCHANT_MARKER_KEY, merchantMarker)
            }
            Identity(key, ProofCodec.deriveClientIdFromHash(sha256(key.publicKeyUncompressed)))
        } catch (cancelled: CancellationException) {
            // Must rethrow, not fall into the catch below: reset() cancelling this Deferred
            // needs the coroutine to actually complete as cancelled, not with a swallowed `null`
            // result — the latter would break awaitAndDropIfFailed's structured-concurrency
            // contract, and this codebase's rule elsewhere is that a CancellationException is
            // never swallowed (see DefaultFrakClient.kt's frakCall/SingleFlight for the same rule).
            throw cancelled
        } catch (failure: Exception) {
            // Keystore generation fails on some devices; losing attribution beats crashing the app.
            logger.error("Could not derive an anonymous id; tracking will be inert.", failure)
            null
        }

    private fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    private companion object {
        const val MERCHANT_MARKER_KEY = "merchant"
    }
}
