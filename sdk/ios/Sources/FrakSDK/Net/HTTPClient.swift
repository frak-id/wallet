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

    /// Wall-clock ceiling for a whole request, both attempts included; the session's own
    /// per-attempt timeouts alone would let a retry double the worst-case wait.
    static let overallDeadlineSeconds: TimeInterval = 20

    static let defaultSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 20
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

    private func performWithRetry(_ request: URLRequest) async throws -> Response {
        do {
            return try await attempt(request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch is URLError {
            // One retry: a pooled connection closed server-side while idle fails on next
            // use, indistinguishable from a real failure. Safe only because this is GET-only.
            return try await retry(request)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw FrakError.network(underlying: error)
        }
    }

    private func retry(_ request: URLRequest) async throws -> Response {
        do {
            return try await attempt(request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw FrakError.network(underlying: error)
        }
    }

    private func attempt(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await session.data(for: request, delegate: redirectDelegate)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw FrakError.network(underlying: URLError(.badServerResponse))
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

    private func buildRequest(path: String, query: [String: String?]) throws -> URLRequest {
        guard var components = URLComponents(string: baseURL + path) else {
            throw FrakError.network(underlying: URLError(.badURL))
        }
        let items = query.compactMap { key, value in value.map { URLQueryItem(name: key, value: $0) } }
        if !items.isEmpty {
            components.queryItems = items
            // URLComponents passes "+" through literally instead of percent-encoding it.
            components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        }
        guard let url = components.url else {
            throw FrakError.network(underlying: URLError(.badURL))
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(FrakSDKVersion.current, forHTTPHeaderField: FrakSDKVersion.headerName)
        return request
    }
}
