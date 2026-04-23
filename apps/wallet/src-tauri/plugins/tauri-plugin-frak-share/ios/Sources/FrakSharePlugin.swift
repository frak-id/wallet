import LinkPresentation
import SwiftRs
import Tauri
import UIKit

/**
 * Native iOS share sheet for link payloads.
 *
 * The payload is split into typed activity items so that target apps
 * (Messages, Mail, Notes, Safari, WhatsApp, …) can format each piece on
 * their own:
 *   - `url`      → `URL` activity item — Messages renders a link card,
 *                  Mail makes it clickable, Safari can "Add to Reading List".
 *   - `text`     → optional `String` body, separate from the URL.
 *   - `title`    → used as the email subject and as the LinkPresentation
 *                  title at the top of the share sheet.
 *   - `imageUrl` → optional remote image fetched into `LPLinkMetadata.iconProvider`
 *                  so the share sheet shows a brand thumbnail above the activity grid.
 *
 * The share sheet is presented after the icon is loaded (or the load times out)
 * so users always see the rich preview when an `imageUrl` is supplied.
 */
class FrakSharePlugin: Plugin {
    @objc public func shareText(_ invoke: Invoke) {
        guard let args = try? invoke.getArgs() else {
            invoke.reject("Missing share payload")
            return
        }

        let url = args.getString("url")
        let text = args.getString("text")
        let title = args.getString("title")
        let imageUrl = args.getString("imageUrl")

        // We must have at least one shareable thing, otherwise the activity
        // sheet has nothing to offer the user.
        if (url?.isEmpty ?? true) && (text?.isEmpty ?? true) {
            invoke.reject("Missing 'url' or 'text' parameter")
            return
        }

        let linkURL: URL? = {
            guard let url = url, !url.isEmpty else { return nil }
            return URL(string: url)
        }()

        // Build the LinkPresentation metadata up-front so the share sheet
        // can render the rich preview header. `iconProvider` is filled
        // asynchronously when an `imageUrl` is provided; otherwise we just
        // present immediately.
        let metadata = LPLinkMetadata()
        if let title = title, !title.isEmpty {
            metadata.title = title
        }
        if let linkURL = linkURL {
            metadata.originalURL = linkURL
            metadata.url = linkURL
        }

        let present: () -> Void = { [weak self] in
            self?.presentShareSheet(
                invoke: invoke,
                url: linkURL,
                text: text,
                title: title,
                metadata: metadata
            )
        }

        if let imageUrl = imageUrl,
           !imageUrl.isEmpty,
           let remoteImage = URL(string: imageUrl) {
            // Fire-and-forget icon download; cap at 2 s so the share sheet
            // never feels stuck behind a slow network. iOS will fall back
            // to favicon/OpenGraph fetching via `originalURL` when the
            // iconProvider stays nil.
            loadIconProvider(from: remoteImage, timeout: 2.0) { provider in
                if let provider = provider {
                    metadata.iconProvider = provider
                }
                present()
            }
        } else {
            present()
        }
    }

    private func presentShareSheet(
        invoke: Invoke,
        url: URL?,
        text: String?,
        title: String?,
        metadata: LPLinkMetadata
    ) {
        // Build typed activity items. Order matters: the URL goes first so
        // activities that only consume a single item (e.g. Safari Reading
        // List) get the link, not the body text.
        var items: [Any] = []
        if let url = url {
            items.append(LinkActivityItemSource(
                url: url,
                subject: title,
                metadata: metadata
            ))
        }
        if let text = text, !text.isEmpty {
            items.append(TextActivityItemSource(
                text: text,
                subject: title
            ))
        }

        DispatchQueue.main.async {
            guard let rootViewController = UIApplication.shared.windows
                .first(where: { $0.isKeyWindow })?.rootViewController else {
                invoke.reject("No root view controller available")
                return
            }

            let activityController = UIActivityViewController(
                activityItems: items,
                applicationActivities: nil
            )

            // iPad: anchor the popover to the center of the screen as a safe default.
            if let popover = activityController.popoverPresentationController {
                popover.sourceView = rootViewController.view
                popover.sourceRect = CGRect(
                    x: rootViewController.view.bounds.midX,
                    y: rootViewController.view.bounds.midY,
                    width: 0,
                    height: 0
                )
                popover.permittedArrowDirections = []
            }

            activityController.completionWithItemsHandler = { _, completed, _, error in
                if let error = error {
                    invoke.reject(error.localizedDescription)
                    return
                }
                let result: JsonObject = [
                    "shared": completed
                ]
                invoke.resolve(result)
            }

            rootViewController.present(activityController, animated: true, completion: nil)
        }
    }

    /// Downloads `imageUrl` into a transient `NSItemProvider` so it can be
    /// attached to `LPLinkMetadata.iconProvider`. Falls back to `nil` on any
    /// failure or once `timeout` elapses — the share sheet is presented
    /// regardless so users never wait indefinitely.
    private func loadIconProvider(
        from imageUrl: URL,
        timeout: TimeInterval,
        completion: @escaping (NSItemProvider?) -> Void
    ) {
        var hasResolved = false
        let resolveOnce: (NSItemProvider?) -> Void = { provider in
            DispatchQueue.main.async {
                guard !hasResolved else { return }
                hasResolved = true
                completion(provider)
            }
        }

        let task = URLSession.shared.dataTask(with: imageUrl) { data, _, _ in
            guard let data = data, let image = UIImage(data: data) else {
                resolveOnce(nil)
                return
            }
            resolveOnce(NSItemProvider(object: image))
        }
        task.resume()

        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) {
            if !hasResolved { task.cancel() }
            resolveOnce(nil)
        }
    }
}

/// Activity item source for the URL — provides per-activity overrides:
/// LinkPresentation metadata (rich preview header) and a Mail subject.
private final class LinkActivityItemSource: NSObject, UIActivityItemSource {
    private let url: URL
    private let subject: String?
    private let metadata: LPLinkMetadata

    init(url: URL, subject: String?, metadata: LPLinkMetadata) {
        self.url = url
        self.subject = subject
        self.metadata = metadata
        super.init()
    }

    func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any {
        return url
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        itemForActivityType activityType: UIActivity.ActivityType?
    ) -> Any? {
        return url
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        subjectForActivityType activityType: UIActivity.ActivityType?
    ) -> String {
        return subject ?? ""
    }

    func activityViewControllerLinkMetadata(
        _ activityViewController: UIActivityViewController
    ) -> LPLinkMetadata? {
        return metadata
    }
}

/// Activity item source for the message body — kept separate from the URL
/// so apps that consume only one item don't end up with text-glued URLs.
private final class TextActivityItemSource: NSObject, UIActivityItemSource {
    private let text: String
    private let subject: String?

    init(text: String, subject: String?) {
        self.text = text
        self.subject = subject
    }

    func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any {
        return text
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        itemForActivityType activityType: UIActivity.ActivityType?
    ) -> Any? {
        return text
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        subjectForActivityType activityType: UIActivity.ActivityType?
    ) -> String {
        return subject ?? ""
    }
}

@_cdecl("init_plugin_frak_share")
func initPlugin() -> Plugin {
    return FrakSharePlugin()
}
