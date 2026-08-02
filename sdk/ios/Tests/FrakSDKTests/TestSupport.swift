import Foundation

@testable import FrakSDK

/// Collects every value a background subscriber Task sees from an `AsyncStream`, so a
/// test can assert both what arrived and how many times.
actor ConfigLog {
    private(set) var values: [FrakResolvedConfig] = []

    func append(_ value: FrakResolvedConfig) {
        values.append(value)
    }
}

/// A mutable test clock, injected wherever production code takes `now: () -> Date`.
final class Clock: @unchecked Sendable {
    var current = Date(timeIntervalSince1970: 0)
}

/// Lock-protected collector of every `URLRequest` a stub handler saw.
final class RequestLog: @unchecked Sendable {
    private let lock = NSLock()
    private var requests: [URLRequest] = []

    func record(_ request: URLRequest) {
        lock.lock()
        defer { lock.unlock() }
        requests.append(request)
    }

    var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return requests.count
    }

    var all: [URLRequest] {
        lock.lock()
        defer { lock.unlock() }
        return requests
    }

    var urls: [String] {
        all.compactMap { $0.url?.absoluteString }
    }
}

/// Lock-protected counter, for stub handlers that vary their response by call, or
/// tests asserting how many times something ran.
final class Counter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0

    @discardableResult
    func increment() -> Int {
        lock.lock()
        defer { lock.unlock() }
        count += 1
        return count
    }

    var value: Int {
        lock.lock()
        defer { lock.unlock() }
        return count
    }
}

extension URLRequest {
    /// The request body as `URLProtocol` actually sees it: `URLSession` moves `httpBody`
    /// into `httpBodyStream` before a protocol handler runs, so reading `httpBody` alone
    /// silently returns nil for every POST.
    var stubBody: Data {
        if let httpBody { return httpBody }
        guard let stream = httpBodyStream else { return Data() }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: buffer.count)
            guard read > 0 else { break }
            data.append(buffer, count: read)
        }
        return data
    }

    /// The body parsed as a JSON object, for asserting on what was sent.
    var stubJSON: [String: Any] {
        (try? JSONSerialization.jsonObject(with: stubBody)) as? [String: Any] ?? [:]
    }
}
