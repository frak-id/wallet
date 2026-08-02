#if canImport(UIKit)
    import UIKit

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

            return await withCheckedContinuation { continuation in
                controller.completionWithItemsHandler = { _, completed, _, _ in
                    continuation.resume(returning: completed)
                }
                presenter.present(controller, animated: true)
            }
        }

        /// iOS shows its own banner when an app *reads* the pasteboard, never when it writes,
        /// so the sheet still owes the user its own confirmation.
        static func copy(_ link: String) {
            UIPasteboard.general.string = link
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
