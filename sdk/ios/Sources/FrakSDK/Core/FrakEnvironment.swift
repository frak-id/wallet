import Foundation

// Backend is never guessed from the wallet origin; both stated together.
public enum FrakEnvironment: Sendable, Hashable {
    case production
    case development
    // Local backend serves self-signed HTTPS; needs an ATS exception on device.
    case custom(wallet: String, backend: String)

    public var wallet: String {
        switch self {
        case .production: "https://wallet.frak.id"
        case .development: "https://wallet-dev.frak.id"
        case .custom(let wallet, _): Self.withoutTrailingSlash(wallet)
        }
    }

    public var backend: String {
        switch self {
        case .production: "https://backend.frak.id"
        case .development: "https://backend.gcp-dev.frak.id"
        case .custom(_, let backend): Self.withoutTrailingSlash(backend)
        }
    }

    // Probed to decide whether install can deep link vs. go to the App Store;
    // merchant must list this in LSApplicationQueriesSchemes.
    public var walletScheme: String {
        switch self {
        case .production: "frakwallet"
        case .development, .custom: "frakwallet-dev"
        }
    }

    // HTTPClient concatenates origin + path verbatim; avoids a double slash.
    private static func withoutTrailingSlash(_ origin: String) -> String {
        origin.hasSuffix("/") ? String(origin.dropLast()) : origin
    }
}
