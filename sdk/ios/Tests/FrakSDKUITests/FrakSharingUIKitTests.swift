#if canImport(UIKit)
    import FrakSDK
    import Testing
    import UIKit

    @testable import FrakSDKUI

    /// What the UIKit entry point decides *without* a window, which no SwiftPM test here has.
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
    }
#endif
