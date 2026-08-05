package id.frak.sdk.core

/**
 * Every failure the SDK can hand back, as one closed hierarchy. `CancellationException` is never
 * wrapped into one of these, see `frakCall`.
 */
public sealed class FrakError(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause) {
    /**
     * Client method reached before [id.frak.sdk.Frak.initialize]. Always a programmer error.
     *
     * A plain `class`, not a Kotlin `object`: `Exception.fillInStackTrace()` runs once, at
     * construction, so a singleton's stack trace would report the first-ever call site, not the
     * real one.
     */
    public class NotInitialized :
        FrakError(
            "Frak is not initialized. Call Frak.initialize(context, config) before using the client.",
        )

    /** DNS failure, no connectivity, TLS failure, timeout. [cause] carries the underlying [java.io.IOException]. */
    public class Network(
        cause: Throwable,
    ) : FrakError("Frak network request failed: ${cause.message}", cause)

    /**
     * Non-2xx status. [code] is the `{ success: false, error, code }` envelope's code when
     * present, null for plain-text bodies. [retryAfterSeconds] only from a `Retry-After` header.
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

    /** 2xx response that couldn't be read as the expected shape; distinct from [Server]. */
    public class Decoding(
        message: String,
        cause: Throwable? = null,
    ) : FrakError("Frak could not decode a backend response: $message", cause)

    /**
     * A tracking call was made while tracking is not permitted, either by
     * `FrakConfig(trackingEnabled = false)` or a runtime
     * [id.frak.sdk.FrakClient.setTrackingEnabled]`(false)`. Not raised by config or reward
     * resolution, which are ungated.
     *
     * See [NotInitialized]'s doc for why this is not an `object`.
     */
    public class TrackingDisabled :
        FrakError(
            "Frak tracking is disabled; no network request was issued.",
        )

    /** [id.frak.sdk.ui.FrakSharing.present] called while a sheet is already up on the same Activity. See [NotInitialized]'s doc for why this is not an `object`. */
    public class AlreadyPresenting :
        FrakError(
            "A Frak sharing sheet is already presented.",
        )

    /** No merchant identified: bad `packageId`, or config has neither `merchantId` nor `packageId`. */
    public class MerchantResolutionFailed(
        message: String,
    ) : FrakError("Frak could not resolve a merchant: $message")
}
