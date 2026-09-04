import Foundation
import os

/// Tap-to-paint timings for one sheet, logged at `.debug` on subsystem `id.frak.sdk` and so
/// dropped unless that subsystem is turned up with `log config --mode "level:debug"`.
///
/// Not routed through `FrakLogger`, which is `internal` to `FrakSDK`. Android has no counterpart
/// to keep these strings in step with any more — `SharingTrace.kt` was dropped in `c863486df`.
struct SharingTrace {
    private let logger = Logger(subsystem: "id.frak.sdk", category: "FrakSharing")
    /// `Date`, not `DispatchTime`: the latter is `mach_absolute_time`, which is on Apple's
    /// required-reason list and would put an entry in this module's privacy manifest for a
    /// debug-only trace. A clock jump costs a wrong number in a log line.
    private let startedAt = Date()
    /// A class box because `mark` is called on a `let` trace passed around by value.
    private let previous = PreviousMark()

    func mark(_ event: String) {
        let now = Date()
        let sinceStart = Self.milliseconds(from: startedAt, to: now)
        let sincePrevious = Self.milliseconds(from: previous.exchange(now), to: now)
        logger.debug("\(event, privacy: .public) — \(sinceStart)ms since launch (+\(sincePrevious)ms)")
    }

    private static func milliseconds(from: Date, to: Date) -> Int {
        max(0, Int(to.timeIntervalSince(from) * 1000))
    }

    private final class PreviousMark: @unchecked Sendable {
        private let lock = NSLock()
        private var value = Date()

        /// Returns the mark this one replaces.
        func exchange(_ next: Date) -> Date {
            lock.lock()
            defer { lock.unlock() }
            let current = value
            value = next
            return current
        }
    }
}
