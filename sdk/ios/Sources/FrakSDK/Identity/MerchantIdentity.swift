import Foundation

/// Owns "which merchant, and which anonymous id" — the SDK's most-repeated precondition — under
/// one of three policies.
///
/// Not a consent gate: it resolves merchants and reads the already-consent-gated
/// `AnonymousIdStore`, but enforces nothing itself. `openFrakApp`'s safety today comes from
/// `AnonymousIdStore` already returning nil once consent is withdrawn.
actor MerchantIdentity {
    enum Policy: Sendable {
        /// Resolve on a cache miss; a resolve failure or `CancellationError` propagates.
        case required
        /// Same resolve, but a resolve failure is swallowed to nil; `CancellationError` still
        /// propagates.
        case optional
        /// Never touches the network — a referral arrival on a cold start must not block.
        case cachedOnly
    }

    private let settings: FrakConfig
    private let identity: AnonymousIdStore
    private let configStore: ConfigStore
    private let logger: FrakLogger
    private var warnedMismatch = false

    init(settings: FrakConfig, identity: AnonymousIdStore, configStore: ConfigStore, logger: FrakLogger) {
        self.settings = settings
        self.identity = identity
        self.configStore = configStore
        self.logger = logger
    }

    /// The merchant id under `policy`. The backend is authoritative: a cached or resolved
    /// merchant id always wins over `settings.merchantId`, which is only the fallback that keeps
    /// a cold cache from blocking on the network. `.required` either returns one or throws — the
    /// nil case exists only because the signature is shared with the other two policies, which
    /// use it.
    func merchant(_ policy: Policy) async throws -> String? {
        if let merchantId = await fastPathMerchantId() {
            return merchantId
        }
        switch policy {
        case .required:
            return try await resolve().merchantId
        case .optional:
            return try await availableConfig()?.merchantId
        case .cachedOnly:
            return nil
        }
    }

    /// The `(merchantId, anonymousId)` pair, or nil when either half is missing. The anonymous
    /// id is fetched first, so a device that cannot mint one never touches the network.
    func pair(_ policy: Policy) async throws -> (merchantId: String, anonymousId: String)? {
        guard let anonymousId = await identity.anonymousId() else { return nil }
        guard let merchantId = try await merchant(policy) else { return nil }
        return (merchantId, anonymousId)
    }

    /// `merchant(.optional)` for the caller that needs the config itself too, so one resolve
    /// answers both. Resolved-then-settings, matching `merchant(_:)`.
    func merchantFrom(_ resolved: FrakResolvedConfig?) -> String? {
        warnIfMismatched(resolved?.merchantId, settings.merchantId)
        return resolved?.merchantId ?? settings.merchantId
    }

    /// The resolved config where one is available, nil where it is not. Catching `FrakError`
    /// specifically, rather than `try?`, is what lets a `CancellationError` propagate instead of
    /// reading as "no merchant available".
    func availableConfig() async throws -> FrakResolvedConfig? {
        do {
            return try await resolve()
        } catch is FrakError {
            return nil
        }
    }

    private func resolve() async throws -> FrakResolvedConfig {
        try await frakCall {
            let query = try MerchantQuery.from(settings)
            return try await configStore.resolve(query, forceRefresh: false)
        }
    }

    /// A cached backend value wins over `settings.merchantId`; `settings.merchantId` is the
    /// fallback that keeps this from ever blocking on the network.
    private func fastPathMerchantId() async -> String? {
        let cached = await cachedMerchantId()
        warnIfMismatched(cached, settings.merchantId)
        return cached ?? settings.merchantId
    }

    /// Building the query throws when `settings` carries neither identifier — that is "nothing
    /// cached", not a failure.
    private func cachedMerchantId() async -> String? {
        guard let query = try? MerchantQuery.from(settings) else { return nil }
        return await configStore.currentConfig(query)?.merchantId
    }

    /// At most once per actor instance: a mismatch is a standing misconfiguration, not a
    /// per-call event, and every tracking call runs this path.
    private func warnIfMismatched(_ backendId: String?, _ configuredId: String?) {
        guard !warnedMismatch, let backendId, let configuredId, !Self.sameMerchant(backendId, configuredId) else {
            return
        }
        warnedMismatch = true
        logger.warn(
            "FrakConfig.merchantId \"\(configuredId)\" does not match the backend's \"\(backendId)\"; "
                + "the backend's merchant id is used."
        )
    }

    private static func sameMerchant(_ a: String, _ b: String) -> Bool {
        a.trimmingCharacters(in: .whitespaces).caseInsensitiveCompare(b.trimmingCharacters(in: .whitespaces))
            == .orderedSame
    }
}
