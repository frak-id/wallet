package id.frak.sdk.core

/** The Frak stage the SDK talks to. Wallet/backend origins always stated together, never guessed. */
public sealed interface FrakEnvironment {
    /** No trailing slash. */
    public val wallet: String

    /** No trailing slash. */
    public val backend: String

    /** Probed to decide whether install can deep link instead of going to the store. */
    public val walletPackageId: String get() = DEV_WALLET_PACKAGE_ID

    public val walletScheme: String get() = DEV_WALLET_SCHEME

    public data object Production : FrakEnvironment {
        override val wallet: String = "https://wallet.frak.id"
        override val backend: String = "https://backend.frak.id"
        override val walletPackageId: String = "id.frak.wallet"
        override val walletScheme: String = "frakwallet"
    }

    public data object Development : FrakEnvironment {
        override val wallet: String = "https://wallet-dev.frak.id"
        override val backend: String = "https://backend.gcp-dev.frak.id"
    }

    /**
     * Explicit origin pair for local development. On an emulator use `10.0.2.2`, not `localhost`.
     * Trailing slashes stripped, since `HttpClient` concatenates origin+path verbatim.
     */
    public class Custom(
        wallet: String,
        backend: String,
    ) : FrakEnvironment {
        override val wallet: String = wallet.trimEnd('/')
        override val backend: String = backend.trimEnd('/')
    }
}

private const val DEV_WALLET_PACKAGE_ID = "id.frak.wallet.dev"
private const val DEV_WALLET_SCHEME = "frakwallet-dev"
