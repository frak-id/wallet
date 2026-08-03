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
     *
     * `wallet`/`backend` must be `https://`, or `http://` to a loopback/private-network host —
     * `localhost`, `127.0.0.0/8`, `::1`, `10.0.2.2`/`10.0.3.2` (Android emulator/Genymotion host
     * aliases), `*.local`, or an RFC 1918 range (`10/8`, `172.16/12`, `192.168/16`). That
     * carve-out matches this class's own documented workflow above ("On an emulator use
     * `10.0.2.2`") and the platform's own default: Android already blocks cleartext to anything
     * else via `cleartextTrafficPermitted=false` (API 28+), so rejecting loopback `http://` here
     * too would just override a merchant's deliberate, platform-sanctioned
     * `networkSecurityConfig` opt-in for no gain. `file:`/`data:`/`javascript:`/anything else is
     * always rejected: `wallet` loads directly into a `WebView` for the sharing sheet
     * (`WarmSharingWebView`), where `file:` is a local-file-disclosure vector, not just a
     * cleartext-transport one — and unlike cleartext, nothing in the platform blocks that.
     *
     * Not validated eagerly: matching [FrakConfig] ("never validated at construction"), a
     * rejected origin does not throw here. Unlike [FrakConfig] though, there is no typed error to
     * surface it as yet — `FrakError` has no configuration-specific arm (`06-open-findings.md`
     * A4), so a rejected origin is swapped for an unreachable placeholder and surfaces only as a
     * generic [FrakError.Network] (DNS failure) on first use, which names no rule and no
     * offending origin. [Frak.initialize] logs the rejection at `ERROR`, with the offending
     * origin and the rule, since it is the one place a configured logger (and the merchant's own
     * [FrakLogSink]) actually exists; a typed `FrakError.InvalidConfiguration`-shaped arm is the
     * real fix and belongs with the A4 error-taxonomy work, not here.
     *
     * [walletPackageId] and [walletScheme] default to Frak's own dev wallet, which is almost never
     * right for a merchant's stub server: override them, or a `Custom` install ends up probing for
     * (and deep-linking into) Frak's internal dev app.
     */
    public class Custom private constructor(
        wallet: String,
        backend: String,
        override val walletPackageId: String,
        override val walletScheme: String,
        /**
         * `null` when neither raw origin was rejected; the rejection message (naming the
         * offending origin and the rule) otherwise. [id.frak.sdk.Frak.initialize] logs this at
         * `ERROR` — see this class's doc for why the rejection itself is silent here.
         */
        internal val rejectionReason: String?,
    ) : FrakEnvironment {
        public constructor(
            wallet: String,
            backend: String,
            walletPackageId: String = DEV_WALLET_PACKAGE_ID,
            walletScheme: String = DEV_WALLET_SCHEME,
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

/**
 * The [FrakEnvironment.Custom] origin allowlist, plus the placeholder substitution for a
 * rejected origin. See the class doc above for the rationale; kept as its own object (rather
 * than private top-level functions) so [Frak.initialize] can call [rejectionReason] to log a
 * diagnosable message — [FrakEnvironment] itself has no logger in scope.
 */
internal object CustomOrigin {
    private const val PLACEHOLDER = "https://frak-sdk-invalid-custom-origin.invalid"

    /**
     * `null` when [origin] is accepted as-is (besides trailing-slash trimming). Parsed with
     * [java.net.URI] rather than manual string-splitting — same reason as iOS's `URLComponents`:
     * a bracketed IPv6 host, e.g. `"http://[::1]:3000"`, needs the port separator recognised as
     * the `:` *after* the matching `]`, not the first `:` in the string (which sits inside
     * `[::1]`). Anything [java.net.URI] itself cannot parse (a raw space in the host, for
     * instance) is rejected the same way an unparseable origin is rejected by iOS's
     * `URLComponents(string:)` returning `nil`.
     */
    internal fun rejectionReason(origin: String): String? {
        val uri = runCatching { java.net.URI(origin) }.getOrNull()
        val scheme = uri?.scheme?.lowercase() ?: ""
        // `getHost()` is null for a registry-based authority — notably any hostname containing an
        // underscore, which iOS's `URLComponents.host` returns happily. Falling back to the raw
        // authority keeps `http://my_host.local:3000` accepted on both platforms; it cannot widen
        // anything, since `isLoopbackOrPrivateHost` is a closed allowlist either way.
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

            // 127.0.0.0/8
            a == 10 -> true

            // 10.0.0.0/8
            a == 172 && b in 16..31 -> true

            // 172.16.0.0/12
            a == 192 && b == 168 -> true

            // 192.168.0.0/16
            else -> false
        }
    }
}
