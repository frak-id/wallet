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

    init(settings: FrakConfig, identity: AnonymousIdStore, configStore: ConfigStore) {
        self.settings = settings
        self.identity = identity
        self.configStore = configStore
    }

    /// The merchant id under `policy`. `.required` either returns one or throws — the nil case
    /// exists only because the signature is shared with the other two policies, which use it.
    func merchant(_ policy: Policy) async throws -> String? {
        switch policy {
        case .required:
            if let merchantId = settings.merchantId { return merchantId }
            return try await resolve().merchantId
        case .optional:
            // Resolves even when settings.merchantId is set; the Android twin short-circuits
            // here. Collapsing the difference changes how often each platform hits the store.
            return merchantFrom(try await availableConfig())
        case .cachedOnly:
            if let merchantId = settings.merchantId { return merchantId }
            // `currentConfig` hydrates from disk on demand, so a warm start reached via a
            // referral deep link — before anything has resolved — can still find a merchant id.
            guard let query = try? MerchantQuery.from(settings) else { return nil }
            return await configStore.currentConfig(query)?.merchantId
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
    /// answers both.
    func merchantFrom(_ resolved: FrakResolvedConfig?) -> String? {
        settings.merchantId ?? resolved?.merchantId
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
}
