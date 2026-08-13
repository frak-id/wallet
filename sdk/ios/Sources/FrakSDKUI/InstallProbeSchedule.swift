import Foundation

/// The post-install poll's cadence: tight while an install is plausibly still downloading, wide
/// once it has had a real chance to finish. No ceiling — `InstallProbe.stop()` is the bound.
enum InstallProbeSchedule {
    static func interval(elapsed: TimeInterval) -> TimeInterval {
        if elapsed < 30 { return 1 }
        if elapsed < 120 { return 2 }
        return 5
    }
}
