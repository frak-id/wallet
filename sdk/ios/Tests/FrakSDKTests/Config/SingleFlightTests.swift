import Foundation
import Testing

@testable import FrakSDK

@Suite("SingleFlight")
struct SingleFlightTests {
    // The work sleeps so the three callers genuinely overlap. It used to be an
    // instantaneous `counter.increment()`, which meant the flight had already finished
    // before the second and third callers arrived — they "shared" it only because a
    // *completed* task was still sitting in the map, joinable. That is the defect that
    // let `ConfigStore.resolve(_:forceRefresh: true)` skip the network, so the sharing
    // this test exists to prove has to be demonstrated on a flight that is actually
    // still in the air.
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

    // The pre-existing cancellation test above never awaited `cancelled.value`, so it
    // asserted nothing about what the cancelled caller actually saw. It saw the result,
    // 200ms late: `await task.value` is not resumed early by the awaiter's cancellation,
    // which made every SDK call through this class non-cancellable.
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

        // Promptly: not parked for the remaining ~400ms of the shared work.
        #expect(Date().timeIntervalSince(start) < 0.2)

        // And the survivor still gets the shared result, from the same single execution.
        #expect(try await waiter.value == 1)
        #expect(counter.value == 1)
    }

    // The leader's cancellation used to run `defer { inFlight[key] = nil }` while its
    // unstructured Task was still running, so the next caller started a duplicate.
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

    // A finished-but-not-yet-evicted task used to stay joinable, so a caller landing in
    // that window was served the completed result with no execution of its own. That is
    // what made `ConfigStore.resolve(_:forceRefresh: true)` silently skip the network.
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

        // `Task`, not `async let`: an `async let` variable cannot be captured by
        // `#expect(throws:)`'s closure.
        let first = Task { try await singleFlight.run("k", work) }
        let second = Task { try await singleFlight.run("k", work) }

        await #expect(throws: Boom.self) { try await first.value }
        await #expect(throws: Boom.self) { try await second.value }
        #expect(counter.value == 1)

        // A failure must not be replayed to the next caller.
        #expect(try await singleFlight.run("k") { counter.increment() } == 2)
    }
}
