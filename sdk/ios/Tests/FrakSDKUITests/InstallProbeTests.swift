#if canImport(UIKit)
    @_spi(FrakInternal) import FrakSDK
    import Foundation
    import Testing

    @testable import FrakSDKUI

    /// Type-checked against the iOS simulator SDK, executed by neither `swift test` stage:
    /// the host run has `canImport(UIKit)` false, so everything here compiles and runs nowhere.
    /// Exists so a wrong call order breaks the build,
    /// and so intended behaviour is pinned in one place if a future device pass runs this suite.
    @Suite("InstallProbe")
    @MainActor
    struct InstallProbeTests {
        @Test("start answers true and takes no session action when the scheme is declared")
        func startsWhenDeclared() async {
            let probe = InstallProbe(
                canOpenWallet: { false },
                walletSchemeStatus: { .ok },
                now: { 0 }
            )
            let started = await probe.start(sessionId: "s1") { _ in }
            #expect(started)
            probe.stop()
        }

        @Test("start answers false, and reports nothing, when the scheme is undeclared")
        func neverStartsWhenUndeclared() async {
            let probe = InstallProbe(
                canOpenWallet: { true },
                walletSchemeStatus: { .undeclared },
                now: { 0 }
            )
            let started = await probe.start(sessionId: "s1") { _ in Issue.record("must not detect") }
            #expect(!started)
        }

        @Test("stop is safe before any start")
        func stopIsSafeBeforeStart() {
            let probe = InstallProbe(
                canOpenWallet: { true },
                walletSchemeStatus: { .ok },
                now: { 0 }
            )
            probe.stop()
        }

        @Test("stop is safe called twice")
        func stopIsIdempotent() async {
            let probe = InstallProbe(
                canOpenWallet: { true },
                walletSchemeStatus: { .ok },
                now: { 0 }
            )
            _ = await probe.start(sessionId: "s1") { _ in }
            probe.stop()
            probe.stop()
        }
    }
#endif
