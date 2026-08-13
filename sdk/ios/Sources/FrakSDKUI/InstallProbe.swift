#if canImport(UIKit)
    @_spi(FrakInternal) import FrakSDK
    import Foundation
    import UIKit

    /// Notices the wallet becoming installable while a store surface is up, so the sheet can hand
    /// off deterministically instead of falling back to the install code.
    ///
    /// Owned by `SharingSheetModel`, not by `StoreInvite` — see
    /// `docs/plans/native-sdk/03-sharing-and-install.md` for why bracketing the invite is wrong.
    @MainActor
    final class InstallProbe {
        /// Injected so detection order is host-testable with a fake, reusing the same seam
        /// `AppLauncher` already provides for `DefaultFrakClient`.
        private let canOpenWallet: @Sendable () async -> Bool
        private let walletSchemeStatus: @Sendable () async -> ProbeStatus
        private let now: @Sendable () -> TimeInterval

        private var generation = 0
        private var sessionId: String?
        private var startedAt: TimeInterval?
        private var poll: Task<Void, Never>?
        private var foregroundObserver: NSObjectProtocol?
        private var onDetected: ((TimeInterval) -> Void)?

        init(
            canOpenWallet: @escaping @Sendable () async -> Bool = {
                await (try? Frak.client)?.appLink.isFrakAppInstalled() ?? false
            },
            walletSchemeStatus: @escaping @Sendable () async -> ProbeStatus = {
                await (try? Frak.client)?.appLink.walletSchemeStatus() ?? .undeclared
            },
            now: @escaping @Sendable () -> TimeInterval = { Date().timeIntervalSinceReferenceDate }
        ) {
            self.canOpenWallet = canOpenWallet
            self.walletSchemeStatus = walletSchemeStatus
            self.now = now
        }

        /// Answers false, and starts nothing, when the wallet's scheme cannot be probed at all —
        /// `walletSchemeStatus` already warns once through `FrakLogger` in that case.
        ///
        /// `generation` closes the gap around the `await`: a second `start` landing inside it would
        /// otherwise have its poll and observer overwritten by the first one resuming, leaving both
        /// unreachable by `stop()`.
        @discardableResult
        func start(sessionId: String, onDetected: @escaping (TimeInterval) -> Void) async -> Bool {
            stop()
            generation &+= 1
            let generation = generation
            guard await walletSchemeStatus() == .ok, generation == self.generation else { return false }
            self.sessionId = sessionId
            self.onDetected = onDetected
            let startedAt = now()
            self.startedAt = startedAt
            scheduleForeground(sessionId: sessionId)
            scheduleNextPoll(sessionId: sessionId, startedAt: startedAt)
            return true
        }

        func stop() {
            poll?.cancel()
            poll = nil
            if let foregroundObserver {
                NotificationCenter.default.removeObserver(foregroundObserver)
            }
            foregroundObserver = nil
            sessionId = nil
            startedAt = nil
            onDetected = nil
        }

        private func scheduleForeground(sessionId: String) {
            foregroundObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.willEnterForegroundNotification,
                object: nil,
                queue: nil
            ) { [weak self] _ in
                Task { @MainActor in self?.check(sessionId: sessionId) }
            }
        }

        private func scheduleNextPoll(sessionId: String, startedAt: TimeInterval) {
            let delay = InstallProbeSchedule.interval(elapsed: now() - startedAt)
            poll = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard !Task.isCancelled else { return }
                self?.check(sessionId: sessionId)
            }
        }

        /// A stale poll or a foreground notification from a session this probe has since moved
        /// past — a rebind on the pooled view — reports nothing and reschedules nothing.
        private func check(sessionId: String) {
            guard self.sessionId == sessionId, let startedAt else { return }
            Task { [weak self] in
                guard let self else { return }
                guard await canOpenWallet() else {
                    guard self.sessionId == sessionId else { return }
                    scheduleNextPoll(sessionId: sessionId, startedAt: startedAt)
                    return
                }
                guard self.sessionId == sessionId else { return }
                let elapsedMillis = (now() - startedAt) * 1000
                onDetected?(elapsedMillis)
                stop()
            }
        }
    }
#endif
