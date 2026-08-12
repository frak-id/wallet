import Foundation
import Testing

@testable import FrakSDK

#if canImport(UIKit)
    import UIKit
#endif

@Suite("DefaultFrakClient")
struct FrakClientTests {
    private static let merchantId = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
    private static let resolveBody = """
        {"merchantId":"\(merchantId)","productId":"0x00","name":"Acme",
         "domain":"acme.example","allowedDomains":["acme.example"]}
        """
    private static let rewardsBody = #"{"rewards":[]}"#

    private func makeClient(
        config: FrakConfig = FrakConfig(merchantId: FrakClientTests.merchantId),
        launcher: FakeAppLauncher = FakeAppLauncher(),
        queueURL: URL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent(EventQueue.fileName),
        respond: @escaping @Sendable (URLRequest) throws -> StubResponse
    ) -> DefaultFrakClient {
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host, respond)
        let logger = FrakLogger(level: .none)
        let identityStore = InMemoryKeyValueStore()
        // ONE instance shared by the client and identity store, as Frak.initialize wires it.
        let consent = TrackingConsent(
            store: identityStore,
            configDefault: config.trackingEnabled,
            logger: logger
        )
        return DefaultFrakClient(
            settings: config,
            store: InMemoryKeyValueStore(),
            identity: AnonymousIdStore(
                keyStore: FakeDeviceKeyStore(),
                store: identityStore,
                logger: logger,
                merchantMarker: config.merchantId ?? "",
                consent: consent
            ),
            consent: consent,
            queue: EventQueue(fileURL: queueURL, logger: logger),
            launcher: launcher,
            logger: logger,
            session: session,
            backendURL: "https://\(host)"
        )
    }

    @Test("resolveConfig resolves the merchant and updates currentConfig")
    func resolveConfigUpdatesCurrentConfig() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }

        let resolved = try await client.resolveConfig(forceRefresh: false)
        #expect(resolved.merchantId == Self.merchantId)

        let current = await client.currentConfig
        #expect(current?.merchantId == Self.merchantId)
    }

    @Test("configUpdates replays the latest config to a new subscriber")
    func configUpdatesReplaysLatestConfig() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        _ = try await client.resolveConfig(forceRefresh: false)

        var iterator = await client.configUpdates.makeAsyncIterator()
        let first = await iterator.next()
        #expect(first?.merchantId == Self.merchantId)
    }

    @Test("configUpdates conflates: a stalled consumer sees only the newest value")
    func configUpdatesConflatesForAStalledConsumer() async throws {
        let responses = Counter()
        let client = makeClient { _ in
            let n = responses.increment()
            return StubResponse(
                status: 200,
                body: #"{"merchantId":"\#(Self.merchantId)","productId":"0x00","name":"Acme-\#(n)","#
                    + #""domain":"acme.example","allowedDomains":["acme.example"]}"#
            )
        }

        var iterator = await client.configUpdates.makeAsyncIterator()

        _ = try await client.resolveConfig(forceRefresh: true)
        _ = try await client.resolveConfig(forceRefresh: true)
        _ = try await client.resolveConfig(forceRefresh: true)

        let received = await iterator.next()
        #expect(received?.name == "Acme-3")
    }

    @Test("configUpdates does not repeat an unchanged config on a cache-hit resolve")
    func configUpdatesDedupesCacheHitResolve() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        _ = try await client.resolveConfig(forceRefresh: false)

        let received = ConfigLog()
        let subscriber = Task {
            for await config in await client.configUpdates {
                await received.append(config)
            }
        }
        try await Task.sleep(nanoseconds: 20_000_000)

        // Same body: a cache hit at the store, no actual change.
        _ = try await client.resolveConfig(forceRefresh: false)
        try await Task.sleep(nanoseconds: 50_000_000)

        subscriber.cancel()
        #expect(await received.values.count == 1)
    }

    @Test("configUpdates emits again when the config actually changes")
    func configUpdatesEmitsOnGenuineChange() async throws {
        let responses = Counter()
        let client = makeClient { _ in
            let n = responses.increment()
            let name = n == 1 ? "Acme" : "Acme Renamed"
            return StubResponse(
                status: 200,
                body: #"{"merchantId":"\#(Self.merchantId)","productId":"0x00","name":"\#(name)","#
                    + #""domain":"acme.example","allowedDomains":["acme.example"]}"#
            )
        }
        _ = try await client.resolveConfig(forceRefresh: false)

        let received = ConfigLog()
        let subscriber = Task {
            for await config in await client.configUpdates {
                await received.append(config)
            }
        }
        try await Task.sleep(nanoseconds: 20_000_000)

        _ = try await client.resolveConfig(forceRefresh: true)
        try await Task.sleep(nanoseconds: 50_000_000)

        subscriber.cancel()
        let names = await received.values.map(\.name)
        #expect(names == ["Acme", "Acme Renamed"])
    }

    @Test("configUpdates multicasts to more than one subscriber")
    func configUpdatesMulticastsToMultipleSubscribers() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        _ = try await client.resolveConfig(forceRefresh: false)

        var firstIterator = await client.configUpdates.makeAsyncIterator()
        var secondIterator = await client.configUpdates.makeAsyncIterator()

        #expect(await firstIterator.next()?.merchantId == Self.merchantId)
        #expect(await secondIterator.next()?.merchantId == Self.merchantId)
    }

    @Test("campaigns resolves the merchant first, so a bad merchant id fails clearly")
    func campaignsResolvesMerchantFirst() async throws {
        let client = makeClient { request in
            guard let path = request.url?.path, path.contains("resolve") else {
                Issue.record("rewards should not be requested before resolve succeeds")
                return StubResponse(status: 500, body: "")
            }
            return StubResponse(status: 404, body: "Merchant not found")
        }

        await #expect(throws: FrakError.self) {
            _ = try await client.campaigns(forceRefresh: false)
        }
    }

    @Test("bestReward reads currency from config, not a caller parameter")
    func bestRewardReadsCurrencyFromConfig() async throws {
        let log = RequestLog()
        let config = FrakConfig(merchantId: Self.merchantId, metadata: FrakMetadata(currency: .usd))
        let client = makeClient(config: config) { request in
            log.record(request)
            if request.url?.path.contains("resolve") == true {
                return StubResponse(status: 200, body: Self.resolveBody)
            }
            return StubResponse(status: 200, body: Self.rewardsBody)
        }

        _ = try await client.bestReward(targetInteraction: nil, audience: nil, forceRefresh: false, products: nil)

        #expect(log.urls.contains { $0.contains("currency=usd") })
    }

    @Test("campaigns forceRefresh also forces the config resolve, not just the rewards fetch (D6)")
    func campaignsForceRefreshAlsoForcesConfigResolve() async throws {
        let log = RequestLog()
        let client = makeClient { request in
            log.record(request)
            if request.url?.path.contains("resolve") == true {
                return StubResponse(status: 200, body: Self.resolveBody)
            }
            return StubResponse(status: 200, body: Self.rewardsBody)
        }

        _ = try await client.campaigns(forceRefresh: false)
        let resolveCallsAfterFirst = log.all.filter { $0.url?.path.contains("resolve") == true }.count

        _ = try await client.campaigns(forceRefresh: true)
        let resolveCallsAfterForced = log.all.filter { $0.url?.path.contains("resolve") == true }.count

        #expect(resolveCallsAfterFirst == 1, "the first call should resolve once")
        #expect(
            resolveCallsAfterForced == 2,
            "forceRefresh: true must bypass the config cache too, not just the rewards cache"
        )
    }

    @Test("resolveConfig still works with tracking off, and sends no client id")
    func resolveConfigIsNotGatedOnConsent() async throws {
        let log = RequestLog()
        let config = FrakConfig(merchantId: Self.merchantId, trackingEnabled: false)
        let client = makeClient(config: config) { request in
            log.record(request)
            return StubResponse(status: 200, body: Self.resolveBody)
        }

        let resolved = try await client.resolveConfig(forceRefresh: false)

        #expect(resolved.merchantId == Self.merchantId)
        #expect(log.all.count == 1)
        #expect(log.all.first?.value(forHTTPHeaderField: "x-frak-client-id") == nil)
    }

    @Test("the config resolves eagerly at init, with nobody asking")
    func configResolvesEagerlyAtInit() async throws {
        let log = RequestLog()
        let client = makeClient { request in
            log.record(request)
            return StubResponse(status: 200, body: Self.resolveBody)
        }

        // The warm cache is what lets a referral arrival on a cold start answer without blocking,
        // and what lets the backend's merchant id win over a configured one.
        #expect(await log.wait(forCount: 1))
        await client.shutdown()
    }

    @Test("setTrackingEnabled flips tracking at runtime, both ways")
    func setTrackingEnabledFlipsAtRuntime() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }

        #expect(await client.isTrackingEnabled())

        await client.setTrackingEnabled(false)
        #expect(await client.isTrackingEnabled() == false)
        guard case .failure(.trackingDisabled) = await client.track(.sharing()) else {
            Issue.record("expected a trackingDisabled failure once consent was withdrawn")
            return
        }

        await client.setTrackingEnabled(true)
        #expect(await client.isTrackingEnabled())
    }

    @Test("setTrackingEnabled(true) cannot lift a compile-time trackingEnabled: false")
    func compileTimeDisableIsAHardFloor() async throws {
        let config = FrakConfig(merchantId: Self.merchantId, trackingEnabled: false)
        let client = makeClient(config: config) { _ in StubResponse(status: 200, body: Self.resolveBody) }

        await client.setTrackingEnabled(true)

        #expect(await client.isTrackingEnabled() == false)
        #expect(await client.anonymousId == nil)
    }

    @Test("a runtime withdrawal reaches the identity store, not only the network gate")
    func withdrawalReachesTheIdentityStore() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        #expect(await client.anonymousId != nil)

        await client.setTrackingEnabled(false)

        #expect(await client.anonymousId == nil)
    }

    @Test("setTrackingEnabled(false) does not destroy the identity")
    func withdrawalIsAPauseNotAnErasure() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        let before = await client.anonymousId
        #expect(before != nil)

        await client.setTrackingEnabled(false)
        #expect(await client.anonymousId == nil)

        await client.setTrackingEnabled(true)
        #expect(await client.anonymousId == before)
    }

    /// The failing transport keeps the event on disk, so the queue file is the assertion.
    @Test("the documented withdrawal recipe stops tracking and drops what was queued")
    func withdrawalRecipeDropsTheQueue() async throws {
        let queueURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent(EventQueue.fileName)
        let client = makeClient(queueURL: queueURL) { _ in throw URLError(.notConnectedToInternet) }

        _ = await client.track(.custom("before-withdrawal"))
        try #require(FileManager.default.fileExists(atPath: queueURL.path), "precondition: event on disk")

        await client.setTrackingEnabled(false)

        let remaining = (try? Data(contentsOf: queueURL)) ?? Data()
        #expect(remaining.isEmpty, "withdrawal must leave nothing captured under the old decision")

        #expect(await client.resetAnonymousId())
    }

    @Test("shutdown is idempotent and stops the background work")
    func shutdownIsIdempotent() async throws {
        let log = RequestLog()
        let client = makeClient { request in
            log.record(request)
            return StubResponse(status: 200, body: Self.resolveBody)
        }

        await client.shutdown()
        await client.shutdown()

        // `track` still enqueues; the observable difference is whether a drain follows. Counted by
        // path so the eager startup config resolve, which may land either side of shutdown, cannot
        // be mistaken for one.
        func trackRequestCount() -> Int {
            log.all.filter { $0.url?.path.hasPrefix("/user/track/") == true }.count
        }
        let before = trackRequestCount()
        _ = await client.track(.custom("after-shutdown"))

        // Negative assertion, so give a drain every chance to happen before ruling it out.
        try? await Task.sleep(nanoseconds: 300_000_000)
        #expect(trackRequestCount() == before)
    }

    @Test("resolveConfig, campaigns and bestReward have usable defaults")
    func facadeMethodsHaveUsableDefaults() async throws {
        let client = makeClient { request in
            if request.url?.path.contains("resolve") == true {
                return StubResponse(status: 200, body: Self.resolveBody)
            }
            return StubResponse(status: 200, body: Self.rewardsBody)
        }

        _ = try await client.resolveConfig()
        _ = try await client.campaigns()
        _ = try await client.bestReward()
        _ = try await client.bestReward(targetInteraction: "purchase")
    }

    @Test("buildSharingLink attaches this installation's identity and the merchant's defaults")
    func buildSharingLinkAttachesTheIdentity() async throws {
        let client = makeClient { _ in
            StubResponse(
                status: 200,
                body: #"{"merchantId":"\#(Self.merchantId)","name":"Acme","domain":"acme.example","#
                    + #""sdkConfig":{"attribution":{"utmMedium":"referral"}}}"#
            )
        }

        let link = try #require(await client.buildSharingLink(SharingRequest(link: "https://acme.example/p")))
        #expect(link.hasPrefix("https://acme.example/p?fCtx="))
        #expect(link.contains("utm_source=frak"))
        #expect(link.contains("utm_medium=referral"))

        let context = try #require(Frak.parseReferralLink(link))
        guard case .v2(let v2) = context else {
            Issue.record("expected a v2 context")
            return
        }
        #expect(v2.merchantId == Self.merchantId)
        #expect(v2.clientId == (await client.anonymousId))
    }

    @Test("buildSharingLink yields nil with no base url to build from")
    func buildSharingLinkNeedsABaseURL() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        let link = try await client.buildSharingLink(SharingRequest())
        #expect(link == nil)
    }

    /// Mirrors Android's `a share link refused for want of identity throws, where nothing to link
    /// to is still null`. The two channels are deliberately distinct: nil means there was nothing
    /// to link to, a throw means a link could have been built and was refused.
    @Test("buildSharingLink throws, rather than yielding nil, when tracking is off")
    func buildSharingLinkThrowsWhenRefused() async {
        let client = makeClient(config: FrakConfig(merchantId: Self.merchantId, trackingEnabled: false)) { _ in
            StubResponse(status: 200, body: Self.resolveBody)
        }
        // `.kind`, not the case itself: FrakError is deliberately not Equatable.
        let refused = await #expect(throws: FrakError.self) {
            try await client.buildSharingLink(SharingRequest(link: "https://acme.example/p"))
        }
        #expect(refused?.kind == .trackingDisabled)
    }

    @Test("track refuses up front when tracking is disabled")
    func trackRefusesWhenTrackingIsDisabled() async {
        let client = makeClient(config: FrakConfig(merchantId: Self.merchantId, trackingEnabled: false)) { _ in
            StubResponse(status: 200, body: Self.resolveBody)
        }

        let result = await client.track(.sharing())
        guard case .failure(.trackingDisabled) = result else {
            Issue.record("expected a trackingDisabled failure, got \(result)")
            return
        }
    }

    @Test("handleReferralLink reports whether a link carried a context, and ignores our own")
    func handleReferralLinkAppliesTheSelfReferralGuard() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }

        let withoutContext = await client.handleReferralLink("https://acme.example/p")
        #expect(!withoutContext)

        let ownId = try #require(await client.anonymousId)
        let own = try #require(
            SharingLinkBuilder.build(
                baseURL: "https://acme.example/p",
                context: FrakContext.V2(merchantId: Self.merchantId, timestamp: 1, clientId: ownId),
                attribution: nil,
                defaults: nil
            )
        )
        // True: the link is ours, but nothing is tracked — a user cannot refer themselves.
        let handled = await client.handleReferralLink(own)
        #expect(handled)
    }

    @Test("handleReferralLink ignores a v2 arrival minted for a different merchant")
    func handleReferralLinkRejectsAForeignMerchant() async throws {
        let requests = RequestLog()
        let client = makeClient { request in
            requests.record(request)
            let isResolve = request.url?.path == "/user/merchant/resolve"
            return StubResponse(status: 200, body: isResolve ? Self.resolveBody : "{}")
        }
        // Populates the config store's cache before asserting on request counts.
        _ = try? await client.resolveConfig()
        let before = requests.count

        let foreignMerchantId = "550e8400-e29b-41d4-a716-446655440002"
        let foreignLink = try #require(
            SharingLinkBuilder.build(
                baseURL: "https://acme.example/p",
                context: FrakContext.V2(
                    merchantId: foreignMerchantId,
                    timestamp: 1,
                    clientId: "550e8400-e29b-41d4-a716-446655440001"
                ),
                attribution: nil,
                defaults: nil
            )
        )

        let handled = await client.handleReferralLink(foreignLink)
        #expect(handled)
        #expect(requests.count == before, "a foreign-merchant context must not be tracked as this merchant's arrival")
    }

    @Test("handleReferralLink tracks a v2 arrival when only the configured merchant id's case or whitespace differs")
    func handleReferralLinkToleratesMerchantIdCasing() async throws {
        // Casing/whitespace can only live on the config side: the codec requires a canonical UUID.
        let requests = RequestLog()
        let client = makeClient(config: FrakConfig(merchantId: " \(Self.merchantId.uppercased()) ")) { request in
            requests.record(request)
            return StubResponse(status: 200, body: "{}")
        }
        let before = requests.count

        let sameMerchantDifferentCase = try #require(
            SharingLinkBuilder.build(
                baseURL: "https://acme.example/p",
                context: FrakContext.V2(
                    merchantId: Self.merchantId,
                    timestamp: 1,
                    clientId: "550e8400-e29b-41d4-a716-446655440001"
                ),
                attribution: nil,
                defaults: nil
            )
        )

        let handled = await client.handleReferralLink(sameMerchantDifferentCase)
        #expect(handled)
        let tracked = await requests.wait(forCount: before + 1)
        #expect(
            tracked,
            "a case/whitespace difference in the merchant id must not be mistaken for a foreign merchant"
        )
    }

    @Test("handleReferralLink does nothing at all when deep linking is disabled")
    func handleReferralLinkHonoursDisabled() async throws {
        let client = makeClient(config: FrakConfig(merchantId: Self.merchantId, deepLink: .disabled)) { _ in
            StubResponse(status: 200, body: Self.resolveBody)
        }
        let link = try #require(
            SharingLinkBuilder.build(
                baseURL: "https://acme.example/p",
                context: FrakContext.V2(merchantId: Self.merchantId, timestamp: 1, clientId: Self.merchantId),
                attribution: nil,
                defaults: nil
            )
        )
        let handled = await client.handleReferralLink(link)
        #expect(!handled)
    }

    @Test("openFrakApp deep links when the wallet is there, and falls back to the store when it is not")
    func openFrakAppPrefersTheDeepLink() async throws {
        let installed = FakeAppLauncher(openableSchemes: ["frakwallet"])
        let client = makeClient(launcher: installed) { _ in StubResponse(status: 200, body: Self.resolveBody) }

        let opened = await client.openFrakApp()
        #expect(opened == .openedApp)
        #expect(installed.opened.first?.hasPrefix("frakwallet://install?m=\(Self.merchantId)") == true)

        let absent = FakeAppLauncher()
        let withoutWallet = makeClient(launcher: absent) { _ in StubResponse(status: 200, body: Self.resolveBody) }
        let fellBack = await withoutWallet.openFrakApp()
        #expect(fellBack == .openedStore)
        #expect(absent.opened == ["https://apps.apple.com/app/id6759159306"])
    }

    @Test("openFrakApp opens the wallet even when the merchant never declared the scheme")
    func openFrakAppIgnoresARefusingProbe() async {
        // canOpenURL answers false unless the merchant lists the scheme; `open` is not gated by it.
        let silentProbe = FakeAppLauncher(openableSchemes: ["frakwallet"], probeAnswers: false)
        let client = makeClient(launcher: silentProbe) { _ in
            StubResponse(status: 200, body: Self.resolveBody)
        }

        #expect(await client.isFrakAppInstalled() == false)

        let opened = await client.openFrakApp()
        #expect(opened == .openedApp)
        #expect(silentProbe.opened.first?.hasPrefix("frakwallet://install?m=") == true)
    }

    @Test("openFrakApp fails when nothing will handle either url")
    func openFrakAppFailsWhenNothingOpens() async {
        let refuses = FakeAppLauncher(opensSucceed: false)
        let client = makeClient(launcher: refuses) { _ in StubResponse(status: 200, body: Self.resolveBody) }
        let opened = await client.openFrakApp()
        #expect(opened == .failed)
    }

    @Test("installPageURL carries the identity and a proof, with the proof in the fragment")
    func installPageURLCarriesAProof() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }

        let page = try await client.installPageURL(returnScheme: "frak-com.acme.app", sessionId: "session-1")
        let anonymousId = try #require(await client.anonymousId)

        let expected =
            "https://wallet.frak.id/install?embed=native&m=\(Self.merchantId)&a=\(anonymousId)"
            + "&returnScheme=frak-com.acme.app&sid=session-1"
        #expect(page.hasPrefix(expected))

        // The fragment, never a search param: it is never sent to a server or logged.
        let fragment = try #require(page.split(separator: "#", maxSplits: 1).last)
        #expect(fragment.hasPrefix("p="))
        #expect(fragment.count > "p=".count)
        #expect(!page.contains("&p="))
    }

    @Test("installPageURL needs an identity, like every other install link")
    func installPageURLNeedsAnIdentity() async {
        let config = FrakConfig(merchantId: FrakClientTests.merchantId, trackingEnabled: false)
        let client = makeClient(config: config) { _ in StubResponse(status: 200, body: Self.resolveBody) }

        // Throws rather than answering nil: a caller refused an install page needs to know it was
        // refused, not receive the same answer as "there was nothing to link to".
        let refused = await #expect(throws: FrakError.self) {
            try await client.installPageURL(returnScheme: "frak-com.acme.app", sessionId: "s1")
        }
        #expect(refused?.kind == .trackingDisabled)
    }

    /// The one permitted behavioural difference from before this refactor: a cancellation
    /// during identity resolution now propagates, rather than collapsing to
    /// `merchantResolutionFailed` — matching Android's equivalent.
    @Test("installPageURL propagates cancellation instead of collapsing it to merchantResolutionFailed")
    func installPageURLPropagatesCancellation() async throws {
        // No merchantId, so the merchant genuinely resolves and there is a request to cancel.
        let client = makeClient(config: FrakConfig(bundleId: "com.acme.app")) { _ in throw StubHangs() }

        let task = Task {
            try await client.installPageURL(returnScheme: "frak-com.acme.app", sessionId: "session-1")
        }
        try await Task.sleep(nanoseconds: 50_000_000)
        task.cancel()

        await #expect(throws: CancellationError.self) {
            _ = try await task.value
        }
    }

    /// Regression for bug 1: `trackingCall` used to resolve `.required` before the durable
    /// enqueue, so a cold start with no cache and no network lost the event outright.
    @Test("track lands the event on disk with no cached merchant and no reachable network (bug 1)")
    func trackDoesNotBlockOnAMerchantResolve() async throws {
        let queueURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent(EventQueue.fileName)
        let client = makeClient(config: FrakConfig(bundleId: "com.acme.app"), queueURL: queueURL) { _ in
            throw URLError(.notConnectedToInternet)
        }

        let result = await client.track(.custom("cold-start"))

        guard case .success = result else {
            Issue.record("expected track to succeed with no merchant to resolve, got \(result)")
            return
        }
        let rows = await EventQueue(fileURL: queueURL, logger: FrakLogger(level: .none)).read(now: Date())
        #expect(rows.first?.merchantId == nil)
    }

    /// Regression for bug 2: `mergeInboundIdentity` used to call `pair(.optional)`, which
    /// resolves over the network and drops the token outright on failure.
    @Test("handleReferralLink durably queues an inbound merge with no cached merchant and no reachable network (bug 2)")
    func mergeIsDurableWithoutANetworkResolve() async throws {
        let queueURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent(EventQueue.fileName)
        let client = makeClient(config: FrakConfig(bundleId: "com.acme.app"), queueURL: queueURL) { _ in
            throw URLError(.notConnectedToInternet)
        }

        _ = await client.handleReferralLink("https://acme.example/p?fmt=merge-token-1")
        // Lets the detached drain, which cannot succeed offline, settle before asserting.
        try await Task.sleep(nanoseconds: 200_000_000)

        let rows = await EventQueue(fileURL: queueURL, logger: FrakLogger(level: .none)).read(now: Date())
        let merged = rows.first { $0.kind == "merge" }
        #expect(merged?.idempotencyKey == "merge-token-1")
        #expect(merged?.merchantId == nil)
    }

    // MARK: - drain triggers (fix 3)

    /// A row held for want of a merchant must not wait for the next `track()`/foreground/process
    /// launch: the moment `ConfigStore` publishes a resolved merchant, `configFlushTask` drains it.
    @Test("a config update triggers a drain with no explicit flush call, and stops after shutdown")
    func configUpdateTriggersADrain() async throws {
        let queueURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent(EventQueue.fileName)
        let networkUp = Flag(false)
        let resolveCalls = Counter()
        let requests = RequestLog()
        let client = makeClient(config: FrakConfig(bundleId: "com.acme.app"), queueURL: queueURL) { request in
            requests.record(request)
            guard networkUp.value else { throw URLError(.notConnectedToInternet) }
            guard request.url?.path == "/user/merchant/resolve" else { return StubResponse(status: 200, body: "{}") }
            let n = resolveCalls.increment()
            return StubResponse(
                status: 200,
                body: #"{"merchantId":"\#(Self.merchantId)","productId":"0x00","name":"Acme-\#(n)","#
                    + #""domain":"acme.example","allowedDomains":["acme.example"]}"#
            )
        }

        _ = await client.track(.custom("held-for-merchant"))
        // Lets the offline auto-drain hold the row before the network comes up.
        try await Task.sleep(nanoseconds: 200_000_000)

        networkUp.value = true
        // Retried rather than a single `try await`: the offline attempts above may have armed
        // ConfigStore's own backoff, independent of the tracker's; this waits it out instead of
        // racing it.
        var resolvedOnce = false
        var resolveWaited = 0
        while !resolvedOnce, resolveWaited < 40 {
            if (try? await client.resolveConfig(forceRefresh: true)) != nil { resolvedOnce = true }
            if !resolvedOnce {
                try await Task.sleep(nanoseconds: 50_000_000)
                resolveWaited += 1
            }
        }
        #expect(resolvedOnce, "resolveConfig should succeed once the network is back and backoff clears")

        func trackHits() -> Int { requests.all.filter { $0.url?.path == "/user/track/interaction" }.count }
        var waited = 0
        while trackHits() == 0, waited < 400 {
            try await Task.sleep(nanoseconds: 5_000_000)
            waited += 1
        }
        #expect(trackHits() == 1, "a config update must flush a held row without an explicit flush() call")

        await client.shutdown()
        let afterFirstFlush = trackHits()

        _ = await client.track(.custom("after-shutdown"))
        _ = try? await client.resolveConfig(forceRefresh: true)
        try? await Task.sleep(nanoseconds: 200_000_000)

        #expect(trackHits() == afterFirstFlush, "the config-update flush must not fire once the client is shut down")
    }

    #if canImport(UIKit)
        /// The single biggest delivery-rate lever on iOS: nothing else drains on app resume. Uses
        /// only `NotificationCenter`, never `UIApplication.shared`.
        @Test("posting willEnterForeground triggers a drain, and stops after shutdown")
        func foregroundNotificationTriggersADrain() async throws {
            let queueURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
                .appendingPathComponent(EventQueue.fileName)
            let requests = RequestLog()
            let client = makeClient(config: FrakConfig(bundleId: "com.acme.app"), queueURL: queueURL) { request in
                requests.record(request)
                throw URLError(.notConnectedToInternet)
            }

            func resolveAttempts() -> Int {
                requests.all.filter { $0.url?.path == "/user/merchant/resolve" }.count
            }

            _ = await client.track(.custom("held-forever"))
            var waited = 0
            while resolveAttempts() == 0, waited < 400 {
                try await Task.sleep(nanoseconds: 5_000_000)
                waited += 1
            }
            let beforeForeground = resolveAttempts()
            #expect(beforeForeground > 0)

            NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
            waited = 0
            while resolveAttempts() == beforeForeground, waited < 400 {
                try await Task.sleep(nanoseconds: 5_000_000)
                waited += 1
            }
            #expect(resolveAttempts() > beforeForeground, "the foreground notification must trigger a drain")

            await client.shutdown()
            let afterShutdown = resolveAttempts()
            NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
            try? await Task.sleep(nanoseconds: 200_000_000)
            #expect(
                resolveAttempts() == afterShutdown,
                "the foreground hook must not fire once the client is shut down"
            )
        }
    #endif

    /// A mutable test flag, for a stub handler whose behaviour changes mid-test.
    private final class Flag: @unchecked Sendable {
        private let lock = NSLock()
        private var stored: Bool

        init(_ value: Bool) { stored = value }

        var value: Bool {
            get {
                lock.lock()
                defer { lock.unlock() }
                return stored
            }
            set {
                lock.lock()
                stored = newValue
                lock.unlock()
            }
        }
    }
}
