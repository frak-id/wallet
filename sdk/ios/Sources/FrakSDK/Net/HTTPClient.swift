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
    /// list — are small JSON; the entire 67-case golden rewards fixture, packing every reward
    /// kind and currency this SDK supports, is under 100 KB (`golden-rewards.json`). 1 MiB is
    /// generous headroom above any real payload while still bounding memory and what an
    /// oversized or misbehaving response could force into UserDefaults (S5).
    static let maxResponseBodyBytes: Int64 = 1024 * 1024

    /// Wall-clock ceiling for a whole request, both attempts included; the session's own
    /// per-attempt timeouts alone would let a retry double the worst-case wait.
    static let overallDeadlineSeconds: TimeInterval = 20

    /// Sized so two attempts plus `retryDelay` fit inside `overallDeadlineSeconds` with room to
    /// spare (N4): `timeoutIntervalForResource` bounds one attempt (a single URLSessionTask), so
    /// it must leave headroom for the retry `get` performs — the previous value (20s) equaled
    /// the *outer* wall-clock budget for the whole two-attempt sequence, meaning one slow-but-
    /// not-infinite attempt could exhaust the entire deadline by itself and starve the retry
    /// before `Deadline.run` ever got a chance to intervene. 8s per attempt × 2 + up to 0.3s of
    /// jittered delay (N6) is 16.3s, leaving 3.7s of slack under the 20s wall clock.
    static let defaultSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 8
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }()

    private let baseURL: String
    private let session: URLSession
    private let overallDeadlineSeconds: TimeInterval
    private let redirectDelegate = NoRedirectDelegate()

    init(
        baseURL: String,
        session: URLSession = HTTPClient.defaultSession,
        overallDeadlineSeconds: TimeInterval = HTTPClient.overallDeadlineSeconds
    ) {
        self.baseURL = baseURL
        self.session = session
        self.overallDeadlineSeconds = overallDeadlineSeconds
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
    /// on a guaranteed repeat (N6).
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
            // Short, jittered delay (N6): retrying instantly, in lockstep, across every client
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
        let (data, response) = try await session.data(for: request, delegate: redirectDelegate)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw FrakError.network(underlying: URLError(.badServerResponse))
        }
        // `expectedContentLength` is -1 when the header is absent, which is smaller than the cap
        // and so correctly falls through to the count check below rather than being rejected here.
        if httpResponse.expectedContentLength > Self.maxResponseBodyBytes {
            throw FrakError.network(underlying: ResponseTooLargeError(total: httpResponse.expectedContentLength))
        }
        // `session.data(for:)` has already buffered the whole body by the time we see it, so this
        // is a post-buffer check, not a true streaming abort: an oversized or misbehaving response
        // with an absent or lying Content-Length still costs the full transient memory allocation
        // before this check ever runs, unlike Android's HttpClient, which aborts the read
        // incrementally and never buffers past the cap (net/HttpClient.kt's readBytesUpTo). What
        // this check does guarantee is that the oversized body is never returned to a caller that
        // would persist it verbatim into UserDefaults (S5) — never truncated silently. A real fix
        // for the peak-memory gap needs `session.bytes(for:)` with an accumulating cap instead of
        // `session.data(for:)`; not done here, tracked as an open asymmetry between platforms.
        if data.count > Self.maxResponseBodyBytes {
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

    /// Values are percent-encoded with `PercentEncoding` (RFC 3986, matching the Android twin's
    /// `HttpClient.buildUrl` byte-for-byte); keys are compile-time constants and are not encoded.
    /// Not `URLComponents`: its `percentEncodedQuery` allows several RFC-3986-reserved characters
    /// (`!$&'()*+,;=`) through unescaped and passes `+` through literally rather than encoding it
    /// — the `replacingOccurrences(of: "+", with: "%2B")` this used to need was a symptom of using
    /// the wrong encoder, not a complete fix (every other reserved character it lets through stayed
    /// unescaped).
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
