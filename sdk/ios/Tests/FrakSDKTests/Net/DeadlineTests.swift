import Foundation
import Testing

@testable import FrakSDK

@Suite("Deadline")
struct DeadlineTests {
    @Test("an operation finishing before the deadline returns its result")
    func operationFinishingInTimeReturnsResult() async throws {
        let result = try await Deadline.run(seconds: 5) { 42 }
        #expect(result == 42)
    }

    @Test("a slow operation is bounded by the deadline, not left to run to completion")
    func slowOperationIsBoundedByDeadline() async throws {
        let start = Date()

        await #expect(throws: Deadline.Exceeded.self) {
            try await Deadline.run(seconds: 0.1) {
                try await Task.sleep(nanoseconds: 5_000_000_000)
            }
        }

        let elapsed = Date().timeIntervalSince(start)
        #expect(elapsed < 1)
    }

    @Test("cancelling the caller surfaces CancellationError, not Deadline.Exceeded")
    func cancellationIsNotConvertedToTimeout() async throws {
        let task = Task {
            try await Deadline.run(seconds: 5) {
                try await Task.sleep(nanoseconds: 5_000_000_000)
            }
        }
        try await Task.sleep(nanoseconds: 50_000_000)
        task.cancel()

        await #expect(throws: CancellationError.self) {
            _ = try await task.value
        }
    }
}
