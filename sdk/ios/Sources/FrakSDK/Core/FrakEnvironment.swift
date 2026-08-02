import Foundation

/// The Frak stage the SDK talks to.
///
/// Both origins are always stated together — the backend is never guessed from
/// the wallet origin. A `.custom` pair covers local development and any sandbox
/// the named stages don't know about.
///
/// Mirrors the JS SDK's `FrakEnvironment` (`"prod" | "dev" | { wallet, backend }`).
/// The value travels with `FrakConfig`, so unlike the JS SDK's `environment.ts`
/// there is no process-wide singleton here — native has no equivalent of the
/// two-bundles-on-one-page problem that forces one.
public enum FrakEnvironment: Sendable, Hashable {
    /// Production. The default, and what every shipped app should use.
    case production
    /// Frak's own dev stage. Not for merchant builds.
    case development
    /// An explicit origin pair, for local development — typically
    /// `.custom(wallet: "https://localhost:3000", backend: "https://localhost:3030")`.
    /// A local backend serves self-signed HTTPS, so it needs an ATS exception
    /// to work on device.
    case custom(wallet: String, backend: String)

    /// Wallet origin: hosts the SSO and sharing pages. No trailing slash.
    public var wallet: String {
        switch self {
        case .production: "https://wallet.frak.id"
        case .development: "https://wallet-dev.frak.id"
        case .custom(let wallet, _): Self.withoutTrailingSlash(wallet)
        }
    }

    /// Backend origin: hosts the REST API. No trailing slash.
    public var backend: String {
        switch self {
        case .production: "https://backend.frak.id"
        case .development: "https://backend.gcp-dev.frak.id"
        case .custom(_, let backend): Self.withoutTrailingSlash(backend)
        }
    }

    /// Origins are concatenated with paths verbatim by `HTTPClient`, so a
    /// pasted `https://host/` would produce `https://host//user/…`.
    private static func withoutTrailingSlash(_ origin: String) -> String {
        origin.hasSuffix("/") ? String(origin.dropLast()) : origin
    }
}
