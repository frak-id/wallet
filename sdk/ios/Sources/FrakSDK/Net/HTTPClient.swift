import Foundation

/// Declines every redirect: every URL we request is already ours, so a redirect means
/// misconfiguration, not something to follow.
private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest
    ) async -> URLRequest? {
        nil
    }
}

/// A response body exceeded `HTTPClient.maxResponseBodyBytes`. `total` is the advertised
/// `Content-Length` when the header alone was enough to reject the response, or the actual byte
/// count when the cap was hit only after the body was read (Content-Length absent or lying).
struct ResponseTooLargeError: Error, Sendable {
    let total: Int64
}

/// The SDK's networking layer: one GET, over `URLSession`. Zero third-party deps.
struct HTTPClient: Sendable {
    /// A response that made it back, whatever its status.
    struct Response: Sendable {
        let status: Int
        let body: Data
        let retryAfterSeconds: Int?

        var isSuccess: Bool { (200..<300).contains(status) }

        /// Maps this response to the generic non-2xx error. Callers with a route-specific
        /// status meaning map that themselves and fall back to this for everything else.
        func toServerError() -> FrakError {
            .server(status: status, code: JSONDecoding.errorCode(in: body), retryAfterSeconds: retryAfterSeconds)
        }
    }

    static let maxRetryAfterSeconds = 300

    /// 1 MiB. Both responses this client ever reads — a merchant config resolve and a rewards
    /// list — are small JSON; generous headroom above any real payload while still bounding
    /// memory and what an oversized or misbehaving response could force into UserDefaults.
    static let maxResponseBodyBytes: Int64 = 1024 * 1024

    /// Wall-clock ceiling for a whole request, both attempts included. This is the SDK's
    /// single authoritative timeout mechanism: `Deadline.run` races the request against this
    /// one wall-clock bound and is what actually fires on a hang. The session's own timeouts
    /// (see `defaultSession`) are set well above this deadline, so they exist only as a
    /// defense-in-depth backstop against `URLSession` wedging, not as the mechanism that fires.
    /// Matches Android's effective per-request budget of ~20s, though the two platforms enforce
    /// it differently: Android's per-attempt timeouts are tight enough to be the mechanism that
    /// actually fires there, where here it is `Deadline.run`.
    static let overallDeadlineSeconds: TimeInterval = 20

    /// Set well above `overallDeadlineSeconds` so neither can ever be the mechanism that
    /// actually ends a request — `Deadline.run` always wins first. Not `.infinity`/unset: this
    /// still bounds the pathological case of `Deadline.run`'s own cancellation failing to
    /// unblock a wedged `URLSessionTask`.
    private static let sessionBackstopSeconds: TimeInterval = 60

    static let defaultSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = sessionBackstopSeconds
        configuration.timeoutIntervalForResource = sessionBackstopSeconds
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }()

    private let baseURL: String
    private let session: URLSession
    private let overallDeadlineSeconds: TimeInterval
    private let redirectDelegate = NoRedirectDelegate()
    // Self-contained here rather than threaded through from DefaultFrakClient: HTTPClient is
    // constructed before that init has a fully-built FrakLogger to hand it. Defaults to nil —
    // silent — until a caller passes one in.
    private let logger: FrakLogger?

    init(
        baseURL: String,
        session: URLSession = HTTPClient.defaultSession,
        overallDeadlineSeconds: TimeInterval = HTTPClient.overallDeadlineSeconds,
        logger: FrakLogger? = nil
    ) {
        self.baseURL = baseURL
        self.session = session
        self.overallDeadlineSeconds = overallDeadlineSeconds
        self.logger = logger
    }

    /// Issues a GET and returns the raw response, successful or not. `path` includes
    /// the leading slash; nil query values are dropped rather than sent empty.
    func get(_ path: String, query: [String: String?] = [:]) async throws -> Response {
        let request = try buildRequest(path: path, query: query)
        do {
            // Deadline wraps both attempts; giving the retry its own fresh window would
            // double the worst-case wait.
            return try await Deadline.run(seconds: overallDeadlineSeconds) {
                try await self.performWithRetry(request)
            }
        } catch is Deadline.Exceeded {
            throw FrakError.network(underlying: Deadline.Exceeded())
        }
    }

    /// Issues a POST and returns the raw response, successful or not.
    ///
    /// No transport-level retry, unlike `get`: a POST is not safe to replay blindly.
    /// Retrying is the caller's decision, and the tracking queue makes it with an
    /// idempotency key the backend can dedupe on.
    func post(_ path: String, body: Data, headers: [String: String] = [:]) async throws -> Response {
        var request = try buildRequest(path: path, query: [:])
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (name, value) in headers {
            request.setValue(value, forHTTPHeaderField: name)
        }
        let finalRequest = request
        do {
            return try await Deadline.run(seconds: overallDeadlineSeconds) {
                try await self.attempt(finalRequest)
            }
        } catch is Deadline.Exceeded {
            throw FrakError.network(underlying: Deadline.Exceeded())
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as FrakError {
            throw error
        } catch {
            throw FrakError.network(underlying: error)
        }
    }

    /// A dropped/reset/timed-out connection is worth one retry; a trust or configuration failure
    /// will just fail identically again, so retrying only burns the deadline's remaining budget
    /// on a guaranteed repeat.
    private static func isTransient(_ error: URLError) -> Bool {
        switch error.code {
        case .networkConnectionLost, .notConnectedToInternet, .timedOut, .cannotConnectToHost,
            .cannotFindHost, .dnsLookupFailed:
            true
        default:
            false
        }
    }

    private func performWithRetry(_ request: URLRequest) async throws -> Response {
        do {
            return try await attempt(request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch let error as URLError where Self.isTransient(error) {
            // One retry: a pooled connection closed server-side while idle fails on next
            // use, indistinguishable from a real failure. Safe only because this is GET-only.
            // Short, jittered delay: retrying instantly, in lockstep, across every client
            // affected by the same blip recreates the load spike that caused it.
            try await Task.sleep(nanoseconds: Self.retryDelayNanoseconds())
            return try await retry(request)
        } catch let error as URLError {
            // Not in isTransient's allowlist — e.g. a trust or TLS configuration failure.
            throw FrakError.network(underlying: error)
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as FrakError {
            // attempt() already throws a fully-formed FrakError (e.g. an oversized body); wrapping
            // it again here would bury the real cause inside a second .network(underlying:).
            throw error
        } catch {
            throw FrakError.network(underlying: error)
        }
    }

    private static func retryDelayNanoseconds() -> UInt64 {
        let baseMilliseconds: UInt64 = 100
        let jitterMilliseconds = UInt64.random(in: 0...200)
        return (baseMilliseconds + jitterMilliseconds) * 1_000_000
    }

    private func retry(_ request: URLRequest) async throws -> Response {
        do {
            return try await attempt(request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as FrakError {
            throw error
        } catch {
            throw FrakError.network(underlying: error)
        }
    }

    private func attempt(_ request: URLRequest) async throws -> Response {
        let start = Date()
        do {
            let response = try await attemptUnlogged(request)
            logResult(request, status: response.status, start: start)
            return response
        } catch {
            logResult(request, status: nil, start: start)
            throw error
        }
    }

    /// DEBUG-level only, symmetric with Android's `HttpClient`. Logs method, host, path and
    /// status/duration — never the query string (a merchant id or the anonymous id can ride in
    /// it, e.g. `campaigns?anonymousId=…`) and never a header value (an auth token lives
    /// there). `os.Logger` interpolation stays `.private` even though a path alone is rarely
    /// sensitive, since a future route could add a path parameter without anyone revisiting
    /// this call site.
    private func logResult(_ request: URLRequest, status: Int?, start: Date) {
        guard let logger else { return }
        let durationMs = Int(Date().timeIntervalSince(start) * 1000)
        let method = request.httpMethod ?? "GET"
        let host = request.url?.host ?? "?"
        let path = request.url?.path ?? "?"
        let statusText = status.map(String.init) ?? "error"
        logger.debug("Frak \(method) \(host)\(path) -> \(statusText) (\(durationMs)ms)")
    }

    private func attemptUnlogged(_ request: URLRequest) async throws -> Response {
        // Not a true streaming read: `session.data(for:)` buffers the entire body before this
        // function runs, so unlike Android's `readBytesUpTo` this does not bound peak memory
        // during the read — a chunked response with no (or a lying) Content-Length can still be
        // buffered in full before the check below ever runs. What is guaranteed: an oversized
        // body is never returned to a caller that would persist it, and an honest large
        // response with a real Content-Length is rejected before the transfer finishes.
        let (data, response) = try await session.data(for: request, delegate: redirectDelegate)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw FrakError.network(underlying: URLError(.badServerResponse))
        }
        // `expectedContentLength` is -1 when the header is absent; not sufficient alone since a
        // chunked or lying response has no (or a false) Content-Length, so the post-buffer
        // check below is the real backstop against an oversized body.
        if httpResponse.expectedContentLength > Self.maxResponseBodyBytes {
            throw FrakError.network(underlying: ResponseTooLargeError(total: httpResponse.expectedContentLength))
        }
        if Int64(data.count) > Self.maxResponseBodyBytes {
            throw FrakError.network(underlying: ResponseTooLargeError(total: Int64(data.count)))
        }
        return Response(status: httpResponse.statusCode, body: data, retryAfterSeconds: retryAfterSeconds(httpResponse))
    }

    private func retryAfterSeconds(_ response: HTTPURLResponse) -> Int? {
        guard let header = response.value(forHTTPHeaderField: "Retry-After"),
            let seconds = Int(header.trimmingCharacters(in: .whitespaces))
        else {
            return nil
        }
        return min(max(seconds, 1), Self.maxRetryAfterSeconds)
    }

    /// Values are percent-encoded with `PercentEncoding` (RFC 3986); keys are compile-time
    /// constants and are not encoded.
    ///
    /// Not `URLComponents`: its `percentEncodedQuery` allows several RFC-3986-reserved
    /// characters (`!$&'()*+,;=`) through unescaped and passes `+` through literally rather
    /// than encoding it.
    private func buildRequest(path: String, query: [String: String?]) throws -> URLRequest {
        let present = query.compactMapValues { $0 }
        let urlString: String
        if present.isEmpty {
            urlString = baseURL + path
        } else {
            let encodedQuery = present.map { key, value in "\(key)=\(PercentEncoding.encode(value))" }
                .joined(separator: "&")
            urlString = "\(baseURL)\(path)?\(encodedQuery)"
        }
        guard let url = URL(string: urlString) else {
            throw FrakError.network(underlying: URLError(.badURL))
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(FrakSDKVersion.current, forHTTPHeaderField: FrakSDKVersion.headerName)
        return request
    }
}
