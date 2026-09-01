package id.frak.sdk.core

/**
 * Every failure the SDK can hand back, as one closed hierarchy. `CancellationException` is never
 * wrapped into one of these, see `frakCall`. No default arguments anywhere: a sealed class's
 * constructor is published, so a default would freeze a synthetic bridge into the `.api` dump.
 */
public sealed class FrakError(
    public val kind: Kind,
    message: String,
    cause: Throwable?,
) : Exception(message, cause) {
    /**
     * Stable discriminator, one per arm. A `when` over [Kind] with an `else` survives a new arm;
     * a `when` over the hierarchy does not. [wireValue] is spelled identically on iOS.
     */
    public enum class Kind(
        public val wireValue: String,
    ) {
        NOT_INITIALIZED("notInitialized"),
        NETWORK("network"),
        BACKING_OFF("backingOff"),
        SERVER("server"),
        DECODING("decoding"),
        TRACKING_DISABLED("trackingDisabled"),
        ALREADY_PRESENTING("alreadyPresenting"),
        MERCHANT_RESOLUTION_FAILED("merchantResolutionFailed"),
        INTERNAL_FAILURE("internalFailure"),
    }

    /**
     * Client method reached before [id.frak.sdk.Frak.initialize]. A `class`, not an `object`:
     * `fillInStackTrace()` runs at construction, so a singleton would report the first call site.
     */
    public class NotInitialized :
        FrakError(
            Kind.NOT_INITIALIZED,
            "Frak is not initialized. Call Frak.initialize(context, config) before using the client.",
            null,
        )

    /** DNS failure, no connectivity, TLS failure, timeout. [cause] carries the underlying [java.io.IOException]. */
    public class Network(
        cause: Throwable,
    ) : FrakError(Kind.NETWORK, "Frak network request failed: ${cause.message}", cause)

    /**
     * This resource is in a backoff window, so nothing was sent — unlike [Network], where a
     * request was attempted. Any cached copy is served in preference to raising this.
     */
    public class BackingOff(
        /** Seconds, like [Server.retryAfterSeconds] and iOS's twin. Fractional: the floor is 0.5s. */
        public val retryAfterSeconds: Double,
    ) : FrakError(
            Kind.BACKING_OFF,
            "Frak is backing off after repeated failures; retry in ${retryAfterSeconds}s.",
            null,
        )

    /**
     * Non-2xx status. [code] is the `{ success: false, error, code }` envelope's code when
     * present, null for plain-text bodies. [retryAfterSeconds] only from a `Retry-After` header.
     */
    public class Server(
        public val status: Int,
        public val code: String?,
        public val retryAfterSeconds: Long?,
    ) : FrakError(
            Kind.SERVER,
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
    ) : FrakError(Kind.DECODING, "Frak could not decode a backend response: $message", cause) {
        public constructor(message: String) : this(message, null)
    }

    /**
     * A tracking call made while tracking is not permitted, by config or at runtime. Not raised by
     * config or reward resolution, which are ungated.
     */
    public class TrackingDisabled :
        FrakError(
            Kind.TRACKING_DISABLED,
            "Frak tracking is disabled; no network request was issued.",
            null,
        )

    /** [id.frak.sdk.ui.FrakSharing.present] called while a sheet is already up on the same Activity. */
    public class AlreadyPresenting :
        FrakError(
            Kind.ALREADY_PRESENTING,
            "A Frak sharing sheet is already presented.",
            null,
        )

    /** No merchant identified: bad `packageId`, or config has neither `merchantId` nor `packageId`. */
    public class MerchantResolutionFailed(
        message: String,
    ) : FrakError(Kind.MERCHANT_RESOLUTION_FAILED, "Frak could not resolve a merchant: $message", null)

    /**
     * A failure inside the SDK: an unexpected error that escaped an internal boundary, or a
     * device capability it needs and cannot get. Not [Decoding], which describes a backend body.
     */
    public class InternalFailure(
        message: String,
        cause: Throwable?,
    ) : FrakError(Kind.INTERNAL_FAILURE, "Frak hit an internal error: $message", cause) {
        public constructor(message: String) : this(message, null)
    }
}

/** Backoff is computed in millis and published in seconds; converted at the two throw sites. */
internal const val MILLIS_PER_SECOND: Double = 1_000.0
