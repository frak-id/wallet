#if canImport(UIKit)
    import Foundation
    import UIKit
    import UniformTypeIdentifiers

    /// The OS share sheet and the pasteboard — the two things the hosted page cannot do itself.
    @MainActor
    enum NativeShare {
        /// Presents the system share sheet and resolves once the user has finished with it.
        /// - Returns: whether the user shared — see `sharingChooserCompleted` for what counts.
        ///   False also covers "nothing could present it".
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

            // Asked before presenting, never after. This used to read
            // `controller.presentingViewController` on the same turn as the `present` call and
            // treat nil as "refused" — but UIKit does not promise to have wired that up by then,
            // and when it had not, this call resolved false while the chooser went on to appear.
            // The user shared, and the sheet stayed on its share screen with nothing recorded.
            //
            // These two are what a refusal actually looks like, and both are settled facts at
            // this point: `topViewController()` walks to the deepest presented controller, so
            // anything already presenting here is a race, and a controller out of the window
            // hierarchy cannot present at all.
            guard presenter.presentedViewController == nil, presenter.viewIfLoaded?.window != nil
            else { return false }

            let latch = ResumeLatch()
            return await withCheckedContinuation { continuation in
                controller.completionWithItemsHandler = { activityType, completed, _, error in
                    guard latch.claim() else { return }
                    continuation.resume(
                        returning: sharingChooserCompleted(
                            activityType: activityType?.rawValue,
                            completed: completed,
                            failed: error != nil
                        )
                    )
                }
                presenter.present(controller, animated: true)
            }
        }

        /// iOS shows its own banner only when an app reads the pasteboard, not when it writes,
        /// so the page's own UI has to tell the user the copy happened.
        static func copy(_ link: String) {
            UIPasteboard.general.string = link
        }

        /// Puts the install code where the wallet's six-character field will offer it.
        ///
        /// `localOnly` prevents Universal Clipboard syncing the code to the user's other
        /// devices. `expirationDate` matches the backend's 72-hour code lifetime. A short code
        /// surfaces in the QuickType bar with no permission prompt; reading a URL back would
        /// need a programmatic pasteboard read, which does prompt.
        static func copyInstallCode(_ code: String, expiresAt: Date?) {
            var options: [UIPasteboard.OptionsKey: Any] = [.localOnly: true]
            if let expiresAt { options[.expirationDate] = expiresAt }
            UIPasteboard.general.setItems([[UTType.utf8PlainText.identifier: code]], options: options)
        }

        /// The view controller anything the SDK presents has to come from.
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

    /// One-shot claim on a continuation. `completionWithItemsHandler` is documented as firing
    /// once, but some share extensions fire it twice; a continuation resumed twice is a hard
    /// crash. Locked rather than assuming main-thread delivery, since the caller is a share
    /// extension, not our code.
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

    /// Carries the link plus the merchant's name as the mail/message subject, via
    /// `UIActivityItemSource` rather than undocumented KVC.
    private final class SharedLink: NSObject, UIActivityItemSource {
        private let item: Any
        private let title: String?

        init(link: String, title: String?) {
            // A `URL` where the string parses, so link-aware activities get one instead of plain text.
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
