package id.frak.sdk.ui

import id.frak.sdk.core.FrakError

/**
 * How a sharing session ended. A session can produce several; the callback
 * reports only the most significant: install > shared/copied > dismissed.
 */
public sealed interface SharingResult {
    /**
     * Stable discriminator, one per arm. A `when` over [Kind] with an `else` survives a new arm;
     * a `when` over the hierarchy does not. [Kind.wireValue] is spelled identically on iOS.
     */
    public val kind: Kind

    public enum class Kind(
        public val wireValue: String,
    ) {
        SHARED("shared"),
        COPIED("copied"),
        INSTALL_STARTED("installStarted"),
        DISMISSED("dismissed"),
        FAILED("failed"),
    }

    public class Shared(
        public val link: String,
    ) : SharingResult {
        override val kind: Kind get() = Kind.SHARED
    }

    public class Copied(
        public val link: String,
    ) : SharingResult {
        override val kind: Kind get() = Kind.COPIED
    }

    /**
     * The user asked to install; the sheet took them to the wallet's install page, or to the
     * store with no identity to hand it. Informational only — do not call
     * [id.frak.sdk.AppLinkApi.openFrakApp] again in response, and it doesn't mean anything was
     * installed.
     */
    public object InstallStarted : SharingResult {
        override val kind: Kind get() = Kind.INSTALL_STARTED
    }

    public object Dismissed : SharingResult {
        override val kind: Kind get() = Kind.DISMISSED
    }

    public class Failed(
        public val error: FrakError,
    ) : SharingResult {
        override val kind: Kind get() = Kind.FAILED
    }
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
