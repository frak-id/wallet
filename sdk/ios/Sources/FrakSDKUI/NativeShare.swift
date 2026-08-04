#if canImport(UIKit)
    import Foundation
    import UIKit
    import UniformTypeIdentifiers

    /// The OS share sheet and the pasteboard — the two things the hosted page cannot do itself.
    @MainActor
    enum NativeShare {
        /// Presents the system share sheet and resolves once the user has finished with it.
        ///
        /// - Returns: whether the user actually completed a share. False also covers "nothing
        ///   could present it", which must not be reported as a share either.
        static func share(link: String, title: String?) async -> Bool {
            guard let presenter = topViewController() else { return false }

            let controller = UIActivityViewController(
                activityItems: [SharedLink(link: link, title: title)],
                applicationActivities: nil
            )
            // Required on iPad: an unanchored popover traps instead of presenting.
            if let popover = controller.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(
                    origin: CGPoint(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY),
                    size: .zero
                )
                popover.permittedArrowDirections = []
            }

            let latch = ResumeLatch()
            return await withCheckedContinuation { continuation in
                controller.completionWithItemsHandler = { _, completed, _, _ in
                    guard latch.claim() else { return }
                    continuation.resume(returning: completed)
                }
                presenter.present(controller, animated: true)
                // A refused presentation — the presenter is already presenting, or is being
                // dismissed, or its view left the window — is reported only to the console. The
                // completion handler never fires, so without this the continuation would never
                // resume and the sheet would sit on its spinner with no way out but a swipe.
                //
                // Asked after the fact rather than before: the conditions UIKit actually refuses
                // on are not all knowable up front, and guessing at them pre-emptively rejects
                // presentations it would have accepted — a presenter still animating IN is fine,
                // which is exactly the state tier 3 fires in. `present` establishes
                // `presentingViewController` when it accepts, so nil here is a refusal and not a
                // slow start. A wall-clock timeout could not do this job: a share sheet is
                // legitimately open for as long as the user takes to write the message.
                //
                // Narrows the hang rather than closing it — a presentation accepted and then torn
                // down before the handler fires still leaks. That needs a device to reproduce.
                if controller.presentingViewController == nil, latch.claim() {
                    continuation.resume(returning: false)
                }
            }
        }

        /// iOS shows its own banner when an app *reads* the pasteboard, never when it writes, so
        /// the user needs telling some other way — which the page does, alongside the button that
        /// asked for this. The sheet has no confirmation of its own any more.
        static func copy(_ link: String) {
            UIPasteboard.general.string = link
        }

        /// Puts the install code where the wallet's six-character field will offer it.
        ///
        /// `localOnly` is not optional: without it Universal Clipboard syncs the code to the
        /// user's Mac and iPad. `expirationDate` keeps it from outliving the code itself, which
        /// the backend gives 72 hours.
        ///
        /// A short code is also why this is worth doing at all — iOS surfaces one in the
        /// QuickType bar, and the user tapping that suggestion *is* the consent, with no
        /// permission prompt. Reading a URL back would need a programmatic pasteboard read on
        /// launch, which does prompt.
        static func copyInstallCode(_ code: String, expiresAt: Date?) {
            var options: [UIPasteboard.OptionsKey: Any] = [.localOnly: true]
            if let expiresAt { options[.expirationDate] = expiresAt }
            UIPasteboard.general.setItems([[UTType.utf8PlainText.identifier: code]], options: options)
        }

        /// The view controller anything the SDK presents has to come from. Walks past whatever
        /// the host — or the sharing sheet itself — already has up.
        private static func topViewController() -> UIViewController? {
            let scene =
                UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
            guard var top = scene?.keyWindow?.rootViewController else { return nil }
            while let presented = top.presentedViewController {
                top = presented
            }
            return top
        }
    }

    /// One-shot claim on a continuation.
    ///
    /// `completionWithItemsHandler` is documented as fired once, and some share extensions fire
    /// it twice anyway. A `CheckedContinuation` resumed twice is a hard crash, not a warning, so
    /// the second call has to be dropped. Locked rather than relying on main-thread delivery:
    /// the crash it prevents is unrecoverable, and the extension calling back is not our code.
    private final class ResumeLatch: @unchecked Sendable {
        private let lock = NSLock()
        private var claimed = false

        func claim() -> Bool {
            lock.lock()
            defer { lock.unlock() }
            if claimed { return false }
            claimed = true
            return true
        }
    }

    /// Carries the link plus the merchant's name as the mail/message subject.
    ///
    /// A `UIActivityItemSource` rather than the `setValue(_:forKey:"subject")` trick, which
    /// is undocumented KVC on a class that does not declare the property.
    private final class SharedLink: NSObject, UIActivityItemSource {
        private let item: Any
        private let title: String?

        init(link: String, title: String?) {
            // A `URL` where the string parses, so activities that understand links — Messages,
            // the reading list — get one instead of plain text.
            self.item = URL(string: link) ?? link
            self.title = title
        }

        func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any {
            item
        }

        func activityViewController(
            _ controller: UIActivityViewController,
            itemForActivityType activityType: UIActivity.ActivityType?
        ) -> Any? {
            item
        }

        func activityViewController(
            _ controller: UIActivityViewController,
            subjectForActivityType activityType: UIActivity.ActivityType?
        ) -> String {
            title ?? ""
        }
    }
#endif
