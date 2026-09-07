import Foundation

/// Races `operation` against a fixed wall-clock deadline, so a multi-attempt caller can
/// wrap the whole sequence in one bound instead of giving each attempt its own window.
enum Deadline {
    /// `operation` did not finish before the deadline. Distinct from `CancellationError`
    /// so a genuine outer cancellation is never mistaken for a timeout.
    struct Exceeded: Error {}

    static func run<T: Sendable>(
        seconds: TimeInterval,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw Exceeded()
            }
            defer { group.cancelAll() }
            guard let result = try await group.next() else {
                throw Exceeded()
            }
            return result
        }
    }
}
