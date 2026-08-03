public enum FrakCurrency: String, Sendable, CaseIterable, Decodable, Hashable {
    case eur
    case usd
    case gbp
}

public enum FrakLanguage: String, Sendable, CaseIterable, Decodable, Hashable {
    case en
    case fr
}

// Default .none is silent. Also gates FrakConfig.logSink, same as os.Logger.
public enum FrakLogLevel: Int, Sendable, Hashable, Comparable {
    case none
    case error
    case warn
    case info
    case debug

    public static func < (lhs: FrakLogLevel, rhs: FrakLogLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

public enum DeepLinkHandling: Sendable, Hashable {
    // Merchant calls FrakClient.appLink.handleReferral(_:) from onOpenURL or their own router.
    //
    // The only mode iOS offers. Android additionally has an `.automatic` mode backed by
    // `ActivityLifecycleCallbacks`, which lets its SDK observe every Activity's incoming
    // Intent and self-route referral links without merchant code. iOS has no equivalent
    // hook: nothing lets a library install itself in front of the app's own URL routing,
    // so this SDK cannot intercept `onOpenURL`/`onContinueUserActivity` on the merchant's
    // behalf. `.manual` — the merchant forwarding URLs from their own `onOpenURL` — is
    // therefore mandatory on iOS, not just the default.
    case manual
    case disabled
}

/// Static merchant-supplied facts about the app, fixed at build time.
public struct FrakMetadata: Sendable, Hashable {
    public let name: String?
    public let currency: FrakCurrency
    // Nil means "let the backend decide".
    public let lang: FrakLanguage?
    public let logoURL: String?
    public let homepageLink: String?

    public init(
        name: String? = nil,
        currency: FrakCurrency = .eur,
        lang: FrakLanguage? = nil,
        logoURL: String? = nil,
        homepageLink: String? = nil
    ) {
        self.name = name
        self.currency = currency
        self.lang = lang
        self.logoURL = logoURL
        self.homepageLink = homepageLink
    }
}

/// Everything the SDK needs to start, supplied once to `Frak.initialize(_:)`.
public struct FrakConfig: Sendable, Hashable {
    // Optional: when nil, resolved from bundleId instead.
    public let merchantId: String?
    // Nil reads Bundle.main.bundleIdentifier at Frak.initialize(_:).
    public let bundleId: String?
    public let metadata: FrakMetadata
    // Merchants never set this; for Frak's own dev/local builds.
    public let env: FrakEnvironment
    public let deepLink: DeepLinkHandling
    // When false, generates no anonymous id and issues no network request.
    public let trackingEnabled: Bool
    public let logLevel: FrakLogLevel
    // Nil (default) keeps diagnostics in os.Logger.
    public let logSink: (any FrakLogSink)?
    // Warms an offscreen WKWebView ahead of the share tap. Off by default (extra JS heap).
    public let preloadSharing: Bool

    public init(
        merchantId: String? = nil,
        bundleId: String? = nil,
        metadata: FrakMetadata = FrakMetadata(),
        env: FrakEnvironment = .production,
        deepLink: DeepLinkHandling = .manual,
        trackingEnabled: Bool = true,
        logLevel: FrakLogLevel = .none,
        logSink: (any FrakLogSink)? = nil,
        preloadSharing: Bool = false
    ) {
        self.merchantId = merchantId
        self.bundleId = bundleId
        self.metadata = metadata
        self.env = env
        self.deepLink = deepLink
        self.trackingEnabled = trackingEnabled
        self.logLevel = logLevel
        self.logSink = logSink
        self.preloadSharing = preloadSharing
    }

    func withBundleId(_ bundleId: String) -> FrakConfig {
        FrakConfig(
            merchantId: merchantId,
            bundleId: bundleId,
            metadata: metadata,
            env: env,
            deepLink: deepLink,
            trackingEnabled: trackingEnabled,
            logLevel: logLevel,
            logSink: logSink,
            preloadSharing: preloadSharing
        )
    }

    // logSink can't be Hashable (existential over Sendable-only protocol), so it's
    // excluded from equality/hashing below.
    public static func == (lhs: FrakConfig, rhs: FrakConfig) -> Bool {
        lhs.merchantId == rhs.merchantId && lhs.bundleId == rhs.bundleId && lhs.metadata == rhs.metadata
            && lhs.env == rhs.env && lhs.deepLink == rhs.deepLink && lhs.trackingEnabled == rhs.trackingEnabled
            && lhs.logLevel == rhs.logLevel && lhs.preloadSharing == rhs.preloadSharing
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(merchantId)
        hasher.combine(bundleId)
        hasher.combine(metadata)
        hasher.combine(env)
        hasher.combine(deepLink)
        hasher.combine(trackingEnabled)
        hasher.combine(logLevel)
        hasher.combine(preloadSharing)
    }
}
