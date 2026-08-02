import Foundation

/// Per-key failure backoff: exponential, jittered, `Retry-After`-aware.
///
/// A backoff hit suppresses the network, not the answer — cached data is still served.
/// A plain struct, held as isolated state inside an owning actor rather than being
/// an actor itself.
struct Backoff {
    /// Distinguishes refusing to dial from an actual lost connection, so a merchant
    /// catching `.network` isn't handed a misleading cause.
    struct BackingOff: Error, LocalizedError {
        let what: String
        var errorDescription: String? { "backing off after repeated \(what) failures" }
    }

    private struct Entry {
        let failureCount: Int
        let retryAt: Date
    }

    static let minDelay: TimeInterval = 1
    static let maxDelay: TimeInterval = 60
    private static let maxShift = 6

    private var state: [String: Entry] = [:]
    private let now: @Sendable () -> Date
    private let random: @Sendable (ClosedRange<Double>) -> Double

    init(
        now: @escaping @Sendable () -> Date = { Date() },
        random: @escaping @Sendable (ClosedRange<Double>) -> Double = { Double.random(in: $0) }
    ) {
        self.now = now
        self.random = random
    }

    /// True when `key` is inside its backoff window and must not be dialled.
    mutating func isBackingOff(_ key: String) -> Bool {
        guard let entry = state[key] else { return false }
        if now() >= entry.retryAt {
            // Expired windows are dropped on read, so the map cannot grow unbounded.
            state.removeValue(forKey: key)
            return false
        }
        return true
    }

    /// Records a failure and arms the next window. A server `Retry-After` — pulled out of
    /// `error` when it is a `.server` — acts as a floor, not a replacement: the exponential
    /// must still grow past repeated failures.
    mutating func recordFailure(_ key: String, from error: FrakError?) {
        let failureCount = (state[key]?.failureCount ?? 0) + 1
        let exponential = Self.minDelay * pow(2, Double(min(failureCount - 1, Self.maxShift)))
        let capped = min(exponential, Self.maxDelay)
        let retryAfterSeconds: Int?
        if case .server(_, _, let seconds) = error {
            retryAfterSeconds = seconds
        } else {
            retryAfterSeconds = nil
        }
        let serverFloor = TimeInterval(retryAfterSeconds ?? 0)
        let delay = max(capped, serverFloor)
        state[key] = Entry(failureCount: failureCount, retryAt: now().addingTimeInterval(jitter(delay)))
    }

    mutating func recordSuccess(_ key: String) {
        state.removeValue(forKey: key)
    }

    /// Records `error` against `key` and rethrows it. For a non-2xx already mapped to a
    /// `FrakError`.
    mutating func recordFailureAndThrow(_ key: String, _ error: FrakError) throws -> Never {
        recordFailure(key, from: error)
        throw error
    }

    private func jitter(_ delay: TimeInterval) -> TimeInterval {
        guard delay > 0 else { return 0 }
        let half = delay / 2
        return random(half...delay)
    }
}
