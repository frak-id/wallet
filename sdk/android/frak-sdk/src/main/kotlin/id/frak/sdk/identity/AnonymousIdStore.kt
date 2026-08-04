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
 * [anonymousId] is null, not a random unsigned id.
 *
 * Generation is a suspend/coroutine-native single-flight, so a keystore round-trip never blocks
 * a caller's thread. [startEagerGeneration] kicks off the mint as soon as this store exists; a
 * caller racing that warm-up awaits the same in-flight [Deferred] instead of re-entering [load].
 */
internal class AnonymousIdStore(
    private val keyStore: DeviceKeyStore,
    private val store: KeyValueStore,
    private val logger: FrakLogger,
    /** Whatever identifies this merchant in `FrakConfig` — its id when set, its package id otherwise. */
    private val merchantMarker: String,
    /**
     * The runtime consent handle. Read fresh at the single gate site ([current]) rather than
     * captured once, so a `setTrackingEnabled(false)` mid-session stops the next mint immediately.
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
     * Bound at [startEagerGeneration]; every [async] this store starts is a child of it. `@Volatile`:
     * written outside [mutex] and read inside a `mutex.withLock` block on a possibly different
     * thread, and a `Mutex` is not a memory barrier over state it did not itself protect the write of.
     */
    @Volatile
    private var eagerScope: CoroutineScope? = null

    /**
     * Starts the keystore mint now, off the caller's thread, so a later [anonymousId] read
     * usually awaits an already-completed [Deferred]. Fire-and-forget by design. [scope] is also
     * retained as the parent for any later [async] this store starts, including a fresh mint
     * after [reset].
     */
    fun startEagerGeneration(scope: CoroutineScope) {
        eagerScope = scope
        // No consent pre-check here: [current] makes the same call and is the single gate; a
        // second check here would drift from it.
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
     * Destroys the keypair; caller purges anything queued under the dead id, but only when this
     * returns true. A throwing `deleteEntry` leaves the entry alive, so the next [anonymousId]
     * call would re-derive the same id — a false return lets the caller keep events under the id
     * they were actually captured under.
     *
     * [generation] is cleared under the same lock a fresh mint reads it from, so an in-flight
     * generation cannot publish the old identity after this call: [current] sees `generation ==
     * null` and starts a new one. The in-flight [Deferred], if any, is also cancelled first, so a
     * racing [load] cannot write [MERCHANT_MARKER_KEY] back after the removal below.
     *
     * The keystore delete and the `SharedPreferences` removal both move to [ioDispatcher] after
     * `generation = null`: this is a suspend fun a merchant calls from `Dispatchers.Main`, and
     * nothing reached inside `withContext` calls back into this store, so [mutex] (not reentrant)
     * is never re-acquired.
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
     * `await()` happens outside the lock: awaiting a keystore round-trip while holding [mutex]
     * would serialise every reader behind the first one in.
     *
     * A refusal is never cached: a keystore can refuse for reasons that pass (a locked device, a
     * transient JCE hiccup), and caching it would turn one refusal into a permanent one. After a
     * [Deferred] resolves to null, [generation] clears only if it is still the exact same
     * instance (`===`) this call awaited, so a concurrent [reset] or newer [current] is not
     * clobbered.
     */
    private suspend fun current(): Identity? {
        // The one gate: checked before `generation` is read, so a denied consent short-circuits
        // ahead of any keystore work. Not a barrier though: a withdrawal landing after this
        // returns but before `load()` finishes still completes that mint. `reset()` cancels an
        // in-flight generation; `setTrackingEnabled(false)` does not, since it is a pause, not an
        // erasure.
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
                // The shared Deferred may have been cancelled by a concurrent reset(), not by
                // our own caller; ensureActive() re-raises only when this coroutine's own job is
                // the one that's gone. reset() already dropped `generation`, so there's nothing
                // to clear here.
                coroutineContext.ensureActive()
                null
            }
        if (identity == null) {
            mutex.withLock { if (generation === deferred) generation = null }
        }
        return identity
    }

    /**
     * [startEagerGeneration] always runs before any suspend function on this store is reachable.
     * A null [eagerScope] here means that invariant broke; logs and falls back to the
     * identity-unavailable outcome rather than crashing the merchant's app.
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
            // A reset() that ran while this was in flight already removed the marker and
            // cancelled this call; writing it back here would resurrect it for a key this
            // generation no longer owns.
            if (coroutineContext.isActive) {
                store.putString(MERCHANT_MARKER_KEY, merchantMarker)
            }
            Identity(key, ProofCodec.deriveClientIdFromHash(sha256(key.publicKeyUncompressed)))
        } catch (cancelled: CancellationException) {
            // Must rethrow, not fall into the catch below: reset() cancelling this Deferred
            // needs the coroutine to complete as cancelled, not with a swallowed null result.
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
