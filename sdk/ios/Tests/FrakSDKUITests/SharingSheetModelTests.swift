#if canImport(UIKit)
    @_spi(FrakInternal) import FrakSDK
    import Foundation
    import Testing

    @testable import FrakSDKUI

    // Serialized: every test initializes and shuts down the one `Frak` singleton.
    @Suite("SharingSheetModel", .serialized)
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
            var closed = false
        }

        private final class FakeEngine: SharingEngine {
            var navigations: [SharingNavigation] = []
            func navigate(_ navigation: SharingNavigation) { navigations.append(navigation) }
        }

        private static func warmBaseURL() -> String {
            SharingPageURL.warm(
                walletOrigin: FrakEnvironment.production.wallet,
                merchantId: config.merchantId,
                clientId: clientId,
                bundleId: Bundle.main.bundleIdentifier ?? "",
                appName: config.displayName,
                logoURL: config.displayLogoURL
            )
        }

        /// A started model on a fake engine, counting recoveries. Nil `activationBaseURL` is a full load.
        private static func started(
            activationBaseURL: String? = nil,
            warmDocumentReadyAt: Date? = nil,
            loadBudget: TimeInterval,
            bootBudget: TimeInterval
        ) async -> (SharingSheetModel, FakeEngine, Calls) {
            Frak.initialize(FrakConfig(merchantId: config.merchantId))
            let model = SharingSheetModel(
                sessionId: "s1",
                activationBaseURL: activationBaseURL,
                warmDocumentReadyAt: warmDocumentReadyAt,
                detectInstall: false,
                buildSharingLink: { _ in "https://acme.example/r" },
                anonymousId: { clientId },
                environment: { .production },
                resolveConfig: { config },
                bestReward: { _, _ in nil },
                track: { _ in .success(()) },
                metadataName: { nil },
                metadataLang: { nil },
                loadBudget: loadBudget,
                bootBudget: bootBudget
            )
            let calls = Calls()
            model.onRebuildEngine = {
                calls.rebuilds += 1
                return nil
            }
            model.onClose = { calls.closed = true }
            let engine = FakeEngine()
            model.attach(engine)
            await model.start(SharingRequest())
            return (model, engine, calls)
        }

        private static func wait(seconds: TimeInterval, until done: () -> Bool = { false }) async throws {
            let limit = Date().addingTimeInterval(seconds)
            while !done(), Date() < limit {
                try await Task.sleep(nanoseconds: 50_000_000)
            }
        }

        private static func stop(_ model: SharingSheetModel) async {
            model.release()
            await Frak.shutdown()
        }

        @Test("an activation that never reports ready is recovered on the activation watchdog")
        func silentActivationRecovers() async throws {
            // Far past any wait below: only the activation watchdog can trigger the recovery.
            let (model, engine, calls) = await Self.started(
                activationBaseURL: Self.warmBaseURL(),
                loadBudget: 600,
                bootBudget: sharingPageBootBudget
            )
            try await Self.wait(seconds: 30) { calls.rebuilds > 0 }
            await Self.stop(model)

            guard case .activate = engine.navigations.first else {
                Issue.record("expected the session to activate on the warm document, got \(engine.navigations)")
                return
            }
            #expect(calls.rebuilds == 1)
            // The recovery is a full load, not another activation on the silent document.
            #expect(engine.navigations.count == 2)
            if case .activate = engine.navigations.last { Issue.record("recovery activated again") }
        }

        @Test("a full load that finishes inside its budget is not recovered while the page boots")
        func finishedLoadKeepsItsBootBudget() async throws {
            let (model, engine, calls) = await Self.started(loadBudget: 1, bootBudget: 600)
            try await Self.wait(seconds: 10) { !engine.navigations.isEmpty }
            model.onDocumentFinished()
            // Past the load budget: only the boot budget, timed from `didFinish`, may still be running.
            try await Self.wait(seconds: 2)
            model.onPageAction(.ready)
            try await Self.wait(seconds: 0.5)
            await Self.stop(model)

            #expect(calls.rebuilds == 0)
            #expect(engine.navigations.count == 1)
        }

        @Test("a finished page that never reports ready is recovered when its boot budget runs out")
        func silentFinishedLoadRecovers() async throws {
            let (model, engine, calls) = await Self.started(loadBudget: 600, bootBudget: 0.5)
            try await Self.wait(seconds: 10) { !engine.navigations.isEmpty }
            model.onDocumentFinished()
            try await Self.wait(seconds: 10) { calls.rebuilds > 0 }
            await Self.stop(model)

            #expect(calls.rebuilds == 1)
        }

        @Test("a page that arrives after the fallback stays covered under the system share sheet")
        func lateFallbackPageStaysCovered() async throws {
            let (model, engine, calls) = await Self.started(loadBudget: 0.2, bootBudget: 0.2)
            try await Self.wait(seconds: 10) { !engine.navigations.isEmpty }
            // Finished but silent, and uncovered by the skeleton grace, as on a slow page.
            model.onDocumentFinished()
            model.onPageVisible()
            // Silent again after the recovery: the share falls back. No window, so the chooser
            // cannot present and the sheet closes straight after.
            try await Self.wait(seconds: 10) { calls.closed }
            let coveredAtFallback = !model.pageVisible
            // The recovery's engine finishes and its page reports, too late.
            model.onDocumentFinished()
            model.onPageAction(.ready)
            let coveredAfterLatePage = !model.pageVisible
            await Self.stop(model)

            #expect(calls.rebuilds == 1)
            #expect(calls.closed)
            #expect(coveredAtFallback)
            #expect(coveredAfterLatePage)
        }

        @Test("an activation on a document that just finished gets the rest of its boot budget")
        func youngWarmDocumentKeepsItsBootBudget() async throws {
            let (model, engine, calls) = await Self.started(
                activationBaseURL: Self.warmBaseURL(),
                warmDocumentReadyAt: Date(),
                loadBudget: 600,
                bootBudget: 600
            )
            // Past the fast-path second an already-booted document would get.
            try await Self.wait(seconds: 2)
            await Self.stop(model)

            guard case .activate = engine.navigations.first else {
                Issue.record("expected the session to activate on the warm document, got \(engine.navigations)")
                return
            }
            #expect(calls.rebuilds == 0)
        }
    }
#endif
