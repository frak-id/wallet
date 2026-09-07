import Foundation
import Testing

@testable import FrakSDK

@Suite("SingleFlight")
struct SingleFlightTests {
    // Sleeps so the three callers genuinely overlap in flight, not just in the joinable map.
    @Test("concurrent callers for the same key share one execution")
    func concurrentCallersShareOneExecution() async throws {
        let singleFlight = SingleFlight<Int>()
        let counter = Counter()
        let work: @Sendable () async throws -> Int = {
            try await Task.sleep(nanoseconds: 200_000_000)
            return counter.increment()
        }

        async let first = singleFlight.run("k", work)
        async let second = singleFlight.run("k", work)
        async let third = singleFlight.run("k", work)

        let results = try await [first, second, third]
        #expect(results == [1, 1, 1])
        #expect(counter.value == 1)
    }

    @Test("a cancelled caller does not cancel the shared work for others")
    func cancellingOneCallerDoesNotAffectOthers() async throws {
        let singleFlight = SingleFlight<Int>()

        let cancelled = Task {
            try await singleFlight.run("k") {
                try await Task.sleep(nanoseconds: 200_000_000)
                return 42
            }
        }
        let waiter = Task {
            try await singleFlight.run("k") {
                try await Task.sleep(nanoseconds: 200_000_000)
                return 42
            }
        }

        cancelled.cancel()
        let result = try await waiter.value
        #expect(result == 42)
    }

    @Test("a later call for the same key after completion runs again")
    func laterCallRunsAgain() async throws {
        let singleFlight = SingleFlight<Int>()
        let counter = Counter()

        _ = try await singleFlight.run("k") { counter.increment() }
        _ = try await singleFlight.run("k") { counter.increment() }

        #expect(try await singleFlight.run("k") { counter.increment() } == 3)
    }

    @Test("a cancelled waiter throws CancellationError promptly, without cancelling the shared work")
    func cancelledWaiterThrowsPromptlyAndSharedWorkSurvives() async throws {
        let singleFlight = SingleFlight<Int>()
        let counter = Counter()
        let work: @Sendable () async throws -> Int = {
            try await Task.sleep(nanoseconds: 500_000_000)
            return counter.increment()
        }

        let cancelled = Task { try await singleFlight.run("k", work) }
        let waiter = Task { try await singleFlight.run("k", work) }

        // Let both register as waiters on the one flight before cancelling either.
        try await Task.sleep(nanoseconds: 100_000_000)
        let start = Date()
        cancelled.cancel()

        await #expect(throws: CancellationError.self) { try await cancelled.value }

        #expect(Date().timeIntervalSince(start) < 0.2)

        #expect(try await waiter.value == 1)
        #expect(counter.value == 1)
    }

    @Test("a cancelled leader does not evict the live flight")
    func cancelledLeaderDoesNotEvictLiveFlight() async throws {
        let singleFlight = SingleFlight<Int>()
        let counter = Counter()
        let work: @Sendable () async throws -> Int = {
            try await Task.sleep(nanoseconds: 400_000_000)
            return counter.increment()
        }

        let leader = Task { try await singleFlight.run("k", work) }
        try await Task.sleep(nanoseconds: 50_000_000)
        leader.cancel()
        _ = try? await leader.value

        // Arrives after the leader gave up but while the flight is still in the air.
        let joiner = Task { try await singleFlight.run("k", work) }
        #expect(try await joiner.value == 1)
        #expect(counter.value == 1)
    }

    @Test("a caller arriving right after completion runs again rather than joining a finished flight")
    func callerAfterCompletionDoesNotJoinFinishedFlight() async throws {
        let singleFlight = SingleFlight<Int>()
        let counter = Counter()
        let work: @Sendable () async throws -> Int = { counter.increment() }

        #expect(try await singleFlight.run("k", work) == 1)

        // Immediately, with no awaits in between to let a cleanup hop land first.
        #expect(try await singleFlight.run("k", work) == 2)
        #expect(counter.value == 2)
    }

    @Test("different keys do not share an execution")
    func differentKeysDoNotShare() async throws {
        let singleFlight = SingleFlight<Int>()
        let counter = Counter()

        async let first = singleFlight.run("a") { counter.increment() }
        async let second = singleFlight.run("b") { counter.increment() }

        let results = try await [first, second].sorted()
        #expect(results == [1, 2])
    }

    @Test("a failing flight propagates the error to every waiter and is not cached")
    func failureReachesEveryWaiterAndIsNotCached() async throws {
        struct Boom: Error {}
        let singleFlight = SingleFlight<Int>()
        let counter = Counter()

        let work: @Sendable () async throws -> Int = {
            _ = counter.increment()
            try await Task.sleep(nanoseconds: 100_000_000)
            throw Boom()
        }

        // Task, not async let: an async let variable cannot be captured by #expect(throws:)'s closure.
        let first = Task { try await singleFlight.run("k", work) }
        let second = Task { try await singleFlight.run("k", work) }

        await #expect(throws: Boom.self) { try await first.value }
        await #expect(throws: Boom.self) { try await second.value }
        #expect(counter.value == 1)

        #expect(try await singleFlight.run("k") { counter.increment() } == 2)
    }
}
