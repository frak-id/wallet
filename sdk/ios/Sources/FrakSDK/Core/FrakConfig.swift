/// Currency a reward is advertised in. The raw value is the wire value sent to the backend.
public enum FrakCurrency: String, Sendable, CaseIterable, Decodable, Hashable {
    case eur
    case usd
    case gbp
}

public enum FrakLanguage: String, Sendable, CaseIterable, Decodable, Hashable {
    case en
    case fr
}

/// How verbose the SDK is. Default is `.none` — silent unless raised for debugging.
///
/// Also gates `FrakConfig.logSink`: the level is applied first, so `.none` delivers
/// nothing to a configured sink either, and lowering this reduces the sink's volume
/// exactly as it reduces `os.Logger`'s.
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

/// Static merchant-supplied facts about the app, fixed at build time.
public struct FrakMetadata: Sendable, Hashable {
    /// Display name of the merchant, used where the SDK renders copy locally.
    public let name: String?
    /// Currency every reward amount is advertised in.
    public let currency: FrakCurrency
    /// Language for merchant copy. Nil means "let the backend decide".
    public let lang: FrakLanguage?
    /// Merchant logo URL, used as the native sheet header in a later increment.
    public let logoURL: String?
    /// Merchant homepage, used in locally-rendered copy.
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
    /// Server-issued merchant UUID. Optional — when nil, resolved from `bundleId` instead.
    public let merchantId: String?
    /// Bundle id of the host app, as registered in the merchant's `allowed_package_ids`.
    /// Nil reads it from `Bundle.main.bundleIdentifier` at `Frak.initialize(_:)`.
    public let bundleId: String?
    public let metadata: FrakMetadata
    /// The stage the SDK talks to. Merchants never set this; it exists for
    /// Frak's own dev and local builds.
    public let env: FrakEnvironment
    /// Master switch. When false, the SDK generates no anonymous id and issues no network request.
    public let trackingEnabled: Bool
    /// How verbose the SDK is. Also gates `logSink` — see `FrakLogLevel`.
    public let logLevel: FrakLogLevel
    /// Receives SDK diagnostics that pass `logLevel`, instead of `os.Logger`. Nil (the
    /// default) keeps diagnostics in `os.Logger`, as before this existed.
    public let logSink: (any FrakLogSink)?

    public init(
        merchantId: String? = nil,
        bundleId: String? = nil,
        metadata: FrakMetadata = FrakMetadata(),
        env: FrakEnvironment = .production,
        trackingEnabled: Bool = true,
        logLevel: FrakLogLevel = .none,
        logSink: (any FrakLogSink)? = nil
    ) {
        self.merchantId = merchantId
        self.bundleId = bundleId
        self.metadata = metadata
        self.env = env
        self.trackingEnabled = trackingEnabled
        self.logLevel = logLevel
        self.logSink = logSink
    }

    /// Returns a copy with `bundleId` replaced.
    func withBundleId(_ bundleId: String) -> FrakConfig {
        FrakConfig(
            merchantId: merchantId,
            bundleId: bundleId,
            metadata: metadata,
            env: env,
            trackingEnabled: trackingEnabled,
            logLevel: logLevel,
            logSink: logSink
        )
    }

    // `logSink` is an existential over a protocol that only requires `Sendable`, so it
    // cannot itself be Hashable — synthesis would fail to compile. Equality and hashing
    // are defined over every other field instead; the sink is a routing seam, not a
    // value to compare configs by.
    public static func == (lhs: FrakConfig, rhs: FrakConfig) -> Bool {
        lhs.merchantId == rhs.merchantId && lhs.bundleId == rhs.bundleId && lhs.metadata == rhs.metadata
            && lhs.env == rhs.env && lhs.trackingEnabled == rhs.trackingEnabled && lhs.logLevel == rhs.logLevel
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(merchantId)
        hasher.combine(bundleId)
        hasher.combine(metadata)
        hasher.combine(env)
        hasher.combine(trackingEnabled)
        hasher.combine(logLevel)
    }
}
