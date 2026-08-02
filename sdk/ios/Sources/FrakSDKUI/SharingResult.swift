import FrakSDK

/// How a sharing sheet ended.
public enum SharingResult: Sendable {
    case shared(link: String)
    case copied(link: String)
    /// The SDK sent the user to the wallet or the App Store. **Informational only** — the
    /// install step already happened, so do not call `openFrakApp()` in response.
    case installStarted
    case dismissed
    case failed(FrakError)
}

extension SharingResult {
    /// One session can produce several outcomes — share, then install, then dismiss. The
    /// caller is told the most significant one; ranking them here keeps that rule in a
    /// single place.
    var significance: Int {
        switch self {
        case .failed: 0
        case .dismissed: 1
        case .shared, .copied: 2
        case .installStarted: 3
        }
    }
}
