import UIKit
import WebKit

/// Holds the webview's own scroll view at rest; pages scroll inside `main`.
/// WebKit enables it while the keyboard is docked and pans it to centre the focused field.
final class WebViewScrollLock {
    private var observation: NSKeyValueObservation?

    init(_ webview: WKWebView) {
        let scrollView = webview.scrollView
        scrollView.isScrollEnabled = false
        observation = scrollView.observe(\.contentOffset) { scrollView, _ in
            let inset = scrollView.adjustedContentInset
            let offset = scrollView.contentOffset
            // Not `!=`: an offset rounded to the pixel grid would re-trigger this forever.
            if abs(offset.x + inset.left) > 0.5 || abs(offset.y + inset.top) > 0.5 {
                scrollView.contentOffset = CGPoint(x: -inset.left, y: -inset.top)
            }
        }
    }
}
