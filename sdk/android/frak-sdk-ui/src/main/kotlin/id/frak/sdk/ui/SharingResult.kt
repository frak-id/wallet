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

    /**
     * The user asked to install and the sheet took them to the wallet's install page (or, with
     * no identity to hand it, to the store). Informational only — the sheet owns the step from
     * here, so do not call [id.frak.sdk.FrakClient.openFrakApp] again in response. It does not
     * mean anything was installed: the user may still have dismissed the sheet.
     */
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
