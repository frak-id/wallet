#if canImport(UIKit)
    @_spi(FrakInternal) import FrakSDK
    import Foundation
    import Testing

    @testable import FrakSDKUI

    @Suite("SharingSheetModel")
    @MainActor
    struct SharingSheetModelTests {
        private nonisolated static let clientId = "c1"
        private nonisolated static let config = FrakResolvedConfig(
            merchantId: "m1",
            name: "Acme",
            domain: "acme.example"
        )

        private final class Calls {
            var rebuilds = 0
        }

        private final class FakeEngine: SharingEngine {
            var navigations: [SharingNavigation] = []
            func navigate(_ navigation: SharingNavigation) { navigations.append(navigation) }
        }

        @Test("an activation that never reports ready is recovered on the activation watchdog")
        func silentActivationRecovers() async throws {
            Frak.initialize(FrakConfig(merchantId: Self.config.merchantId))
            let environment = FrakEnvironment.production
            let warmBaseURL = SharingPageURL.warm(
                walletOrigin: environment.wallet,
                merchantId: Self.config.merchantId,
                clientId: Self.clientId,
                bundleId: Bundle.main.bundleIdentifier ?? "",
                appName: Self.config.displayName,
                logoURL: Self.config.displayLogoURL
            )
            // Far past any wait below: only the activation watchdog can trigger the recovery.
            let model = SharingSheetModel(
                sessionId: "s1",
                activationBaseURL: warmBaseURL,
                detectInstall: false,
                buildSharingLink: { _ in "https://acme.example/r" },
                anonymousId: { Self.clientId },
                environment: { environment },
                resolveConfig: { Self.config },
                bestReward: { _, _ in nil },
                track: { _ in .success(()) },
                metadataName: { nil },
                metadataLang: { nil },
                loadBudget: 600
            )
            let calls = Calls()
            model.onRebuildEngine = {
                calls.rebuilds += 1
                return nil
            }
            let engine = FakeEngine()
            model.attach(engine)

            await model.start(SharingRequest())
            let limit = Date().addingTimeInterval(30)
            while calls.rebuilds == 0, Date() < limit {
                try await Task.sleep(nanoseconds: 50_000_000)
            }
            model.release()
            await Frak.shutdown()

            guard case .activate = engine.navigations.first else {
                Issue.record("expected the session to activate on the warm document, got \(engine.navigations)")
                return
            }
            #expect(calls.rebuilds == 1)
            // The recovery is a full load, not another activation on the silent document.
            #expect(engine.navigations.count == 2)
            if case .activate = engine.navigations.last { Issue.record("recovery activated again") }
        }
    }
#endif
