import Foundation
import Testing

@testable import FrakSDK

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
        respond: @escaping @Sendable (URLRequest) throws -> StubResponse
    ) -> DefaultFrakClient {
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host, respond)
        let logger = FrakLogger(level: .none)
        return DefaultFrakClient(
            settings: config,
            store: InMemoryKeyValueStore(),
            identity: AnonymousIdStore(
                keyStore: FakeDeviceKeyStore(),
                store: InMemoryKeyValueStore(),
                logger: logger,
                merchantMarker: config.merchantId ?? "",
                trackingEnabled: config.trackingEnabled
            ),
            queue: EventQueue(
                fileURL: FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString, isDirectory: true)
                    .appendingPathComponent(EventQueue.fileName),
                logger: logger
            ),
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

    @Test("trackingEnabled false throws trackingDisabled without a network call")
    func trackingDisabledThrowsWithoutNetworkCall() async throws {
        let log = RequestLog()
        let config = FrakConfig(merchantId: Self.merchantId, trackingEnabled: false)
        let client = makeClient(config: config) { request in
            log.record(request)
            return StubResponse(status: 200, body: Self.resolveBody)
        }

        await #expect(throws: FrakError.self) {
            _ = try await client.resolveConfig(forceRefresh: false)
        }
        #expect(log.all.isEmpty)
    }

    @Test("resolveConfig, campaigns and bestReward have usable defaults")
    func facadeMethodsHaveUsableDefaults() async throws {
        let client = makeClient { request in
            if request.url?.path.contains("resolve") == true {
                return StubResponse(status: 200, body: Self.resolveBody)
            }
            return StubResponse(status: 200, body: Self.rewardsBody)
        }

        // The last call is the one `Frak`'s own documentation shows.
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
    func buildSharingLinkNeedsABaseURL() async {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        let link = await client.buildSharingLink(SharingRequest())
        #expect(link == nil)
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
        // True — the link is ours — but nothing is tracked: a user cannot refer themselves.
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
        _ = try? await client.resolveConfig()  // populates the config store's cache, mirroring the Android fixture's settled state
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
        // The odd casing/whitespace has to live on the config side: FrakContextCodec rejects any
        // merchantId that isn't a canonical lowercase UUID, so a link can never carry one — only
        // FrakConfig.merchantId is free-typed and unvalidated. The link below carries the
        // canonical Self.merchantId with a different clientId (a different device, same
        // merchant), so the only variable under test is settings.merchantId vs
        // context.merchantId, which is exactly what ReferralArrival.sameMerchant normalises.
        // Without that normalisation this link would be dropped as a foreign-merchant arrival,
        // so the assertion below fails if the trim/case-fold is removed.
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
        #expect(absent.opened == ["https://apps.apple.com/app/id6740261164"])
    }

    @Test("openFrakApp opens the wallet even when the merchant never declared the scheme")
    func openFrakAppIgnoresARefusingProbe() async {
        // `canOpenURL` answers false unless the merchant listed the wallet scheme in
        // `LSApplicationQueriesSchemes`, which the SDK cannot inject. Gating the deep link
        // on the probe turned that omission into a wallet that is installed and never
        // opens; `open` is not gated by that list, so attempting it is the whole fix.
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

        let page = try #require(
            await client.installPageURL(returnScheme: "frak-com.acme.app", sessionId: "session-1")
        )
        let anonymousId = try #require(await client.anonymousId)

        let expected =
            "https://wallet.frak.id/install?m=\(Self.merchantId)&a=\(anonymousId)"
            + "&returnScheme=frak-com.acme.app&sid=session-1"
        #expect(page.hasPrefix(expected))

        // The fragment, never a search param: it is never sent to a server, never logged and
        // never in a `Referer`, and the sheet loads this URL directly so it survives.
        let fragment = try #require(page.split(separator: "#", maxSplits: 1).last)
        #expect(fragment.hasPrefix("p="))
        #expect(fragment.count > "p=".count)
        #expect(!page.contains("&p="))
    }

    @Test("installPageURL needs an identity, like every other install link")
    func installPageURLNeedsAnIdentity() async {
        let config = FrakConfig(merchantId: FrakClientTests.merchantId, trackingEnabled: false)
        let client = makeClient(config: config) { _ in StubResponse(status: 200, body: Self.resolveBody) }

        #expect(await client.installPageURL(returnScheme: "frak-com.acme.app", sessionId: "s1") == nil)
    }

    @Test("installURL needs an identity to link")
    func installURLNeedsAnIdentity() async {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        let url = await client.installURL()
        #expect(url == "https://apps.apple.com/app/id6740261164")

        let untracked = makeClient(config: FrakConfig(merchantId: Self.merchantId, trackingEnabled: false)) { _ in
            StubResponse(status: 200, body: Self.resolveBody)
        }
        let withoutIdentity = await untracked.installURL()
        #expect(withoutIdentity == nil)
    }
}
