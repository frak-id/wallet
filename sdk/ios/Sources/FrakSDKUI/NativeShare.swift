#if canImport(UIKit)
    import Foundation
    import ImageIO
    import LinkPresentation
    import UIKit
    import UniformTypeIdentifiers

    /// The OS share sheet and the pasteboard — the two things the hosted page cannot do itself.
    @MainActor
    enum NativeShare {
        /// Presents the system share sheet and resolves once the user has finished with it.
        /// `imageURL` is sender-side chrome only, so a failed fetch still shares.
        /// - Returns: whether the user completed a share. False also covers "nothing could present it".
        static func share(
            link: String,
            title: String?,
            text: String? = nil,
            imageURL: URL? = nil,
            imageCache: SharingImagePreviewCache? = nil
        ) async -> Bool {
            // Early bail only; the presenter is resolved again after the image await below.
            guard topViewController() != nil else { return false }

            // Re-capped: the query string carrying these is not trusted. Blank is absent, so an
            // empty subject never reaches the chooser.
            let items = sharingShareItems(link: link, title: title, text: text)

            let metadata = LPLinkMetadata()
            if let title = items.title { metadata.title = title }
            let linkURL = URL(string: link)
            if let linkURL {
                metadata.originalURL = linkURL
                metadata.url = linkURL
            }
            if let imageURL {
                let data: Data?
                if let imageCache {
                    data = await imageCache.imageData(for: imageURL)
                } else {
                    data = await SharingImagePreview.fetch(imageURL)
                }
                // Downsampled rather than `UIImage(data:)`: `maxBytes` bounds the compressed
                // payload, so a small highly-compressed image can still decode to hundreds of MB.
                if let data, let image = downsampledShareIcon(data) {
                    metadata.iconProvider = NSItemProvider(object: image)
                }
            }

            var activityItems: [Any] = [
                LinkActivityItemSource(link: items.link, url: linkURL, subject: items.title, metadata: metadata)
            ]
            if let text = items.text {
                activityItems.append(TextActivityItemSource(text: text, subject: items.title))
            }

            // Re-resolved: the image await above can outlast the controller that was on top when
            // this started, and presenting on a detached one silently shows nothing.
            guard let presenter = topViewController() else { return false }

            let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
            // Required on iPad: an unanchored popover traps instead of presenting.
            if let popover = controller.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(
                    origin: CGPoint(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY),
                    size: .zero
                )
                popover.permittedArrowDirections = []
            }

            // Before presenting, never after: `presentingViewController` is not reliably wired on
            // the same turn as `present`, so reading it there refuses a chooser that does appear.
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
        /// `localOnly`, like the install code: the link carries the user's own referral identity,
        /// and Universal Clipboard would fan it out to their other devices.
        static func copy(_ link: String) {
            UIPasteboard.general.setItems(
                [[UTType.utf8PlainText.identifier: link]],
                options: [.localOnly: true]
            )
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

        /// The chooser's preview icon is a small tile; nothing needs more than this.
        private static let iconMaxPixelSize = 512

        /// Decodes at most `iconMaxPixelSize` on the long edge, so the bitmap is bounded by the
        /// icon's own size rather than by whatever the source image happens to decode to.
        private static func downsampledShareIcon(_ data: Data) -> UIImage? {
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: iconMaxPixelSize,
            ]
            guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
                return nil
            }
            return UIImage(cgImage: thumbnail)
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

    /// Separate from `TextActivityItemSource` so a single-item activity gets the link, not
    /// text glued to a URL.
    private final class LinkActivityItemSource: NSObject, UIActivityItemSource {
        private let item: Any
        private let subject: String?
        private let metadata: LPLinkMetadata

        init(link: String, url: URL?, subject: String?, metadata: LPLinkMetadata) {
            // A `URL` where the string parses, so link-aware activities get one instead of plain text.
            self.item = url ?? link
            self.subject = subject
            self.metadata = metadata
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
            subject ?? ""
        }

        func activityViewControllerLinkMetadata(_ controller: UIActivityViewController) -> LPLinkMetadata? {
            metadata
        }
    }

    /// The message body as its own activity item.
    private final class TextActivityItemSource: NSObject, UIActivityItemSource {
        private let text: String
        private let subject: String?

        init(text: String, subject: String?) {
            self.text = text
            self.subject = subject
        }

        func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any {
            text
        }

        func activityViewController(
            _ controller: UIActivityViewController,
            itemForActivityType activityType: UIActivity.ActivityType?
        ) -> Any? {
            text
        }

        func activityViewController(
            _ controller: UIActivityViewController,
            subjectForActivityType activityType: UIActivity.ActivityType?
        ) -> String {
            subject ?? ""
        }
    }
#endif
