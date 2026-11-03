import Foundation

/// The backend's clock, learned from the `Date` header of any response, for stamping identity
/// proofs. The backend rejects a proof more than 60 s in its future, so an unsynchronised device
/// clock invalidates every signature it makes.
final class ServerClock: @unchecked Sendable {
    /// Half the tightest server window, so a warning fires well before signatures start failing.
    private static let driftWarnSeconds: TimeInterval = 30
    /// 2025-01-01 and 2100-01-01: outside this, a `Date` is a broken header, not a clock to adopt.
    private static let earliestPlausible = Date(timeIntervalSince1970: 1_735_689_600)
    private static let latestPlausible = Date(timeIntervalSince1970: 4_102_444_800)

    private let wallClock: @Sendable () -> Date
    private let logger: FrakLogger?
    private let lock = NSLock()
    private var offset: TimeInterval = 0
    private var warned = false

    init(now: @escaping @Sendable () -> Date = Date.init, logger: FrakLogger? = nil) {
        self.wallClock = now
        self.logger = logger
    }

    func now() -> Date {
        lock.lock()
        defer { lock.unlock() }
        return wallClock().addingTimeInterval(offset)
    }

    func nowSeconds() -> Int64 {
        Int64(now().timeIntervalSince1970)
    }

    /// A garbage `Date` would skew every proof this device signs, so only one that could
    /// plausibly be now is trusted. The origin is ours over TLS; this guards a broken proxy.
    func observe(_ serverDate: Date?) {
        guard let serverDate, serverDate >= Self.earliestPlausible, serverDate <= Self.latestPlausible else {
            return
        }
        lock.lock()
        let newOffset = serverDate.timeIntervalSince(wallClock())
        offset = newOffset
        let shouldWarn = abs(newOffset) >= Self.driftWarnSeconds && !warned
        if shouldWarn { warned = true }
        lock.unlock()

        if shouldWarn {
            logger?.warn(
                "This device's clock is \(Int(newOffset))s from the server's. "
                    + "Proof timestamps are corrected, but check the device's date settings."
            )
        }
    }
}
