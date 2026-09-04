import FrakSDK

/// How a sharing sheet ended.
public enum SharingResult: Sendable {
    case shared(link: String)
    case copied(link: String)
    /// The user asked to install and the sheet took them to the wallet's install page (or, with
    /// no identity to hand it, to the store). Informational only — do not call `openFrakApp()`
    /// in response; the sheet owns the step from here. Does not mean anything installed.
    case installStarted
    /// `openFrakApp()` answered `.openedApp` — an install this SDK observed and handed off, not a
    /// claim the backend has linked it. A merchant who needs "linked" reads that from the backend.
    case walletOpened
    case dismissed
    case failed(FrakError)

    /// Stable discriminator, one per case. A `switch` over ``Kind`` with a `default` survives a
    /// new case; an exhaustive `switch` over the result does not. Spelled identically on Android.
    public enum Kind: String, Sendable, Hashable, CaseIterable {
        case shared
        case copied
        case installStarted
        case walletOpened
        case dismissed
        case failed
    }

    public var kind: Kind {
        switch self {
        case .shared: return .shared
        case .copied: return .copied
        case .installStarted: return .installStarted
        case .walletOpened: return .walletOpened
        case .dismissed: return .dismissed
        case .failed: return .failed
        }
    }
}

extension SharingResult {
    /// One session can produce several outcomes; the caller is told the most significant one.
    var significance: Int {
        switch self {
        case .failed: 0
        case .dismissed: 1
        case .shared, .copied: 2
        case .installStarted: 3
        case .walletOpened: 4
        }
    }
}
