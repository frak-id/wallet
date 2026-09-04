import Foundation
import Testing

@testable import FrakSDK

@Suite("Backoff")
struct BackoffTests {
    /// Draws the top of the jitter range, for exact, assertable delays.
    private static let maxJitter: @Sendable (ClosedRange<Double>) -> Double = { $0.upperBound }
    private static let zeroJitter: @Sendable (ClosedRange<Double>) -> Double = { $0.lowerBound }

    private func makeBackoff(
        clock: Clock,
        jitter: @escaping @Sendable (ClosedRange<Double>) -> Double = BackoffTests.maxJitter
    ) -> Backoff {
        Backoff(now: { clock.current }, random: jitter)
    }

    /// Advances the clock until `key` stops backing off, returning the elapsed time.
    private func measureWindow(_ backoff: inout Backoff, _ key: String, clock: Clock) -> TimeInterval {
        let start = clock.current
        while backoff.isBackingOff(key) {
            clock.current.addTimeInterval(1)
        }
        return clock.current.timeIntervalSince(start)
    }

    @Test("a fresh key is not backing off")
    func freshKeyIsNotBackingOff() {
        var backoff = Backoff()
        let backingOff = backoff.isBackingOff("k")
        #expect(!backingOff)
    }

    @Test("one failure arms a window of at least the minimum delay")
    func oneFailureArmsMinimumWindow() {
        let clock = Clock()
        var backoff = makeBackoff(clock: clock)
        backoff.recordFailure("k", from: nil)

        let immediatelyAfter = backoff.isBackingOff("k")
        #expect(immediatelyAfter)
        clock.current.addTimeInterval(Backoff.minDelay)
        let afterWindow = backoff.isBackingOff("k")
        #expect(!afterWindow)
    }

    @Test("delay grows exponentially with consecutive failures")
    func delayGrowsExponentially() {
        let clock = Clock()
        var backoff = makeBackoff(clock: clock)

        var delays: [TimeInterval] = []
        for count in 1...4 {
            clock.current = Date(timeIntervalSince1970: 0)
            for _ in 0..<count { backoff.recordFailure("k", from: nil) }
            delays.append(measureWindow(&backoff, "k", clock: clock))
        }

        #expect(delays == [1, 2, 4, 8])
    }

    @Test("delay is capped")
    func delayIsCapped() {
        let clock = Clock()
        var backoff = makeBackoff(clock: clock)
        for _ in 0..<20 { backoff.recordFailure("k", from: nil) }

        #expect(measureWindow(&backoff, "k", clock: clock) == Backoff.maxDelay)
    }

    @Test("a Retry-After acts as a floor, not a replacement")
    func retryAfterActsAsFloor() {
        let clock = Clock()
        var backoff = makeBackoff(clock: clock)
        backoff.recordFailure("k", from: .server(status: 429, code: nil, retryAfterSeconds: 30))

        #expect(measureWindow(&backoff, "k", clock: clock) == 30)
    }

    @Test("our own exponential wins once it exceeds the server floor")
    func exponentialOvertakesServerFloor() {
        let clock = Clock()
        var backoff = makeBackoff(clock: clock)
        for _ in 0..<6 { backoff.recordFailure("k", from: .server(status: 429, code: nil, retryAfterSeconds: 2)) }

        #expect(measureWindow(&backoff, "k", clock: clock) > 2)
    }

    @Test("success clears the window")
    func successClearsWindow() {
        var backoff = Backoff()
        backoff.recordFailure("k", from: nil)
        backoff.recordSuccess("k")

        let backingOff = backoff.isBackingOff("k")
        #expect(!backingOff)
    }

    @Test("success resets the exponential rather than merely clearing it")
    func successResetsExponential() {
        let clock = Clock()
        var backoff = makeBackoff(clock: clock)
        for _ in 0..<5 { backoff.recordFailure("k", from: nil) }
        backoff.recordSuccess("k")
        clock.current = Date(timeIntervalSince1970: 0)
        backoff.recordFailure("k", from: nil)

        #expect(measureWindow(&backoff, "k", clock: clock) == Backoff.minDelay)
    }

    @Test("keys back off independently")
    func keysBackOffIndependently() {
        var backoff = Backoff()
        backoff.recordFailure("a", from: nil)

        let aBackingOff = backoff.isBackingOff("a")
        let bBackingOff = backoff.isBackingOff("b")
        #expect(aBackingOff)
        #expect(!bBackingOff)
    }

    @Test("jitter halves the floor rather than smearing around the delay")
    func jitterHalvesTheFloor() {
        let clock = Clock()
        var backoff = makeBackoff(clock: clock, jitter: Self.zeroJitter)
        backoff.recordFailure("k", from: nil)

        clock.current.addTimeInterval(Backoff.minDelay / 2)
        let backingOff = backoff.isBackingOff("k")
        #expect(!backingOff)
    }
}
