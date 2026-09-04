import Foundation
import Testing

@testable import FrakSDKUI

@Suite("InstallProbeSchedule")
struct InstallProbeScheduleTests {
    @Test(
        "the interval steps at the documented knees, exactly",
        arguments: [
            (0.0, 1.0),
            (29.9, 1.0),
            (30.0, 2.0),
            (119.9, 2.0),
            (120.0, 5.0),
            (600.0, 5.0),
        ]
    )
    func stepsAtTheKnees(elapsed: TimeInterval, expected: TimeInterval) {
        #expect(InstallProbeSchedule.interval(elapsed: elapsed) == expected)
    }
}
