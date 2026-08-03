import FrakSDK

/// How a sharing sheet ended.
public enum SharingResult: Sendable {
    case shared(link: String)
    case copied(link: String)
    /// The user asked to install and the sheet took them to the wallet's install page (or, with
    /// no identity to hand it, to the store). **Informational only** — the sheet owns the step
    /// from here, so do not call `openFrakApp()` in response. It does not mean anything was
    /// installed: the user may still have swiped the sheet away.
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
