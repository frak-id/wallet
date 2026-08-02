package id.frak.sdk.config

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.net.HttpClient
import id.frak.sdk.net.HttpClient.Companion.toServerError
import id.frak.sdk.net.JsonReader
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Stale-while-revalidate cache over `GET /user/merchant/resolve`. Fresh (< 5 min) served from
 * memory; stale served immediately and revalidated in background. No hard expiry: a cached copy
 * is always served however old, since reward amounts come from a separate, stricter endpoint.
 */
internal class ConfigStore(
    private val http: HttpClient,
    private val store: KeyValueStore,
    private val logger: FrakLogger,
    private val scope: CoroutineScope,
    private val ioDispatcher: CoroutineDispatcher,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val singleFlight = SingleFlight(scope)
    private val backoff = Backoff(now)

    /** Guards [memory], [revalidating] and [backoff], none of which are thread-safe. */
    private val mutex = Mutex()

    private class Entry(
        val key: String,
        val config: FrakResolvedConfig,
        val body: String,
        val fetchedAtMillis: Long,
    )

    private var memory: Entry? = null

    /** Negative-cached so a repeated miss never re-reads disk for the process lifetime. */
    private val hydrationAttempted = HashSet<String>()

    /** Keys with a background revalidation already in flight. Read/written under [mutex]. */
    private val revalidating = HashSet<String>()

    /** Backoff still applies under [forceRefresh]: a retry loop must not become a request flood. */
    suspend fun resolve(
        query: MerchantQuery,
        forceRefresh: Boolean,
    ): FrakResolvedConfig {
        val key = query.cacheKey()

        val cached = if (!forceRefresh) readCache(key) else null
        if (cached != null) {
            if (now() - cached.fetchedAtMillis < FRESH_TTL_MILLIS) return cached.config
            // Stale: refresh on the SDK's own scope so a caller going away doesn't cancel it.
            revalidateInBackground(key, query)
            return cached.config
        }

        // Backing off: any cached copy beats retrying, including under forceRefresh.
        if (mutex.withLock { backoff.isBackingOff(key) }) {
            (cached ?: readCache(key))?.let { return it.config }
        }

        return singleFlight.run(key) { fetch(key, query) }
    }

    /**
     * Hydrates from disk on first miss via [readPersisted] (dispatched onto [ioDispatcher]).
     * [memory] is re-checked once the lock is reacquired to publish, since another coroutine may
     * have published a fresher entry while this one was hydrating; only a strictly newer hydrated
     * entry replaces it, though this call still returns its own key's entry either way.
     * Concurrent misses collapse through [singleFlight] under a `"hydrate:"`-prefixed key so a
     * hydration never joins a fetch's flight. [hydrationAttempted] stops a permanently-absent key
     * from re-reading disk on every miss.
     */
    private suspend fun readCache(key: String): Entry? {
        mutex.withLock {
            memory?.takeIf { it.key == key }?.let { return it }
            if (key in hydrationAttempted) return null
        }

        val hydrated = singleFlight.run("hydrate:$key") { readPersisted(key) }
        mutex.withLock { hydrationAttempted.add(key) }
        if (hydrated == null) return null

        return mutex.withLock {
            if ((memory?.fetchedAtMillis ?: Long.MIN_VALUE) < hydrated.fetchedAtMillis) {
                memory = hydrated
            }
            memory?.takeIf { it.key == key } ?: hydrated
        }
    }

    private suspend fun fetch(
        key: String,
        query: MerchantQuery,
    ): FrakResolvedConfig {
        val response = backoff.runOrRecordFailure(mutex, key) { http.get(RESOLVE_PATH, query.parameters()) }

        if (!response.isSuccess) {
            backoff.recordFailureAndThrow(mutex, key, mapFailure(response))
        }

        // Persisted write happens INSIDE mutex, alongside publishing to memory, so two concurrent
        // fetches can't land their disk writes out of order. Safe only because scope's dispatcher
        // IS ioDispatcher (same object): withContext takes the same-interceptor fast path instead
        // of a real hop while holding the lock.
        val config = ResolvedConfigDecoder.decode(response.body)
        val entry = Entry(key, config, response.body, now())
        mutex.withLock {
            backoff.recordSuccess(key)
            memory = entry
            writePersisted(entry)
        }
        return config
    }

    /** Dispatch is on status, never Content-Type: this route's 404 is `text/plain`, not JSON. */
    private fun mapFailure(response: HttpClient.Response): FrakError {
        if (response.status == HTTP_NOT_FOUND) {
            return FrakError.MerchantResolutionFailed(
                "the backend has no merchant registered for this app. " +
                    "Check FrakConfig.merchantId, or that this package id is in the merchant's allowed package ids.",
            )
        }
        val code = JsonReader.errorCodeOrNull(response.body)
        if (code == INVALID_PACKAGE_ID_PAIRING) {
            // Should be unreachable: MerchantQuery pairs packageId and platform unconditionally.
            logger.error("Frak sent a packageId with no platform. This is an SDK bug — please report it.")
        }
        if (response.status == HTTP_UNPROCESSABLE) {
            logger.error("Frak sent a request the backend rejected as malformed: ${response.body.take(200)}")
        }
        return response.toServerError()
    }

    private suspend fun revalidateInBackground(
        key: String,
        query: MerchantQuery,
    ) {
        val shouldStart =
            mutex.withLock {
                if (key in revalidating || backoff.isBackingOff(key)) false else revalidating.add(key)
            }
        if (!shouldStart) return

        scope.launch {
            try {
                singleFlight.run(key) { fetch(key, query) }
            } catch (failure: FrakError) {
                // Swallowed by design: nobody is waiting on this, caller already has an answer.
                logger.debug("Frak background config revalidation failed: ${failure.message}")
            } finally {
                mutex.withLock { revalidating.remove(key) }
            }
        }
    }

    /** Raw response body persisted (not a re-serialised model) so decode is identical cold/live. */
    private suspend fun readPersisted(key: String): Entry? =
        withContext(ioDispatcher) {
            val raw = store.getString(STORAGE_KEY) ?: return@withContext null
            try {
                val envelope = JSONObject(raw)
                if (JsonReader.string(envelope, "key") != key) return@withContext null
                if (JsonReader.string(envelope, "sdkVersion") != FrakSdkVersion.CURRENT) return@withContext null
                val body = JsonReader.string(envelope, "body") ?: return@withContext null
                val fetchedAt = JsonReader.double(envelope, "fetchedAt")?.toLong() ?: return@withContext null
                Entry(key, ResolvedConfigDecoder.decode(body), body, fetchedAt)
            } catch (failure: Throwable) {
                // Corrupt cache is recoverable by fetching; never fatal.
                logger.debug("Frak discarded an unreadable persisted config: ${failure.message}")
                store.remove(STORAGE_KEY)
                null
            }
        }

    /** One slot for the most recent entry, not a per-key map: only the latest is worth persisting. */
    private suspend fun writePersisted(entry: Entry) {
        withContext(ioDispatcher) {
            val envelope =
                JSONObject()
                    .put("key", entry.key)
                    .put("sdkVersion", FrakSdkVersion.CURRENT)
                    .put("fetchedAt", entry.fetchedAtMillis)
                    .put("body", entry.body)
            store.putString(STORAGE_KEY, envelope.toString())
        }
    }

    companion object {
        const val RESOLVE_PATH: String = "/user/merchant/resolve"
        const val FRESH_TTL_MILLIS: Long = 5 * 60 * 1_000

        private const val STORAGE_KEY = "resolved-config"
        private const val INVALID_PACKAGE_ID_PAIRING = "INVALID_PACKAGE_ID_PAIRING"
        private const val HTTP_NOT_FOUND = 404
        private const val HTTP_UNPROCESSABLE = 422
    }
}
