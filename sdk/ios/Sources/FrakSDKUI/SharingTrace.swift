import Foundation
import os

/// Tap-to-paint timings for one sheet, logged at `.debug` on subsystem `id.frak.sdk` and so
/// dropped unless that subsystem is turned up with `log config --mode "level:debug"`.
///
/// Not routed through `FrakLogger`, which is `internal` to `FrakSDK`. Android has no counterpart
/// to keep these strings in step with any more — `SharingTrace.kt` was dropped in `c863486df`.
struct SharingTrace {
    private let logger = Logger(subsystem: "id.frak.sdk", category: "FrakSharing")
    private let startedAt = DispatchTime.now()
    /// A class box because `mark` is called on a `let` trace passed around by value.
    private let previous = PreviousMark()

    func mark(_ event: String) {
        let now = DispatchTime.now()
        let sinceStart = Self.milliseconds(from: startedAt, to: now)
        let sincePrevious = Self.milliseconds(from: previous.exchange(now), to: now)
        logger.debug("\(event, privacy: .public) — \(sinceStart)ms since launch (+\(sincePrevious)ms)")
    }

    private static func milliseconds(from: DispatchTime, to: DispatchTime) -> UInt64 {
        (to.uptimeNanoseconds &- from.uptimeNanoseconds) / 1_000_000
    }

    private final class PreviousMark: @unchecked Sendable {
        private let lock = NSLock()
        private var value = DispatchTime.now()

        /// Returns the mark this one replaces.
        func exchange(_ next: DispatchTime) -> DispatchTime {
            lock.lock()
            defer { lock.unlock() }
            let current = value
            value = next
            return current
        }
    }
}
