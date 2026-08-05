import os

// Merchant-side sink for SDK diagnostics, gated by FrakConfig.logLevel (".none" never
// reaches it). Contract, uncompiler-enforced:
// - called synchronously, on whatever thread/actor produced the line (e.g. from inside
//   an actor-isolated ConfigStore/RewardRepository) — a slow sink serialises SDK work.
// - may be called concurrently from multiple threads (hence Sendable).
// - calling back into Frak.client/isInitialized/initialize from a sink is not a deadlock
//   (initialize's lock is released before any logging), but a reentrant log recurses unbounded.
// - an uncaught trap inside it brings down the host process.
public protocol FrakLogSink: Sendable {
    func log(level: FrakLogLevel, message: String, error: (any Error)?)
}

// Routes to FrakConfig.logSink if set, else os.Logger. Silent by default.
struct FrakLogger: Sendable {
    private let level: FrakLogLevel
    private let sink: (any FrakLogSink)?
    private let logger = Logger(subsystem: "id.frak.sdk", category: "Frak")

    init(level: FrakLogLevel, sink: (any FrakLogSink)? = nil) {
        self.level = level
        self.sink = sink
    }

    func error(_ message: @autoclosure () -> String, _ error: @autoclosure () -> (any Error)? = nil) {
        log(at: .error, message, error)
    }

    func warn(_ message: @autoclosure () -> String, _ error: @autoclosure () -> (any Error)? = nil) {
        log(at: .warn, message, error)
    }

    func info(_ message: @autoclosure () -> String) {
        log(at: .info, message, { nil })
    }

    func debug(_ message: @autoclosure () -> String) {
        log(at: .debug, message, { nil })
    }

    private func log(
        at messageLevel: FrakLogLevel,
        _ message: () -> String,
        _ error: () -> (any Error)?
    ) {
        guard level >= messageLevel, messageLevel != .none else { return }
        let message = message()
        let resolvedError = error()

        if let sink {
            sink.log(level: messageLevel, message: message, error: resolvedError)
            return
        }

        // .private: message is a caller-formatted string that can carry identifiers (e.g. the
        // anonymous id, a declared Linked DeviceID in the privacy manifest) — os.Logger has no
        // way to redact part of an already-assembled String, so the whole line is redacted
        // rather than widening the merchant's privacy envelope. A merchant-supplied FrakLogSink
        // (above) is unaffected and still receives the raw message.
        let suffix = resolvedError.map { ": \($0.localizedDescription)" } ?? ""
        switch messageLevel {
        case .error:
            logger.error("\(message, privacy: .private)\(suffix, privacy: .private)")
        case .warn:
            logger.warning("\(message, privacy: .private)\(suffix, privacy: .private)")
        case .info:
            logger.info("\(message, privacy: .private)")
        case .debug:
            logger.debug("\(message, privacy: .private)")
        case .none:
            break
        }
    }
}
