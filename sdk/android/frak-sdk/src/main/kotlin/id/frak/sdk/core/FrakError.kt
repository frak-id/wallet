package id.frak.sdk.core

/**
 * Every failure the SDK can hand back, as one closed hierarchy. Sealed so a
 * `when` over it stays exhaustive as arms are added.
 *
 * Extends [Exception] rather than being a Swift-style enum, since Kotlin has no
 * typed throws. Only the arms this SDK can currently produce are declared;
 * `CancellationException` is deliberately never wrapped into one of these — see
 * `frakCall` — so it is not an arm here.
 */
public sealed class FrakError(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause) {
    /**
     * A client method was reached before [id.frak.sdk.Frak.initialize]. Always a
     * programmer error, thrown rather than returned since there is no correct
     * way to guess a merchant id.
     */
    public object NotInitialized : FrakError(
        "Frak is not initialized. Call Frak.initialize(context, config) before using the client.",
    ) {
        private fun readResolve(): Any = NotInitialized
    }

    /**
     * The request never reached the backend, or the response never came back:
     * DNS failure, no connectivity, TLS failure, timeout. [cause] carries the
     * underlying [java.io.IOException].
     */
    public class Network(
        cause: Throwable,
    ) : FrakError("Frak network request failed: ${cause.message}", cause)

    /**
     * The backend answered with a non-2xx status.
     *
     * [code] is the machine-readable `code` field of a `{ success: false, error,
     * code }` envelope, when present; null for statuses whose body isn't that
     * envelope (e.g. the `text/plain` 404/429 these routes can return).
     * [retryAfterSeconds] is populated only from a `Retry-After` header
     * (in practice, only on 429).
     */
    public class Server(
        public val status: Int,
        public val code: String? = null,
        public val retryAfterSeconds: Long? = null,
    ) : FrakError(
            buildString {
                append("Frak backend returned HTTP ").append(status)
                if (code != null) append(" (").append(code).append(')')
                if (retryAfterSeconds != null) append(", retry after ").append(retryAfterSeconds).append("s")
            },
        )

    /**
     * A 2xx response arrived but could not be read as the shape we expect — a
     * wire-contract disagreement between a frozen binary and a
     * continuously-deployed backend, distinct from [Server]. The
     * `x-frak-sdk-version` header on the offending request identifies which
     * build disagrees.
     */
    public class Decoding(
        message: String,
        cause: Throwable? = null,
    ) : FrakError("Frak could not decode a backend response: $message", cause)

    /**
     * A call needing the network was made while
     * [FrakConfig.trackingEnabled] is false. Thrown rather than returned as an
     * empty value so a caller can tell "the user declined" apart from "this
     * merchant has no campaigns".
     */
    public object TrackingDisabled : FrakError(
        "Frak tracking is disabled by configuration; no network request was issued.",
    ) {
        private fun readResolve(): Any = TrackingDisabled
    }

    /**
     * No merchant could be identified for this app — a `packageId` not in
     * `allowed_package_ids`, or a config with neither `merchantId` nor
     * `packageId`. Separate from [Server]: the fix is a dashboard entry, not a
     * transient backend condition.
     */
    public class MerchantResolutionFailed(
        message: String,
    ) : FrakError("Frak could not resolve a merchant: $message")
}
