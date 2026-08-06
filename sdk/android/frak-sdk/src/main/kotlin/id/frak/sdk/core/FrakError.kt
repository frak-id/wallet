package id.frak.sdk.core

/**
 * Every failure the SDK can hand back, as one closed hierarchy. `CancellationException` is never
 * wrapped into one of these, see `frakCall`. No default arguments anywhere: a sealed class's
 * constructor is published, so a default would freeze a synthetic bridge into the `.api` dump.
 */
public sealed class FrakError(
    message: String,
    cause: Throwable?,
) : Exception(message, cause) {
    /**
     * Client method reached before [id.frak.sdk.Frak.initialize]. A `class`, not an `object`:
     * `fillInStackTrace()` runs at construction, so a singleton would report the first call site.
     */
    public class NotInitialized :
        FrakError(
            "Frak is not initialized. Call Frak.initialize(context, config) before using the client.",
            null,
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
        public val code: String?,
        public val retryAfterSeconds: Long?,
    ) : FrakError(
            buildString {
                append("Frak backend returned HTTP ").append(status)
                if (code != null) append(" (").append(code).append(')')
                if (retryAfterSeconds != null) append(", retry after ").append(retryAfterSeconds).append("s")
            },
            null,
        ) {
        /** Status only, for a merchant faking a failure in their own test; the SDK always has all three. */
        public constructor(status: Int) : this(status, null, null)
    }

    /** 2xx response that couldn't be read as the expected shape; distinct from [Server]. */
    public class Decoding(
        message: String,
        cause: Throwable?,
    ) : FrakError("Frak could not decode a backend response: $message", cause) {
        public constructor(message: String) : this(message, null)
    }

    /**
     * A tracking call made while tracking is not permitted, by config or at runtime. Not raised by
     * config or reward resolution, which are ungated.
     */
    public class TrackingDisabled :
        FrakError(
            "Frak tracking is disabled; no network request was issued.",
            null,
        )

    /** [id.frak.sdk.ui.FrakSharing.present] called while a sheet is already up on the same Activity. */
    public class AlreadyPresenting :
        FrakError(
            "A Frak sharing sheet is already presented.",
            null,
        )

    /** No merchant identified: bad `packageId`, or config has neither `merchantId` nor `packageId`. */
    public class MerchantResolutionFailed(
        message: String,
    ) : FrakError("Frak could not resolve a merchant: $message", null)
}
