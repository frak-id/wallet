import Foundation

// Set once from the shared task's defer, before any waiter's await resumes, so
// SingleFlight can tell "still running" from "finished but not evicted" without an actor hop.
private final class CompletionFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var value = false

    var isSet: Bool {
        lock.lock()
        defer { lock.unlock() }
        return value
    }

    func set() {
        lock.lock()
        value = true
        lock.unlock()
    }
}

// One waiter's continuation, resumed exactly once by whichever comes first: flight
// settling, or this waiter's cancellation. settle() may race ahead of attach(), so the
// first result parks in `pending` instead of being dropped.
private final class Waiter<Value: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<Value, any Error>?
    private var pending: Result<Value, any Error>?
    private var finished = false

    func attach(_ continuation: CheckedContinuation<Value, any Error>) {
        lock.lock()
        if finished {
            lock.unlock()
            return
        }
        if let pending {
            finished = true
            lock.unlock()
            continuation.resume(with: pending)
            return
        }
        self.continuation = continuation
        lock.unlock()
    }

    func settle(_ result: Result<Value, any Error>) {
        lock.lock()
        if finished {
            lock.unlock()
            return
        }
        guard let continuation else {
            pending = result
            lock.unlock()
            return
        }
        finished = true
        self.continuation = nil
        lock.unlock()
        continuation.resume(with: result)
    }
}

// Collapses concurrent calls for the same key into one execution.
//
// The work runs as an unstructured Task so one caller going away doesn't cancel other
// waiters' request, but that also means awaiting task.value directly is never resumed
// early by the awaiting task's own cancellation — it would make every public call
// effectively non-cancellable. So waiters instead register via Waiter/withTaskCancellationHandler
// and get resumed by whichever comes first: the flight settling, or their own cancellation.
//
// Eviction is identity-guarded (inFlight[key] === flight), never a bare `= nil`: a slow
// completion must not evict a newer flight under the same key. Reuse also requires
// !flight.isCompleted — without it a finished-but-not-evicted task could be served as a
// cached result to a forceRefresh caller (actor executors aren't FIFO, so reachable in practice).
actor SingleFlight<Value: Sendable> {
    private struct Flight {
        let task: Task<Value, any Error>
        let completion: CompletionFlag

        var isCompleted: Bool { completion.isSet }
    }

    private var inFlight: [String: Flight] = [:]

    func run(_ key: String, _ work: @escaping @Sendable () async throws -> Value) async throws -> Value {
        let task = flight(for: key, work).task
        let waiter = Waiter<Value>()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Value, any Error>) in
                waiter.attach(continuation)
                // Detached from the caller deliberately: this relay must survive the
                // caller's cancellation so the *other* waiters still get their result.
                Task {
                    do {
                        waiter.settle(.success(try await task.value))
                    } catch {
                        waiter.settle(.failure(error))
                    }
                }
            }
        } onCancel: {
            // Resumes this caller only. The shared task is untouched.
            waiter.settle(.failure(CancellationError()))
        }
    }

    private func flight(for key: String, _ work: @escaping @Sendable () async throws -> Value) -> Flight {
        if let existing = inFlight[key], !existing.isCompleted {
            return existing
        }

        let completion = CompletionFlag()
        let task = Task {
            defer { completion.set() }
            return try await work()
        }
        let flight = Flight(task: task, completion: completion)
        inFlight[key] = flight

        // Only bounds dictionary growth; CompletionFlag already stops the entry being reused.
        Task { await self.evict(key, ifIdentical: flight) }

        return flight
    }

    private func evict(_ key: String, ifIdentical flight: Flight) async {
        _ = try? await flight.task.value
        // Task has no identity; CompletionFlag (allocated once per flight) is the identity token.
        if inFlight[key]?.completion === flight.completion {
            inFlight[key] = nil
        }
    }
}
