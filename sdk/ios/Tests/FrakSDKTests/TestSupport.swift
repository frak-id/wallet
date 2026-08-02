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
