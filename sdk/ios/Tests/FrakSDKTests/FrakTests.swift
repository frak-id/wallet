import Foundation
import Testing

@testable import FrakSDK

/// A hand-written fake, the way a merchant would write one — no mocking framework.
private final class RecordingLogSink: FrakLogSink, @unchecked Sendable {
    private let lock = NSLock()
    private var captured: [(level: FrakLogLevel, message: String, hasError: Bool)] = []

    func log(level: FrakLogLevel, message: String, error: (any Error)?) {
        lock.lock()
        defer { lock.unlock() }
        captured.append((level, message, error != nil))
    }

    var all: [(level: FrakLogLevel, message: String, hasError: Bool)] {
        lock.lock()
        defer { lock.unlock() }
        return captured
    }
}

/// `Frak` is process-global static state guarded by one lock, so these tests cannot run
/// concurrently with each other without corrupting one another's view of `instance`.
@Suite("Frak", .serialized)
struct FrakTests {
    @Test("initialize routes its own log lines to a configured sink end to end")
    func initializeRoutesLogLinesToSink() {
        Frak.resetForTesting()
        defer { Frak.resetForTesting() }

        let sink = RecordingLogSink()
        Frak.initialize(FrakConfig(merchantId: "m1", logLevel: .info, logSink: sink))

        #expect(sink.all.contains { $0.message == "Frak \(FrakSDKVersion.current) initialized." })
    }

    @Test("a second initialize call is a no-op and warns instead of replacing the client")
    func secondInitializeIsANoOp() throws {
        Frak.resetForTesting()
        defer { Frak.resetForTesting() }

        let sink = RecordingLogSink()
        Frak.initialize(FrakConfig(merchantId: "m1", logLevel: .warn, logSink: sink))
        Frak.initialize(FrakConfig(merchantId: "m2", logLevel: .warn, logSink: sink))

        #expect(
            sink.all.contains {
                $0.level == .warn && $0.message.contains("more than once")
            }
        )
    }

    @Test("isInitialized reflects whether initialize has run")
    func isInitializedReflectsState() {
        Frak.resetForTesting()
        defer { Frak.resetForTesting() }

        #expect(!Frak.isInitialized)
        Frak.initialize(FrakConfig(merchantId: "m1"))
        #expect(Frak.isInitialized)
    }

    @Test("client throws notInitialized before initialize has run")
    func clientThrowsBeforeInitialize() {
        Frak.resetForTesting()
        defer { Frak.resetForTesting() }

        #expect(throws: FrakError.self) {
            _ = try Frak.client
        }
    }
}
