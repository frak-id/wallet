#if canImport(UIKit)
    import FrakSDK
    import Testing
    import UIKit

    @testable import FrakSDKUI

    /// What the UIKit entry point decides *without* a window, which no SwiftPM test here has.
    ///
    /// Compiled at the simulator triple by `run.sh` stage 1 and executed nowhere: stage 2 runs on
    /// the host, where `canImport(UIKit)` is false. Same standing as `InstallProbeTests`.
    @Suite("FrakSharing (UIKit)")
    struct FrakSharingUIKitTests {
        @Test("presenting from a controller with no window reports nothing")
        func presentWithoutWindowIsInert() async {
            await MainActor.run {
                var results: [SharingResult] = []
                let host = UIViewController()
                let sharing = FrakSharing(presentingFrom: host) { results.append($0) }

                sharing.present(SharingRequest())

                // `.dismissed` here would be a report for a session that never started.
                #expect(results.isEmpty)
            }
        }

        @Test("the host view controller is not retained by the sheet")
        func hostIsHeldWeakly() async {
            await MainActor.run {
                var host: UIViewController? = UIViewController()
                weak let weakHost = host
                let sharing = FrakSharing(presentingFrom: host!)

                host = nil

                #expect(weakHost == nil)
                // Kept alive to the end of the test, so the release above is the host's, not the
                // sheet's whole graph going away at once.
                _ = sharing
            }
        }

        @Test("warming without an initialized SDK is a no-op rather than a crash")
        func warmBeforeInitializeIsSafe() async {
            await MainActor.run {
                let host = UIViewController()
                let sharing = FrakSharing(presentingFrom: host)

                sharing.warm()

                #expect(Bool(true))
            }
        }
    }
#endif
