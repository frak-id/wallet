import Foundation
import Testing

@testable import FrakSDK

@Suite("HTTPClient")
struct HTTPClientTests {
    /// Builds a client on its own uniquely-hosted stub session, and registers `handler`
    /// against that host. Each test gets isolated state, so parallel tests never race.
    private func makeClient(_ handler: @escaping @Sendable (URLRequest) throws -> StubResponse) -> HTTPClient {
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host, handler)
        return HTTPClient(baseURL: "https://\(host)", session: session)
    }

    @Test("sends the sdk-version and Accept headers")
    func sendsExpectedHeaders() async throws {
        let client = makeClient { request in
            #expect(request.value(forHTTPHeaderField: "Accept") == "application/json")
            #expect(request.value(forHTTPHeaderField: FrakSDKVersion.headerName) == FrakSDKVersion.current)
            return StubResponse(status: 200, body: "{}")
        }

        _ = try await client.get("/user/merchant/resolve")
    }

    @Test("drops nil query values and percent-encodes the rest")
    func buildsQueryCorrectly() async throws {
        let client = makeClient { request in
            let url = try #require(request.url?.absoluteString)
            #expect(url.contains("present=a%20b%2Bc"))
            #expect(!url.contains("absent"))
            return StubResponse(status: 200, body: "{}")
        }

        _ = try await client.get("/path", query: ["present": "a b+c", "absent": nil])
    }

    @Test("returns non-2xx responses rather than throwing")
    func nonSuccessIsReturnedNotThrown() async throws {
        let client = makeClient { _ in StubResponse(status: 404, body: "not found") }

        let response = try await client.get("/missing")
        #expect(response.status == 404)
        #expect(response.body == Data("not found".utf8))
        #expect(!response.isSuccess)
    }

    @Test("parses and clamps a large Retry-After")
    func retryAfterIsClamped() async throws {
        let client = makeClient { _ in
            StubResponse(status: 429, body: "", headers: ["Retry-After": "999999"])
        }

        let response = try await client.get("/limited")
        #expect(response.retryAfterSeconds == HTTPClient.maxRetryAfterSeconds)
    }

    @Test("an unparseable Retry-After is ignored")
    func unparseableRetryAfterIsIgnored() async throws {
        let client = makeClient { _ in
            StubResponse(status: 429, body: "", headers: ["Retry-After": "not-a-number"])
        }

        let response = try await client.get("/limited")
        #expect(response.retryAfterSeconds == nil)
    }

    @Test("toServerError reads the code field from an error envelope")
    func toServerErrorReadsCode() async throws {
        let client = makeClient { _ in
            StubResponse(status: 400, body: #"{"success":false,"error":"bad","code":"INVALID"}"#)
        }

        let response = try await client.get("/bad")
        guard case .server(let status, let code, _) = response.toServerError() else {
            Issue.record("expected .server")
            return
        }
        #expect(status == 400)
        #expect(code == "INVALID")
    }

    @Test("a transient URLError is retried once and succeeds")
    func transientFailureIsRetried() async throws {
        let attempts = Counter()
        let client = makeClient { _ in
            let count = attempts.increment()
            if count == 1 {
                throw URLError(.networkConnectionLost)
            }
            return StubResponse(status: 200, body: "ok")
        }

        let response = try await client.get("/flaky")
        #expect(response.body == Data("ok".utf8))
        #expect(attempts.value == 2)
    }

    @Test("a persistent URLError becomes FrakError.network")
    func persistentFailureBecomesNetworkError() async throws {
        let client = makeClient { _ in throw URLError(.notConnectedToInternet) }

        await #expect(throws: FrakError.self) {
            _ = try await client.get("/down")
        }
    }

    @Test("URLError.cancelled surfaces as CancellationError and is not retried")
    func cancellationIsNotRetried() async throws {
        let attempts = Counter()
        let client = makeClient { _ in
            attempts.increment()
            throw URLError(.cancelled)
        }

        await #expect(throws: CancellationError.self) {
            _ = try await client.get("/cancelled")
        }
        #expect(attempts.value == 1)
    }

    @Test("an arbitrary non-URLError transport failure surfaces as FrakError, not the raw error")
    func nonURLErrorSurfacesAsFrakError() async throws {
        struct Boom: Error {}
        let client = makeClient { _ in throw Boom() }

        await #expect(throws: FrakError.self) {
            _ = try await client.get("/boom")
        }
    }

    @Test("the overall deadline bounds a retried request rather than doubling the per-attempt wait")
    func overallDeadlineBoundsRetriedRequest() async throws {
        let attempts = Counter()
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { _ in
            if attempts.increment() == 1 {
                throw URLError(.networkConnectionLost)
            }
            throw StubHangs()
        }
        let client = HTTPClient(baseURL: "https://\(host)", session: session, overallDeadlineSeconds: 0.2)

        let start = Date()
        await #expect(throws: FrakError.self) {
            _ = try await client.get("/slow")
        }
        let elapsed = Date().timeIntervalSince(start)

        #expect(attempts.value == 2)
        #expect(elapsed < 1)
    }

    @Test("cancelling the caller surfaces CancellationError even with a request in flight")
    func callerCancellationSurfacesAsCancellationError() async throws {
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { _ in throw StubHangs() }
        let client = HTTPClient(baseURL: "https://\(host)", session: session, overallDeadlineSeconds: 5)

        let task = Task {
            try await client.get("/hangs")
        }
        try await Task.sleep(nanoseconds: 50_000_000)
        task.cancel()

        await #expect(throws: CancellationError.self) {
            _ = try await task.value
        }
    }
}
