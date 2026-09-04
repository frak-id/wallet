import Foundation

// Backend is never guessed from the wallet origin; both stated together.
public enum FrakEnvironment: Sendable, Hashable {
    case production
    case development
    // `wallet`/`backend` must be `https://`, or `http://` to a loopback/private-network host —
    // see `CustomOrigin.rejectionReason` for the exact allowlist. `file:`/`data:`/`javascript:`/
    // anything else is always rejected: `wallet` loads directly into a WebView for the sharing
    // sheet, where file: is a local-file-disclosure vector, not just a cleartext-transport one.
    //
    // Not validated eagerly, matching FrakConfig: a rejected origin does not throw here. It is
    // swapped for an unreachable placeholder and surfaces only as a generic FrakError.network
    // (DNS failure) on first use. Frak.initialize logs the rejection at .error with the
    // offending origin and the rule, since that is the one place a configured logger exists.
    //
    // Swift enum cases cannot carry default argument values, so the wallet:backend: convenience
    // below is the 2-argument entry point; this case always carries all three.
    case custom(wallet: String, backend: String, walletScheme: String)

    /// Local backend serves self-signed HTTPS; needs an ATS exception on device. `walletScheme`
    /// defaults to Frak's own dev wallet, which is almost never right for a merchant's stub
    /// server: use `custom(wallet:backend:walletScheme:)` to override it.
    public static func custom(wallet: String, backend: String) -> FrakEnvironment {
        .custom(wallet: wallet, backend: backend, walletScheme: "frakwallet-dev")
    }

    public var wallet: String {
        switch self {
        case .production: "https://wallet.frak.id"
        case .development: "https://wallet-dev.frak.id"
        case .custom(let wallet, _, _): CustomOrigin.sanitize(wallet)
        }
    }

    public var backend: String {
        switch self {
        case .production: "https://backend.frak.id"
        case .development: "https://backend.gcp-dev.frak.id"
        case .custom(_, let backend, _): CustomOrigin.sanitize(backend)
        }
    }

    // Probed to decide whether install can deep link vs. go to the App Store;
    // merchant must list this in LSApplicationQueriesSchemes.
    public var walletScheme: String {
        switch self {
        case .production: "frakwallet"
        case .development: "frakwallet-dev"
        case .custom(_, _, let walletScheme): walletScheme
        }
    }

    /// `nil` when neither origin of a `.custom` case was rejected; the rejection message
    /// (naming the offending origin and the rule) otherwise. `Frak.initialize` logs this at
    /// `.error`.
    var customOriginRejectionReason: String? {
        guard case .custom(let wallet, let backend, _) = self else { return nil }
        return [CustomOrigin.rejectionReason(wallet), CustomOrigin.rejectionReason(backend)]
            .compactMap { $0 }
            .joined(separator: " ")
            .nilIfEmpty
    }
}

extension String {
    fileprivate var nilIfEmpty: String? { isEmpty ? nil : self }
}

/// The `.custom` origin allowlist, plus the placeholder substitution for a rejected origin. See
/// `FrakEnvironment.custom`'s doc for the rationale.
enum CustomOrigin {
    private static let placeholder = "https://frak-sdk-invalid-custom-origin.invalid"

    /// `nil` when `origin` is accepted as-is (besides trailing-slash trimming).
    static func rejectionReason(_ origin: String) -> String? {
        // URLComponents (not manual string-splitting) so an IPv6 host in brackets, e.g.
        // "http://[::1]:3000", parses its port correctly instead of the ":" inside "[::1]"
        // being mistaken for the host:port separator.
        let components = URLComponents(string: origin)
        let scheme = (components?.scheme ?? "").lowercased()
        let host = components?.host ?? ""

        if scheme == "https" { return nil }
        if scheme == "http", isLoopbackOrPrivateHost(String(host)) { return nil }
        if scheme == "http" {
            return
                "\"\(origin)\" uses http:// to a non-local host \"\(host)\". Only https://, or "
                + "http:// to a loopback/private-network host (localhost, 127.0.0.0/8, ::1, "
                + "10.0.2.2, 10.0.3.2, *.local, or an RFC 1918 range), is allowed."
        }
        return
            "\"\(origin)\" uses an unsupported scheme \"\(scheme.isEmpty ? "(none)" : scheme)\". "
            + "Only https://, or http:// to a loopback/private-network host, is allowed."
    }

    /// Accepted as-is (trailing slash trimmed) if `origin` passes; a fixed placeholder otherwise.
    static func sanitize(_ origin: String) -> String {
        guard rejectionReason(origin) == nil else { return placeholder }
        return origin.hasSuffix("/") ? String(origin.dropLast()) : origin
    }

    private static func isLoopbackOrPrivateHost(_ host: String) -> Bool {
        guard !host.isEmpty else { return false }
        if host.caseInsensitiveCompare("localhost") == .orderedSame { return true }
        if host.lowercased().hasSuffix(".local") { return true }
        if host == "::1" || host == "[::1]" { return true }
        if host == "10.0.2.2" || host == "10.0.3.2" { return true }
        return isIPv4PrivateOrLoopback(host)
    }

    private static func isIPv4PrivateOrLoopback(_ host: String) -> Bool {
        let parts = host.split(separator: ".")
        guard parts.count == 4 else { return false }
        let octets = parts.compactMap { Int($0) }
        guard octets.count == 4, octets.allSatisfy({ (0...255).contains($0) }) else { return false }
        let (a, b) = (octets[0], octets[1])
        if a == 127 { return true }  // 127.0.0.0/8
        if a == 10 { return true }  // 10.0.0.0/8
        if a == 172, (16...31).contains(b) { return true }  // 172.16.0.0/12
        if a == 192, b == 168 { return true }  // 192.168.0.0/16
        return false
    }
}
