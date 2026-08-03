import Foundation

actor DefaultFrakClient: FrakClient {
    private let config: FrakConfig
    private let identity: AnonymousIdStore
    private let launcher: any AppLauncher
    private let logger: FrakLogger
    private let configStore: ConfigStore
    private let rewards: RewardRepository
    private let tracker: InteractionTracker

    private var latestConfig: FrakResolvedConfig?
    private var subscribers: [UUID: AsyncStream<FrakResolvedConfig>.Continuation] = [:]

    init(
        config: FrakConfig,
        store: KeyValueStore,
        identity: AnonymousIdStore,
        queue: EventQueue,
        launcher: any AppLauncher,
        logger: FrakLogger,
        session: URLSession = HTTPClient.defaultSession,
        backendURL: String? = nil
    ) {
        self.config = config
        self.identity = identity
        self.launcher = launcher
        self.logger = logger
        let http = HTTPClient(baseURL: backendURL ?? config.env.backend, session: session)
        self.configStore = ConfigStore(http: http, store: store, logger: logger)
        self.rewards = RewardRepository(http: http, logger: logger)
        self.tracker = InteractionTracker(
            queue: queue,
            http: http,
            logger: logger,
            currentClientId: { identity.anonymousId() }
        )

        // Reading the keystore is storage I/O and `anonymousId` is a property a merchant
        // will read from the main thread; resolving it now makes that read a field access.
        // Then drain whatever a previous session queued and could not send — nothing else
        // triggers a drain, since the SDK holds no connectivity callback.
        let tracker = self.tracker
        let trackingEnabled = config.trackingEnabled
        Task {
            guard trackingEnabled else {
                // Events captured before the merchant turned tracking off must not be sent now.
                await tracker.purge()
                return
            }
            _ = identity.anonymousId()
            await tracker.flush()
        }
    }

    nonisolated var environment: FrakEnvironment {
        config.env
    }

    nonisolated var anonymousId: String? {
        identity.anonymousId()
    }

    nonisolated func resetAnonymousId() {
        identity.reset()
        // Purged, not left behind: an event captured under a dead id would re-link the
        // identity the user just asked to be forgotten. Best-effort cleanup — the guarantee
        // comes from the drain loop, which drops any event whose captured id is stale.
        let tracker = self.tracker
        Task { await tracker.purge() }
    }

    var currentConfig: FrakResolvedConfig? {
        latestConfig
    }

    var configUpdates: AsyncStream<FrakResolvedConfig> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let id = UUID()
            if let latestConfig {
                continuation.yield(latestConfig)
            }
            subscribers[id] = continuation
            continuation.onTermination = { [weak self] _ in
                Task { await self?.removeSubscriber(id) }
            }
        }
    }

    func resolveConfig(forceRefresh: Bool) async throws -> FrakResolvedConfig {
        try await frakCall {
            try requireTrackingEnabled()
            let query = try MerchantQuery.from(config)
            let resolved = try await configStore.resolve(query, forceRefresh: forceRefresh)
            // Dedupe, mirroring the Kotlin twin's StateFlow: a cache-hit resolve that
            // returns the same config every subscriber already has must not re-emit.
            let changed = resolved != latestConfig
            latestConfig = resolved
            if changed {
                for continuation in subscribers.values {
                    continuation.yield(resolved)
                }
            }
            return resolved
        }
    }

    func campaigns(forceRefresh: Bool) async throws -> [Campaign] {
        try await frakCall {
            try await fetchRewards(
                targetInteraction: nil,
                audience: nil,
                products: nil,
                forceRefresh: forceRefresh
            ).campaigns
        }
    }

    func bestReward(
        targetInteraction: String?,
        audience: RewardAudience?,
        products: [ProductDetails]?,
        forceRefresh: Bool
    ) async throws -> BestReward? {
        try await frakCall {
            try await fetchRewards(
                targetInteraction: targetInteraction,
                audience: audience,
                products: products,
                forceRefresh: forceRefresh
            ).best
        }
    }

    func buildSharingLink(_ request: SharingRequest) async -> String? {
        guard let clientId = identity.anonymousId() else { return nil }
        let resolved = await availableConfig()
        guard !Task.isCancelled else { return nil }

        guard let merchantId = config.merchantId ?? resolved?.merchantId else { return nil }
        let product = request.products.first
        // A cold cache that cannot be filled yields nil rather than an unattributed link.
        guard
            let baseURL = request.link ?? product?.link ?? resolved?.sdkConfig?.homepageLink
                ?? config.metadata.homepageLink
        else {
            return nil
        }

        return SharingLinkBuilder.build(
            baseURL: baseURL,
            context: FrakContext.V2(
                merchantId: merchantId,
                timestamp: Int64(Date().timeIntervalSince1970),
                clientId: clientId
            ),
            attribution: request.attribution,
            defaults: resolved?.sdkConfig?.attribution,
            productUtmContent: product?.utmContent
        )
    }

    @discardableResult
    func track(_ interaction: Interaction) async -> Result<Void, FrakError> {
        await trackingCall { merchantId in
            await tracker.track(
                merchantId: merchantId,
                clientId: identity.anonymousId(),
                interaction: interaction
            )
        }
    }

    @discardableResult
    func trackPurchase(customerId: String, orderId: String, token: String) async -> Result<Void, FrakError> {
        await trackingCall { merchantId in
            await tracker.trackPurchase(
                merchantId: merchantId,
                clientId: identity.anonymousId(),
                customerId: customerId,
                orderId: orderId,
                token: token
            )
        }
    }

    @discardableResult
    func handleReferralLink(_ url: String) async -> Bool {
        guard config.deepLink != .disabled, let context = SharingLinkBuilder.parse(url) else { return false }

        if ReferralArrival.isSelfReferral(context, anonymousId: identity.anonymousId()) {
            logger.info("Ignoring a referral link this device produced.")
            return true
        }

        await track(ReferralArrival.arrival(from: context))
        return true
    }

    func isFrakAppInstalled() async -> Bool {
        await launcher.canOpen("\(config.env.walletScheme)://")
    }

    func openFrakApp() async -> OpenAppResult {
        guard let install = await installIdentity() else { return .failed }

        // Attempted rather than gated on the probe: `canOpenURL` answers false when the
        // merchant forgot `LSApplicationQueriesSchemes` — which the SDK cannot inject, iOS
        // having no manifest merger — and `open(_:)` is not gated by that list. Trusting the
        // probe would turn one missed line of integration docs into a wallet that is
        // installed and never opens. `open` already answers false for an unhandled scheme,
        // so the store fallback below is reached either way.
        let deepLink = InstallLinks.deepLink(
            scheme: config.env.walletScheme,
            merchantId: install.merchantId,
            anonymousId: install.anonymousId
        )
        if await launcher.open(deepLink) {
            return .openedApp
        }

        return await launcher.open(InstallLinks.appStore()) ? .openedStore : .failed
    }

    func installURL() async -> String? {
        // Only the identity gate, unlike the Kotlin twin: a Play referrer carries the merchant
        // id, an App Store URL carries nothing, so resolving one would be a network round trip
        // for a constant.
        identity.anonymousId() == nil ? nil : InstallLinks.appStore()
    }

    func installPageURL(returnScheme: String, sessionId: String) async -> String? {
        guard let install = await installIdentity() else { return nil }
        // Minted here rather than when the sheet opens: most sessions never reach the install
        // step, an enclave signature can fail for reasons that have nothing to do with
        // sharing, and the backend's 30-day window runs from this timestamp.
        let proof = identity.signProof(.install, merchantId: install.merchantId)
        return InstallLinks.installPage(
            walletOrigin: config.env.wallet,
            merchantId: install.merchantId,
            anonymousId: install.anonymousId,
            returnScheme: returnScheme,
            sessionId: sessionId,
            proof: proof
        )
    }

    /// The merchant/anonymous-id pair an install link needs, or nil when either is missing.
    private func installIdentity() async -> (merchantId: String, anonymousId: String)? {
        guard let anonymousId = identity.anonymousId() else { return nil }
        let resolved = await availableConfig()
        guard !Task.isCancelled, let merchantId = config.merchantId ?? resolved?.merchantId else { return nil }
        return (merchantId, anonymousId)
    }

    /// The resolved config where one is available, nil where it is not.
    ///
    /// For the calls specified as nullable and never-throwing: a resolve failure means the
    /// same thing to their caller as no identity — there is nothing to hand back. Callers
    /// must still check `Task.isCancelled`, since this cannot tell them apart.
    private func availableConfig() async -> FrakResolvedConfig? {
        try? await resolveConfig()
    }

    /// Resolves the merchant an event belongs to, then runs `body`.
    ///
    /// Failure here is only ever a reason that will not resolve itself — tracking off, or no
    /// merchant to attribute to. Everything transient is the queue's problem, not the
    /// caller's, which is why nothing about connectivity can reach this return value.
    private func trackingCall(_ body: (String) async -> Void) async -> Result<Void, FrakError> {
        guard config.trackingEnabled else { return .failure(.trackingDisabled) }
        let merchantId: String
        if let configured = config.merchantId {
            merchantId = configured
        } else {
            do {
                merchantId = try await resolveConfig().merchantId
            } catch let error as FrakError {
                return .failure(error)
            } catch {
                // `resolveConfig` is `frakCall`-wrapped, so the only thing left is a
                // `CancellationError`. `.network` because that is literally what happened —
                // the request never reached the backend — and never `.decoding`, which means
                // the frozen binary and the deployed backend disagree and is worth an alert.
                return .failure(.network(underlying: error))
            }
        }
        await body(merchantId)
        return .success(())
    }

    /// Resolves the merchant, then reads its rewards. Sequencing resolve first means a
    /// bad merchant id surfaces as `merchantResolutionFailed` rather than a
    /// permanently empty reward list; it is nearly always a cache hit.
    private func fetchRewards(
        targetInteraction: String?,
        audience: RewardAudience?,
        products: [ProductDetails]?,
        forceRefresh: Bool
    ) async throws -> EstimatedRewardsResult {
        let resolved = try await resolveConfig(forceRefresh: false)
        return try await rewards.fetch(
            merchantId: resolved.merchantId,
            currency: config.metadata.currency,
            targetInteraction: targetInteraction,
            audience: audience,
            products: products,
            forceRefresh: forceRefresh
        )
    }

    private func removeSubscriber(_ id: UUID) {
        subscribers.removeValue(forKey: id)
    }

    // When tracking is off, no id is generated and no network is issued — including
    // for resolveConfig, which is itself a request on the user's behalf.
    private func requireTrackingEnabled() throws {
        guard config.trackingEnabled else { throw FrakError.trackingDisabled }
    }
}
