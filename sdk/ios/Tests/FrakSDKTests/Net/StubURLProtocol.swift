import Foundation

/// A canned response or failure for `StubURLProtocol` to hand back.
struct StubResponse: Sendable {
    var status: Int
    var body: String
    var headers: [String: String] = [:]
}

/// Thrown by a handler to simulate a request that never completes; only the caller's own
/// deadline — not a canned response — ends it.
struct StubHangs: Error {}

/// Lock-protected, per-host handler registry. Keyed by host (each test uses its own unique
/// base URL) so parallel test suites sharing this class-level registration don't race on one
/// global closure.
private final class HandlerRegistry: @unchecked Sendable {
    private let lock = NSLock()
    private var handlers: [String: @Sendable (URLRequest) throws -> StubResponse] = [:]

    func set(_ host: String, _ handler: @escaping @Sendable (URLRequest) throws -> StubResponse) {
        lock.lock()
        defer { lock.unlock() }
        handlers[host] = handler
    }

    func remove(_ host: String) {
        lock.lock()
        defer { lock.unlock() }
        handlers.removeValue(forKey: host)
    }

    func call(_ host: String, _ request: URLRequest) throws -> StubResponse {
        lock.lock()
        let handler = handlers[host]
        lock.unlock()
        guard let handler else { throw URLError(.unknown) }
        return try handler(request)
    }
}

/// A `URLProtocol` test seam: exercises real `URLRequest` construction and
/// `HTTPURLResponse` parsing, unlike a hand-rolled transport fake.
final class StubURLProtocol: URLProtocol, @unchecked Sendable {
    private static let registry = HandlerRegistry()

    /// Registers a handler scoped to `host`. Each test must use its own unique host so
    /// concurrently-running tests never share state.
    static func handle(host: String, _ handler: @escaping @Sendable (URLRequest) throws -> StubResponse) {
        registry.set(host, handler)
    }

    static func reset(host: String) {
        registry.remove(host)
    }

    /// A session routed through this protocol, plus the unique host its requests must target.
    static func makeSession() -> (session: URLSession, host: String) {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let host = "stub-\(UUID().uuidString).invalid"
        return (URLSession(configuration: configuration), host)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let host = request.url?.host else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL))
            return
        }
        do {
            let stub = try Self.registry.call(host, request)
            guard let url = request.url,
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: stub.status,
                    httpVersion: "HTTP/1.1",
                    headerFields: stub.headers
                )
            else {
                client?.urlProtocol(self, didFailWithError: URLError(.badURL))
                return
            }
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(stub.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        } catch is StubHangs {
            // Never calls back: leaves the task pending until it is cancelled.
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
