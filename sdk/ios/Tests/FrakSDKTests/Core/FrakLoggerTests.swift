import Foundation
import Testing

@testable import FrakSDK

private final class RecordingSink: FrakLogSink, @unchecked Sendable {
    private let lock = NSLock()
    private var captured: [(level: FrakLogLevel, message: String, hasError: Bool)] = []

    func log(level: FrakLogLevel, message: String, error: (any Error)?) {
        lock.lock()
        defer { lock.unlock() }
        captured.append((level, message, error != nil))
    }

    var received: [(level: FrakLogLevel, message: String, hasError: Bool)] {
        lock.lock()
        defer { lock.unlock() }
        return captured
    }
}

@Suite("FrakLogger")
struct FrakLoggerTests {
    @Test("a debug message is not built when the level is .none")
    func messageNotEvaluatedWhenLevelIsNone() {
        let logger = FrakLogger(level: .none)
        let evaluated = Counter()
        func message() -> String {
            evaluated.increment()
            return "message"
        }

        logger.debug(message())

        #expect(evaluated.value == 0)
    }

    @Test("an error's cause is not built when the level is .none")
    func errorNotEvaluatedWhenLevelIsNone() {
        let logger = FrakLogger(level: .none)
        let evaluated = Counter()
        struct Boom: Error {}
        func error() -> Boom {
            evaluated.increment()
            return Boom()
        }

        logger.error("message", error())

        #expect(evaluated.value == 0)
    }

    @Test("messages at or below logLevel reach the sink")
    func sinkReceivesMessagesAtOrBelowLevel() {
        let sink = RecordingSink()
        let logger = FrakLogger(level: .warn, sink: sink)

        logger.error("boom")
        logger.warn("careful")
        logger.info("fyi")
        logger.debug("verbose")

        #expect(sink.received.count == 2)
        #expect(sink.received[0].level == .error)
        #expect(sink.received[0].message == "boom")
        #expect(sink.received[1].level == .warn)
    }

    @Test("messages above logLevel do not reach the sink")
    func sinkDoesNotReceiveMessagesAboveLevel() {
        let sink = RecordingSink()
        let logger = FrakLogger(level: .error, sink: sink)

        logger.warn("careful")
        logger.info("fyi")
        logger.debug("verbose")

        #expect(sink.received.isEmpty)
    }

    @Test(".none delivers nothing to the sink")
    func noneDeliversNothingToSink() {
        let sink = RecordingSink()
        let logger = FrakLogger(level: .none, sink: sink)

        logger.error("boom")
        logger.warn("careful")
        logger.info("fyi")
        logger.debug("verbose")

        #expect(sink.received.isEmpty)
    }

    @Test("the sink receives the error parameter when the call site provided one")
    func sinkReceivesError() {
        let sink = RecordingSink()
        let logger = FrakLogger(level: .error, sink: sink)
        struct Boom: Error {}

        logger.error("boom", Boom())
        logger.warn("careful")

        #expect(sink.received.count == 1)
        #expect(sink.received[0].hasError)
    }

    @Test("without a sink, FrakLogger still gates by level without crashing")
    func noSinkFallsBackToOSLogger() {
        let logger = FrakLogger(level: .debug)

        logger.error("boom")
        logger.warn("careful")
        logger.info("fyi")
        logger.debug("verbose")
    }
}
