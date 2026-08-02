package id.frak.sdk.ui

import id.frak.sdk.core.FrakError

/**
 * How a sharing session ended. A session can produce several; the callback
 * reports only the most significant: install > shared/copied > dismissed.
 */
public sealed interface SharingResult {
    public class Shared(
        public val link: String,
    ) : SharingResult

    public class Copied(
        public val link: String,
    ) : SharingResult

    /** Informational only — do not call [id.frak.sdk.FrakClient.openFrakApp] again in response. */
    public object InstallStarted : SharingResult

    public object Dismissed : SharingResult

    public class Failed(
        public val error: FrakError,
    ) : SharingResult
}

/** Higher wins. */
internal val SharingResult.significance: Int
    get() =
        when (this) {
            is SharingResult.Failed -> 0
            is SharingResult.Dismissed -> 1
            is SharingResult.Shared, is SharingResult.Copied -> 2
            is SharingResult.InstallStarted -> 3
        }
