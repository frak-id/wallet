import Foundation
import Testing

@testable import FrakSDK

@Suite("RewardRepository")
struct RewardRepositoryTests {
    private static let merchantId = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
    private static let empty = #"{"rewards":[]}"#

    private func makeRepository(
        clock: Clock,
        log: RequestLog,
        respond: @escaping @Sendable (URLRequest) throws -> StubResponse
    ) -> RewardRepository {
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { request in
            log.record(request)
            return try respond(request)
        }
        let http = HTTPClient(baseURL: "https://\(host)", session: session)
        return RewardRepository(http: http, logger: FrakLogger(level: .none), now: { clock.current })
    }

    @Test("formatted is sent as the literal string 1")
    func formattedIsSentAsLiteralOne() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )

        let url = try #require(log.all.first?.url?.absoluteString)
        #expect(url.contains("formatted=1"))
    }

    @Test("currency comes from config, never from the caller")
    func currencyComesFromConfig() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .gbp,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )

        let url = try #require(log.all.first?.url?.absoluteString)
        #expect(url.contains("currency=gbp"))
    }

    @Test("unset narrowing parameters are omitted entirely")
    func unsetNarrowingParametersAreOmitted() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )

        let url = try #require(log.all.first?.url?.absoluteString)
        #expect(!url.contains("targetInteraction"))
        #expect(!url.contains("audience"))
    }

    @Test("narrowing parameters are sent when supplied")
    func narrowingParametersSentWhenSupplied() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: "purchase",
            audience: .referrer,
            forceRefresh: false
        )

        let url = try #require(log.all.first?.url?.absoluteString)
        #expect(url.contains("targetInteraction=purchase"))
        #expect(url.contains("audience=referrer"))
    }

    @Test("an unknown merchant returns an empty list rather than an error")
    func unknownMerchantReturnsEmptyList() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        let result = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )

        #expect(result.campaigns.isEmpty)
        #expect(result.best == nil)
    }

    @Test("a repeat within the cache window does not dial")
    func repeatWithinCacheWindowDoesNotDial() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )
        clock.current.addTimeInterval(RewardRepository.cacheTTL - 1)
        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )

        #expect(log.count == 1)
    }

    @Test("an expired entry is refetched rather than served stale")
    func expiredEntryIsRefetched() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )
        clock.current.addTimeInterval(RewardRepository.cacheTTL)
        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )

        #expect(log.count == 2)
    }

    @Test("queries differing only in audience do not share a cache entry")
    func queriesDifferingInAudienceDoNotShareCache() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: .referrer,
            forceRefresh: false
        )
        _ = try await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: .referee,
            forceRefresh: false
        )

        #expect(log.count == 2)
    }

    @Test("concurrent callers share one request")
    func concurrentCallersShareOneRequest() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.empty) }

        async let a = repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )
        async let b = repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: false
        )
        _ = try await (a, b)

        #expect(log.count == 1)
    }

    @Test("a transport failure surfaces as a network error")
    func transportFailureSurfacesAsNetworkError() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in throw URLError(.notConnectedToInternet) }

        await #expect(throws: FrakError.self) {
            _ = try await repository.fetch(
                merchantId: Self.merchantId,
                currency: .eur,
                targetInteraction: nil,
                audience: nil,
                forceRefresh: false
            )
        }
    }

    @Test("backing off refuses to dial with an honest error, not a fabricated lost connection")
    func backingOffThrowsAnHonestError() async throws {
        let clock = Clock()
        let log = RequestLog()
        let repository = makeRepository(clock: clock, log: log) { _ in StubResponse(status: 500, body: "") }

        _ = try? await repository.fetch(
            merchantId: Self.merchantId,
            currency: .eur,
            targetInteraction: nil,
            audience: nil,
            forceRefresh: true
        )

        var thrown: FrakError?
        do {
            _ = try await repository.fetch(
                merchantId: Self.merchantId,
                currency: .eur,
                targetInteraction: nil,
                audience: nil,
                forceRefresh: true
            )
        } catch let error as FrakError {
            thrown = error
        }

        let error = try #require(thrown)
        guard case .network(let underlying) = error else {
            Issue.record("expected .network")
            return
        }
        #expect(underlying.localizedDescription.contains("backing off"))
    }
}
