package id.frak.sdk.core

/**
 * The Frak stage the SDK talks to.
 *
 * Both origins are always stated together — the backend is never guessed from
 * the wallet origin. A `Custom` pair covers local development and any sandbox
 * the named stages don't know about.
 *
 * Mirrors the JS SDK's `FrakEnvironment` (`"prod" | "dev" | { wallet, backend }`).
 * The value travels with [FrakConfig], so unlike the JS SDK's `environment.ts`
 * there is no process-wide singleton here — native has no equivalent of the
 * two-bundles-on-one-page problem that forces one.
 *
 * Sealed rather than an enum so [Custom] can carry its two origins; the
 * subclasses are the only inhabitants, so a `when` over them is exhaustive.
 */
public sealed interface FrakEnvironment {
    /** Wallet origin: hosts the SSO and sharing pages. No trailing slash. */
    public val wallet: String

    /** Backend origin: hosts the REST API. No trailing slash. */
    public val backend: String

    /** Production. The default, and what every shipped app should use. */
    public data object Production : FrakEnvironment {
        override val wallet: String = "https://wallet.frak.id"
        override val backend: String = "https://backend.frak.id"
    }

    /** Frak's own dev stage. Not for merchant builds. */
    public data object Development : FrakEnvironment {
        override val wallet: String = "https://wallet-dev.frak.id"
        override val backend: String = "https://backend.gcp-dev.frak.id"
    }

    /**
     * An explicit origin pair, for local development — typically
     * `Custom(wallet = "https://localhost:3000", backend = "https://localhost:3030")`.
     *
     * A local backend serves self-signed HTTPS, so it needs a
     * `network_security_config.xml` trusting the host to work. On an emulator,
     * `localhost` is the emulator itself, not the host machine — use
     * `10.0.2.2` instead.
     *
     * Deliberately not a `data class`: that would bake `copy()`/`componentN()`
     * into the published ABI, so it could never gain a field without breaking
     * already-compiled consumers — the same constraint [FrakConfig] documents.
     *
     * Trailing slashes are stripped: origins are concatenated with paths
     * verbatim by `HttpClient`, so `https://host/` would yield `https://host//user/…`.
     */
    public class Custom(
        wallet: String,
        backend: String,
    ) : FrakEnvironment {
        override val wallet: String = wallet.trimEnd('/')
        override val backend: String = backend.trimEnd('/')
    }
}
