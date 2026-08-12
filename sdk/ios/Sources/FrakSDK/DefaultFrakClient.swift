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
    /// Must be the same instance `identity` holds: two `TrackingConsent` actors over the same
    /// suite would memoise independently, so a withdrawal here wouldn't stop identity's own
    /// key minting.
    private let consent: TrackingConsent

    /// The startup drain, retained so `shutdown()` can cancel it.
    private var startupTask: Task<Void, Never>?
    /// Flushes the outbox the moment a merchant resolves, rather than waiting for the next
    /// `track()` or process launch. Retained so `shutdown()` can cancel it.
    private var configFlushTask: Task<Void, Never>?
    #if canImport(UIKit)
        /// Nothing else triggers a drain today, so a queued merge token whose first drain fails
        /// waits for the next PROCESS LAUNCH against a 60-minute server-side TTL. Retained so
        /// `shutdown()` can cancel it; never `UIApplication.shared`, which is extension-unsafe.
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
            trackingAllowed: { await consent.isEnabled() }
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

    /// Async because the first read used to mint a keypair on whatever thread called it.
    /// `identity`'s own eager generation, started in `init`, means a caller here usually awaits
    /// an already-completed result.
    var anonymousId: String? {
        get async { await identity.anonymousId() }
    }

    /// `false` means the platform key store refused to erase the key: the old identity is
    /// still live and did not rotate. This platform's `identity.reset()` cannot itself fail and
    /// always returns true; the value exists so a merchant writing shared cross-platform
    /// erasure logic has one contract to check.
    @discardableResult
    func resetAnonymousId() async -> Bool {
        let erased = await identity.reset()
        // Purged so an event captured under the dead id doesn't re-link the identity the user
        // just asked to be forgotten. Best-effort; the drain loop's stale-id check is the real
        // guarantee.
        let tracker = self.tracker
        Task { await tracker.purge() }
        return erased
    }

    /// The runtime half of `FrakConfig.trackingEnabled`. `false` stops the SDK talking to the
    /// backend for the rest of this install, not just this process — the decision is persisted.
    ///
    /// Deliberately does not touch the keypair: withdrawal and erasure are two calls, not one.
    /// `resetAnonymousId()` can fail on Android, and a combined setter whose return value meant
    /// "your consent change may not have applied" would be worse than either half separately.
    /// It also lets a merchant express a pause — a session-scoped opt-out, an ATT refusal, a
    /// minor-mode screen — without burning attribution a later opt-in would want back.
    ///
    /// The queue is purged, because those events were captured under a decision that has just
    /// been revoked. That deletes merchant-owned purchase events which may be mid-reconciliation;
    /// it is the correct privacy behaviour and it has a real revenue consequence, documented
    /// here and in the README.
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
    /// foreground flush subscriptions, and any queue drain in flight.
    ///
    /// Idempotent, and there is no restart contract: this client is dead afterwards. Get a live
    /// one from `Frak.initialize` after `Frak.shutdown()`. Not a privacy control —
    /// `setTrackingEnabled` is; this exists so a host process can tear the SDK down
    /// deterministically.
    ///
    /// Weaker than the Android twin, and named as such rather than papered over. Android
    /// cancels one `SupervisorJob` scope every background coroutine is structured under, and
    /// `cancelAndJoin` waits for all of them. This platform has no such scope, so the guarantee
    /// is assembled by hand and covers only what this client retains:
    ///
    /// - the startup drain — cancelled, and its body checks `Task.isCancelled` before
    ///   scheduling a flush, so cancelling it is not the no-op `Task<Void, Never>` would
    ///   otherwise make it;
    /// - the config-update and foreground flush subscriptions — cancelled, so neither keeps
    ///   iterating its `AsyncStream`/`NotificationCenter` sequence past shutdown;
    /// - the tracker — `EventOutbox.shutdown()` cancels the in-flight drain and refuses to start
    ///   another, which is what stops a later `track()` from reviving one;
    /// - not covered: `ConfigStore`'s background revalidation, `RewardRepository`, and
    ///   `resetAnonymousId`'s purge, all of which spawn unstructured `Task`s that nothing
    ///   retains, and the eager identity mint, a `Task.detached` inside `AnonymousIdStore`.
    ///   None of them sends a tracked event, but they can still touch the network and the
    ///   config suite after this returns.
    func shutdown() async {
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

        await track(ReferralArrival.arrival(from: context))
        return true
    }

    /// Durable now, unlike the old `pair()`-resolving path: a merge token is single-use and
    /// short-lived, so losing one to a cold cache or a transient failure was permanent.
    /// `merchantId` may land nil on the queued row — the drain resolves it, and `MergeSender`
    /// holds rather than failing.
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
        await launcher.canOpen("\(settings.env.walletScheme)://")
    }

    func openFrakApp() async -> OpenAppResult {
        guard let install = try? await merchantIdentity.pair(.optional) else { return .failed }

        // Attempted rather than gated on the probe: `canOpenURL` answers false when the
        // merchant forgot `LSApplicationQueriesSchemes` — which the SDK cannot inject, iOS
        // having no manifest merger — and `open(_:)` is not gated by that list. Trusting the
        // probe would turn one missed line of integration docs into a wallet that is installed
        // and never opens. `open` already answers false for an unhandled scheme, so the store
        // fallback below is reached either way.
        let deepLink = InstallLinks.deepLink(
            scheme: settings.env.walletScheme,
            merchantId: install.merchantId,
            anonymousId: install.anonymousId,
            // The App Store fallback below carries nothing — iOS has no Play-style install
            // referrer — so this link is the only place attribution can ride on an
            // already-installed device. Null when the enclave cannot sign, which `/install`
            // degrades past rather than blocks on.
            installProof: await identity.signProof(.install, merchantId: install.merchantId)
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

    /// Resolves the merchant, then reads its rewards. Sequencing resolve first means a bad
    /// merchant id surfaces as `merchantResolutionFailed` rather than a permanently empty
    /// reward list; it is nearly always a cache hit.
    ///
    /// `forceRefresh` forwards to the config resolve too: a caller asking to bypass the rewards
    /// cache almost certainly also wants a fresh merchant id/currency, not a stale one served
    /// alongside freshly-fetched rewards.
    ///
    /// Deliberately calls `resolveConfig` directly rather than through `MerchantIdentity`: this
    /// must always hit the resolve, even when `settings.merchantId` is set, so a typo'd merchant
    /// id surfaces as a resolution failure here instead of silently serving stale rewards.
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
