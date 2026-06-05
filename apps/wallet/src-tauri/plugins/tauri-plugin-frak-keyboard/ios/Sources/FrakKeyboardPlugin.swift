import SwiftRs
import Tauri
import UIKit
import WebKit

/// Native iOS keyboard avoidance for the wallet WebView.
///
/// Problem (confirmed with on-device instrumentation): when the soft keyboard
/// opens over the `autoFocus` input, WKWebView scrolls the focused input "into
/// view" even though the wallet shell already shrinks it above the keyboard.
/// That reveal-scroll is a transient (`0 → 89 → 0`) that reads as a content
/// jump. It manifests two ways:
///   • If the layout viewport still spans the full screen, WKWebView shifts the
///     *visual viewport* (`visualViewport.offsetTop`) — not a real scroll, and
///     not interceptable.
///   • If the layout viewport matches the visible area, WKWebView instead
///     *scrolls the document* (`scrollView.contentOffset`) — which IS
///     interceptable.
///
/// So the fix is two-part:
///   1. Resize the WKWebView frame to the visible area on `keyboardWillChangeFrame`
///      so `window.innerHeight` matches `visualViewport.height`. This forces the
///      reveal down the document-scroll path (and removes the visual-viewport
///      shift / the gap).
///   2. Pin `scrollView.contentOffset` to zero via KVO while the keyboard is up,
///      so the reveal scroll is reset synchronously (before paint) and never
///      shows. The wallet document never scrolls at the page level — all real
///      scrolling is the inner `main` overflow container — so pinning the page
///      scroll view to zero is safe.
///
/// `--viewport-height` is also written so the shell (`height: var(--viewport-height,
/// 100dvh)`) shrinks deterministically. The JS hook in
/// `apps/wallet/app/utils/keyboardInset.ts` early-returns on iOS.
class FrakKeyboardPlugin: Plugin {
    private weak var webview: WKWebView?
    private var pinScrollToZero = false
    private var observing = false
    private static var kvoContext = 0

    override func load(webview: WKWebView) {
        self.webview = webview

        let scrollView = webview.scrollView
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.addObserver(
            self,
            forKeyPath: "contentOffset",
            options: [.new],
            context: &Self.kvoContext)
        observing = true

        let center = NotificationCenter.default
        center.addObserver(
            self,
            selector: #selector(keyboardWillChangeFrame(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil)
        center.addObserver(
            self,
            selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil)
    }

    deinit {
        if observing, let sv = webview?.scrollView {
            sv.removeObserver(self, forKeyPath: "contentOffset", context: &Self.kvoContext)
        }
        NotificationCenter.default.removeObserver(self)
    }

    // Reset any reveal-scroll WKWebView applies while the keyboard is up. Runs
    // synchronously on the contentOffset change, so the scroll never paints.
    override func observeValue(
        forKeyPath keyPath: String?,
        of object: Any?,
        change: [NSKeyValueChangeKey: Any]?,
        context: UnsafeMutableRawPointer?
    ) {
        guard context == &Self.kvoContext, let scrollView = object as? UIScrollView else {
            super.observeValue(forKeyPath: keyPath, of: object, change: change, context: context)
            return
        }
        guard pinScrollToZero, scrollView.contentOffset != .zero else { return }
        scrollView.setContentOffset(.zero, animated: false)
    }

    @objc private func keyboardWillChangeFrame(_ note: Notification) {
        guard let webview = webview,
            webview.window != nil,
            let info = note.userInfo,
            let endFrame = (info[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?
                .cgRectValue
        else { return }

        let keyboardInView = webview.convert(endFrame, from: nil)
        let overlap = max(0, webview.bounds.maxY - keyboardInView.minY)
        apply(overlap: overlap)
    }

    @objc private func keyboardWillHide(_ note: Notification) {
        apply(overlap: 0)
    }

    private func apply(overlap: CGFloat) {
        guard let webview = webview, let superview = webview.superview else { return }
        let bounds = superview.bounds
        let availableHeight = max(0, bounds.height - overlap)

        pinScrollToZero = overlap > 0

        // Match the layout viewport to the visible area (see class doc).
        webview.frame = CGRect(
            x: bounds.minX, y: bounds.minY, width: bounds.width, height: availableHeight)

        // Belt-and-suspenders: reset the page scroll now too (the reveal may have
        // already fired before this notification).
        if pinScrollToZero, webview.scrollView.contentOffset != .zero {
            webview.scrollView.setContentOffset(.zero, animated: false)
        }

        let script =
            overlap > 0
            ? "document.documentElement.style.setProperty('--viewport-height','\(Int(availableHeight))px');"
                + "document.documentElement.style.setProperty('--keyboard-open','1');"
            : "document.documentElement.style.removeProperty('--viewport-height');"
                + "document.documentElement.style.setProperty('--keyboard-open','0');"
        webview.evaluateJavaScript(script, completionHandler: nil)
    }
}

@_cdecl("init_plugin_frak_keyboard")
func initPlugin() -> Plugin {
    return FrakKeyboardPlugin()
}
