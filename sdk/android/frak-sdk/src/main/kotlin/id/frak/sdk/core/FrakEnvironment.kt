package id.frak.sdk.core

/** The Frak stage the SDK talks to. */
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
     * Must be `https://`, or `http://` to a loopback/private-network host; anything else is swapped
     * for an unreachable placeholder and surfaces as a generic [FrakError.Network] on first use.
     */
    public class Custom private constructor(
        wallet: String,
        backend: String,
        override val walletPackageId: String,
        override val walletScheme: String,
        /** Null when neither raw origin was rejected; the rejection message otherwise. */
        internal val rejectionReason: String?,
    ) : FrakEnvironment {
        /** Frak's own dev wallet package id and scheme. */
        public constructor(
            wallet: String,
            backend: String,
        ) : this(wallet, backend, DEV_WALLET_PACKAGE_ID, DEV_WALLET_SCHEME)

        public constructor(
            wallet: String,
            backend: String,
            walletPackageId: String,
            walletScheme: String,
        ) : this(
            wallet = wallet,
            backend = backend,
            walletPackageId = walletPackageId,
            walletScheme = walletScheme,
            rejectionReason =
                listOfNotNull(CustomOrigin.rejectionReason(wallet), CustomOrigin.rejectionReason(backend))
                    .takeIf { it.isNotEmpty() }
                    ?.joinToString(" "),
        )

        override val wallet: String = CustomOrigin.sanitize(wallet)
        override val backend: String = CustomOrigin.sanitize(backend)
    }
}

private const val DEV_WALLET_PACKAGE_ID = "id.frak.wallet.dev"
private const val DEV_WALLET_SCHEME = "frakwallet-dev"

/** [FrakEnvironment.Custom] origin allowlist and placeholder substitution for a rejected origin. */
internal object CustomOrigin {
    private const val PLACEHOLDER = "https://frak-sdk-invalid-custom-origin.invalid"

    /** Parsed with [java.net.URI]: a bracketed IPv6 host needs the port separator found after the `]`. */
    internal fun rejectionReason(origin: String): String? {
        val uri = runCatching { java.net.URI(origin) }.getOrNull()
        val scheme = uri?.scheme?.lowercase() ?: ""
        // getHost() is null for a registry-based authority, e.g. a host containing an underscore;
        // the raw-authority fallback cannot widen anything, the allowlist below is closed.
        val host =
            uri?.host
                ?: uri?.authority?.substringAfterLast('@')?.substringBeforeLast(':')
                ?: ""
        return when {
            scheme == "https" -> {
                null
            }

            scheme == "http" && isLoopbackOrPrivateHost(host) -> {
                null
            }

            scheme == "http" -> {
                "\"$origin\" uses http:// to a non-local host \"$host\". Only https://, or " +
                    "http:// to a loopback/private-network host (localhost, 127.0.0.0/8, ::1, " +
                    "10.0.2.2, 10.0.3.2, *.local, or an RFC 1918 range), is allowed."
            }

            else -> {
                "\"$origin\" uses an unsupported scheme " +
                    "\"${scheme.ifEmpty { "(none)" }}\". Only https://, or http:// to a " +
                    "loopback/private-network host, is allowed."
            }
        }
    }

    /** Accepted as-is (trailing slash trimmed) if [origin] passes; a fixed placeholder otherwise. */
    internal fun sanitize(origin: String): String =
        if (rejectionReason(origin) == null) origin.trimEnd('/') else PLACEHOLDER

    private fun isLoopbackOrPrivateHost(host: String): Boolean {
        if (host.isEmpty()) return false
        if (host.equals("localhost", ignoreCase = true)) return true
        if (host.endsWith(".local", ignoreCase = true)) return true
        if (host == "::1" || host == "[::1]") return true
        if (host == "10.0.2.2" || host == "10.0.3.2") return true
        return isIpv4PrivateOrLoopback(host)
    }

    private fun isIpv4PrivateOrLoopback(host: String): Boolean {
        val parts = host.split('.')
        if (parts.size != 4) return false
        val octets = parts.map { it.toIntOrNull() ?: return false }
        if (octets.any { it !in 0..255 }) return false
        val (a, b, _, _) = octets
        return when {
            a == 127 -> true
            a == 10 -> true
            a == 172 && b in 16..31 -> true
            a == 192 && b == 168 -> true
            else -> false
        }
    }
}
