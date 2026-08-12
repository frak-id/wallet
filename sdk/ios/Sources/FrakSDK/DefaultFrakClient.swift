import Foundation

#if canImport(UIKit)
    import UIKit
#endif

actor DefaultFrakClient {
    private let settings: FrakConfig
    private let identity: AnonymousIdStore
    private let launcher: any AppLauncher
    private let logger: FrakLogger
    private let configStore: ConfigStore
    private let rewards: RewardRepository
    private let merge: IdentityMerge
    private let merchantIdentity: MerchantIdentity
    private let tracker: EventOutbox
    /// Must be the same instance `identity` holds: two `TrackingConsent` actors over one suite
    /// memoise independently, so a withdrawal here would not stop identity's key minting.
    private let consent: TrackingConsent

    /// The startup drain, retained so `shutdown()` can cancel it.
    private var startupTask: Task<Void, Never>?
    /// Flushes the outbox the moment a merchant resolves, rather than waiting for the next
    /// `track()` or process launch. Retained so `shutdown()` can cancel it.
    private var configFlushTask: Task<Void, Never>?
    /// Warns once per process, not once per probe: an unattended install detector polling every
    /// second would otherwise flood the merchant's console with the same diagnostic.
    private var loggedUndeclaredScheme = false
    #if canImport(UIKit)
        /// The only drain trigger besides launch, so a merge token whose first drain fails waits
        /// for the next launch against a 60-minute server TTL. Never `UIApplication.shared`.
        private var foregroundTask: Task<Void, Never>?
    #endif

    init(
        settings: FrakConfig,
        store: KeyValueStore,
        identity: AnonymousIdStore,
        consent: TrackingConsent,
        queue: EventQueue,
        launcher: any AppLauncher,
        logger: FrakLogger,
        session: URLSession = HTTPClient.defaultSession,
        backendURL: String? = nil
    ) {
        self.settings = settings
        self.identity = identity
        self.consent = consent
        self.launcher = launcher
        self.logger = logger
        let http = HTTPClient(baseURL: backendURL ?? settings.env.backend, session: session, logger: logger)
        self.configStore = ConfigStore(http: http, store: store, logger: logger)
        self.rewards = RewardRepository(http: http, logger: logger)
        self.merge = IdentityMerge(logger: logger)
        // Assigned to a local first: `self` isn't fully initialized yet, so the closures below
        // (built before `self.tracker` is assigned) capture this local, never `self`.
        let merchantIdentity = MerchantIdentity(
            settings: settings,
            identity: identity,
            configStore: configStore,
            logger: logger
        )
        self.merchantIdentity = merchantIdentity
        self.tracker = EventOutbox(
            queue: queue,
            http: http,
            logger: logger,
            senders: RowSenders.default(logger: logger),
            currentClientId: { await identity.anonymousId() },
            resolveMerchantId: { try? await merchantIdentity.merchant(.required) },
            signProof: { op, merchantId, binding in
                await identity.signProof(op, merchantId: merchantId, binding: binding)
            },
            // Read per event inside the drain, so a withdrawal that lands mid-drain stops the
            // upload rather than only emptying a file the drain has already read.
            trackingAllowed: { await consent.isEnabled() },
            identityReadable: { await identity.isReadable }
        )

        // Mints the keypair now, off whichever thread this init runs on, then drains whatever a
        // previous session queued and could not send.
        let tracker = self.tracker
        let configStore = self.configStore
        self.startupTask = Task {
            // Gated inside AnonymousIdStore on `consent`; a no-op when consent is absent or withdrawn.
            await identity.startEagerGeneration()

            // A group, not a sequence: a slow config resolve must not hold back events a previous
            // session already failed to send, and both must still die with this task on shutdown.
            await withTaskGroup(of: Void.self) { group in
                group.addTask {
                    // Ungated on consent, unlike the drain: this request carries no user identifier.
                    do {
                        _ = try await frakCall {
                            let query = try MerchantQuery.from(settings)
                            return try await configStore.resolve(query, forceRefresh: false)
                        }
                    } catch {
                        logger.debug("Eager startup config resolve failed.")
                    }
                }
                group.addTask {
                    guard await consent.isEnabled() else {
                        // Events captured before tracking was turned off must not be sent now.
                        await tracker.purge()
                        return
                    }
                    // A shutdown landing before this check would otherwise resume here and schedule
                    // a drain the tracker then immediately cancels. The load-bearing mechanism is
                    // the tracker's one-way `stopped` flag: `Task<Void, Never>` has no throwing
                    // suspension point, so cancelling this task alone would only read as a teardown.
                    guard !Task.isCancelled else { return }
                    await tracker.flush()
                }
            }
        }

        // `ConfigStore.updates` builds a fresh `AsyncStream` and continuation per access, so this
        // subscription multicasts alongside any merchant-owned one rather than stealing from it.
        self.configFlushTask = Task {
            for await _ in await configStore.updates {
                await tracker.flush()
            }
        }

        #if canImport(UIKit)
            self.foregroundTask = Task {
                let foregrounds = NotificationCenter.default.notifications(
                    named: UIApplication.willEnterForegroundNotification
                )
                for await _ in foregrounds {
                    await tracker.flush()
                }
            }
        #endif
    }

    nonisolated var environment: FrakEnvironment {
        settings.env
    }

    /// `FrakMetadata.name`, for the sharing sheet's tier-3 fallback — the one place a session has
    /// no resolved config to read a merchant name from. `nonisolated` for the same reason as
    /// `environment` above: `settings` is a `Sendable` `let`, fixed at construction.
    nonisolated var metadataName: String? {
        settings.metadata.name
    }

    /// `FrakMetadata.lang`, for the same tier-3 fallback: which of the bundled en/fr constants to
    /// use when there is no resolved config to pick a language from either.
    nonisolated var metadataLang: FrakLanguage? {
        settings.metadata.lang
    }

    /// Async because a first read can mint a keypair. `identity`'s eager generation, started in
    /// `init`, means a caller here usually awaits an already-completed result.
    var anonymousId: String? {
        get async { await identity.anonymousId() }
    }

    /// `false` means the key store refused to erase the key, so the identity did not rotate.
    @discardableResult
    func resetAnonymousId() async -> Bool {
        let erased = await identity.reset()
        // Purged so an event captured under the dead id doesn't re-link the identity the user just
        // asked to be forgotten. Awaited: a caller that resets and then reads has been told the
        // queue is clear, and detaching this made that a lie under any real drain.
        await tracker.purge()
        return erased
    }

    /// The runtime half of `FrakConfig.trackingEnabled`, persisted, so `false` holds for the
    /// install and not just the process. Does not touch the keypair: withdrawal and erasure are
    /// two calls, so a merchant can express a pause without burning attribution.
    ///
    /// Purges the queue — those events were captured under a decision just revoked. That drops
    /// merchant purchase events possibly mid-reconciliation; see the README.
    func setTrackingEnabled(_ enabled: Bool) async {
        await consent.setEnabled(enabled)
        if !enabled {
            await tracker.purge()
        }
    }

    /// The effective state: `FrakConfig.trackingEnabled` AND the persisted decision.
    func isTrackingEnabled() async -> Bool {
        await consent.isEnabled()
    }

    /// Cancels the background work this client owns: the startup drain, the config-update and
    /// foreground flush subscriptions, and any drain in flight. Idempotent and one-way — get a
    /// live client from `Frak.initialize`. Not a privacy control; `setTrackingEnabled` is.
    ///
    /// Covers only what this client retains: `ConfigStore` revalidation, `RewardRepository`, the
    /// purge and the eager mint can still touch the network after this returns.
    func shutdown() async {
        await configStore.finishSubscribers()
        startupTask?.cancel()
        startupTask = nil
        configFlushTask?.cancel()
        configFlushTask = nil
        #if canImport(UIKit)
            foregroundTask?.cancel()
            foregroundTask = nil
        #endif
        await tracker.shutdown()
    }

    /// `ConfigStore` owns the stream now; this forwards it unchanged. `nil` when `FrakConfig`
    /// carries neither a `merchantId` nor a `packageId` — a config that cannot identify a
    /// merchant cannot be hydrated from disk either, so that case degrades to `nil` like a
    /// genuine cache miss.
    var currentConfig: FrakResolvedConfig? {
        get async {
            guard let query = try? MerchantQuery.from(settings) else { return nil }
            return await configStore.currentConfig(query)
        }
    }

    var configUpdates: AsyncStream<FrakResolvedConfig> {
        get async { await configStore.updates }
    }

    /// Deliberately not gated on consent, unlike every tracking entry point. This request
    /// carries no user identifier at all — `x-frak-client-id` is set only by
    /// `InteractionTracker` — so refusing it with tracking off bought no privacy and cost the
    /// merchant their own config, their campaign list and their reward copy. `campaigns`/
    /// `bestReward` inherit that through `fetchRewards`, which resolves the merchant first.
    func resolveConfig(forceRefresh: Bool = false) async throws -> FrakResolvedConfig {
        try await frakCall {
            let query = try MerchantQuery.from(settings)
            return try await configStore.resolve(query, forceRefresh: forceRefresh)
        }
    }

    func campaigns(forceRefresh: Bool = false) async throws -> [Campaign] {
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
        targetInteraction: String? = nil,
        audience: RewardAudience? = nil,
        forceRefresh: Bool = false,
        products: [ProductDetails]? = nil
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

    /// Nil only when there is nothing to link to; every other way this can fail throws.
    func buildSharingLink(_ request: SharingRequest) async throws -> String? {
        guard await consent.isEnabled() else { throw FrakError.trackingDisabled }
        guard let clientId = await identity.anonymousId() else {
            throw FrakError.internalFailure(message: "the device refused the key material an anonymous id needs")
        }
        // One resolve: the same config answers the merchant fallback and the defaults below.
        let resolved = try await merchantIdentity.availableConfig()
        guard let merchantId = await merchantIdentity.merchantFrom(resolved) else {
            throw FrakError.merchantResolutionFailed(
                reason: "no merchantId is configured and none could be resolved for this bundle"
            )
        }

        let product = request.products.first
        // A cold cache that cannot be filled yields nil rather than an unattributed link.
        guard
            let baseURL = request.link ?? product?.link ?? resolved?.sdkConfig?.homepageLink
                ?? settings.metadata.homepageLink
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
                clientId: await identity.anonymousId(),
                interaction: interaction
            )
        }
    }

    @discardableResult
    func trackPurchase(customerId: String, orderId: String, token: String) async -> Result<Void, FrakError> {
        await trackingCall { merchantId in
            await tracker.trackPurchase(
                merchantId: merchantId,
                clientId: await identity.anonymousId(),
                customerId: customerId,
                orderId: orderId,
                token: token
            )
        }
    }

    /// Returns whether this carried an `fCtx`. A link carrying only `?fmt=` is still merged but
    /// answers false.
    @discardableResult
    func handleReferralLink(_ url: String) async -> Bool {
        guard settings.deepLink != .disabled else { return false }
        let mergeToken = IdentityMerge.parseToken(url)
        let context = SharingLinkBuilder.parse(url)
        guard mergeToken != nil || context != nil else { return false }

        // Ahead of the arrival guard, which returns early on a self-referral link that still merges.
        if let mergeToken {
            await mergeInboundIdentity(mergeToken)
        }

        guard let context else { return false }

        // Never touches the network: a referral arrival on a cold start must not block on a
        // resolve.
        let ownMerchantId = try? await merchantIdentity.merchant(.cachedOnly)
        let ignore = ReferralArrival.shouldIgnoreArrival(
            context,
            anonymousId: await identity.anonymousId(),
            ownMerchantId: ownMerchantId
        )
        if ignore {
            logger.info("Ignoring a self- or foreign-merchant referral link.")
            return true
        }

        // One link, one arrival: `.onOpenURL` fans out to every view that registers it.
        guard let raw = URLQuery.parse(url)?.value(for: SharingLinkBuilder.contextKey),
            await merge.claimArrival(raw)
        else {
            return true
        }

        await track(ReferralArrival.arrival(from: context))
        return true
    }

    /// Queues the merge instead of posting it: a merge token is single-use and short-lived, so
    /// losing one to a cold cache or a transient failure is permanent. `merchantId` may land nil
    /// on the queued row — the drain resolves it, and `MergeSender` holds rather than failing.
    private func mergeInboundIdentity(_ mergeToken: String) async {
        // Order matters: claiming before the consent gate would burn a single-use token that a
        // later in-session opt-in can never replay.
        guard await consent.isEnabled() else { return }
        guard let anonymousId = await identity.anonymousId() else { return }
        // Claimed only once the gates are passed. `trackMerge` owns the cold-start replay guard,
        // where the check and the append are one hop.
        guard await merge.claim(mergeToken) else { return }
        // `.cachedOnly`: never touches the network, unlike the deleted `pair()` call.
        let merchantId = try? await merchantIdentity.merchant(.cachedOnly)
        await tracker.trackMerge(
            mergeToken: mergeToken,
            anonymousId: anonymousId,
            merchantId: merchantId
        )
    }

    func isFrakAppInstalled() async -> Bool {
        guard walletSchemeStatus() == .ok else { return false }
        return await launcher.canOpen("\(settings.env.walletScheme)://")
    }

    /// Whether `canOpenURL` can answer for the wallet's scheme at all, from the merchant's own
    /// `LSApplicationQueriesSchemes` rather than a probe that cannot tell "undeclared" apart from
    /// "not installed". `FrakSDKUI`'s install detector gates its poll on this, so it never starts
    /// against a scheme that can only ever answer false, and warns once when it would.
    func walletSchemeStatus() -> ProbeStatus {
        #if canImport(UIKit)
            let declared = QueriedSchemes.declaredInMainBundle()
            if QueriedSchemes.isAtCap(declared) {
                logger.warn(
                    "LSApplicationQueriesSchemes has \(declared.count) entries, at or past the "
                        + "~50-scheme cap canOpenURL is documented to enforce. "
                        + "\(settings.env.walletScheme) may be ignored."
                )
            }
            let status = QueriedSchemes.status(for: settings.env.walletScheme, declared: declared)
            if status == .undeclared, !loggedUndeclaredScheme {
                loggedUndeclaredScheme = true
                logger.error(
                    "\(settings.env.walletScheme) is missing from LSApplicationQueriesSchemes. "
                        + "isFrakAppInstalled() and the install sheet's post-install detection "
                        + "will answer false/never fire; the universal-link and install-code "
                        + "handoffs are unaffected."
                )
            }
            return status
        #else
            return .ok
        #endif
    }

    func openFrakApp() async -> OpenAppResult {
        guard let install = try? await merchantIdentity.pair(.optional) else { return .failed }

        // Null when the enclave cannot sign, which `/install` degrades past rather than blocks on.
        let installProof = await identity.signProof(.install, merchantId: install.merchantId)

        // Opens silently and needs no LSApplicationQueriesSchemes; the scheme below recovers
        // when the user has turned universal links off for this domain.
        let universalLink = InstallLinks.universalLink(
            walletOrigin: settings.env.wallet,
            merchantId: install.merchantId,
            anonymousId: install.anonymousId,
            installProof: installProof
        )
        if await launcher.openUniversalLink(universalLink) {
            return .openedApp
        }

        let deepLink = InstallLinks.deepLink(
            scheme: settings.env.walletScheme,
            merchantId: install.merchantId,
            anonymousId: install.anonymousId,
            installProof: installProof
        )
        if await launcher.open(deepLink) {
            return .openedApp
        }

        return await launcher.open(InstallLinks.appStore()) ? .openedStore : .failed
    }

    func installPageURL(returnScheme: String, sessionId: String) async throws -> String {
        guard await consent.isEnabled() else { throw FrakError.trackingDisabled }
        // `try`, not `try?`: a cancellation during resolution now propagates instead of
        // reading as a resolution failure, matching Android.
        guard let install = try await merchantIdentity.pair(.optional) else {
            throw FrakError.merchantResolutionFailed(
                reason: "an install link needs both an anonymous id and a merchant; one of them is missing"
            )
        }
        // Minted here rather than when the sheet opens: most sessions never reach the install
        // step, an enclave signature can fail for reasons that have nothing to do with sharing,
        // and the backend's 30-day window runs from this timestamp.
        let proof = await identity.signProof(.install, merchantId: install.merchantId)
        return InstallLinks.installPage(
            walletOrigin: settings.env.wallet,
            merchantId: install.merchantId,
            anonymousId: install.anonymousId,
            returnScheme: returnScheme,
            sessionId: sessionId,
            proof: proof
        )
    }

    /// Runs `body` once consent allows it. `.cachedOnly` never touches the network — a cold
    /// start with no cache and no network must still land the row on disk rather than lose the
    /// event to a resolve that can't happen; `merchantId` may be nil, and the drain resolves it
    /// later. `try?` is safe: `.cachedOnly` never actually throws, it only shares a `throws`
    /// signature with the other two policies.
    private func trackingCall(_ body: (String?) async -> Void) async -> Result<Void, FrakError> {
        guard await consent.isEnabled() else { return .failure(.trackingDisabled) }
        let merchantId = try? await merchantIdentity.merchant(.cachedOnly)
        await body(merchantId)
        return .success(())
    }

    /// Resolves the merchant, then reads its rewards — nearly always a cache hit. `forceRefresh`
    /// forwards to the config resolve too, so a caller bypassing the rewards cache does not get
    /// fresh rewards beside a stale merchant id.
    ///
    /// Calls `resolveConfig` directly, not through `MerchantIdentity`: this must always hit the
    /// resolve, so a typo'd merchant id surfaces as a failure instead of stale rewards.
    private func fetchRewards(
        targetInteraction: String?,
        audience: RewardAudience?,
        products: [ProductDetails]?,
        forceRefresh: Bool
    ) async throws -> EstimatedRewardsResult {
        let resolved = try await resolveConfig(forceRefresh: forceRefresh)
        return try await rewards.fetch(
            merchantId: resolved.merchantId,
            currency: settings.metadata.currency,
            targetInteraction: targetInteraction,
            audience: audience,
            products: products,
            forceRefresh: forceRefresh
        )
    }
}
