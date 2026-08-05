import Foundation
import os

/// Tap-to-paint timings for one sheet.
///
/// Costs a level check per milestone and nothing else, so it ships enabled-able rather than
/// stripped: the numbers that matter can only be taken on a real device against the real
/// wallet. `.debug` is dropped by the unified logging system unless the subsystem is turned
/// up, which is this platform's equivalent of Android's `setprop log.tag.FrakSharing DEBUG`:
///
/// ```
/// xcrun simctl spawn booted log config --mode "level:debug" --subsystem id.frak.sdk
/// xcrun simctl spawn booted log stream --predicate 'subsystem == "id.frak.sdk"'
/// ```
///
/// Deliberately not routed through `FrakLogger`: it is `internal` to the `FrakSDK` module, so
/// `FrakSDKUI` cannot reach it without widening the published API for a diagnostic. Mirrors
/// `SharingTrace.kt` on Android; the milestone strings are deliberately identical so one set
/// of eyes can read both platforms' traces.
struct SharingTrace {
    private let logger = Logger(subsystem: "id.frak.sdk", category: "FrakSharing")
    private let startedAt = DispatchTime.now()
    /// A class box because `mark` is called on a `let` trace passed around by value, and the
    /// inter-milestone delta is the number that actually locates a stall.
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
