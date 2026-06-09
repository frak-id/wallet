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
///   1. Snap the WKWebView frame to the visible area on `keyboardWillChangeFrame`
///      (not animated) so `window.innerHeight` matches `visualViewport.height`. This
///      forces the reveal down the document-scroll path (and removes the
///      visual-viewport shift / the gap). The frame is intentionally NOT animated:
///      WKWebView does not relayout `dvh` continuously through a frame animation, so
///      the web would just snap to the end size.
///   2. Pin `scrollView.contentOffset` to zero via KVO while the keyboard is up,
///      so the reveal scroll is reset synchronously (before paint) and never
///      shows. The wallet document never scrolls at the page level — all real
///      scrolling is the inner `main` overflow container — so pinning the page
///      scroll view to zero is safe.
///
/// The visible keyboard animation lives on the web side: `--viewport-height` is set
/// to the visible height and the shell transitions to it over `--kb-anim-dur` (the
/// keyboard's real duration, also pushed here) — see appShell.css.ts. Frame and
/// shell interpolate the same range over the same duration, so the footer rides the
/// keyboard top. `--keyboard-open` (0/1) is also pushed (nav-bar inset / auth
/// layout). The JS hook in `apps/wallet/app/utils/keyboardInset.ts` early-returns
/// on iOS.
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
        apply(overlap: overlap, info: info)
    }

    @objc private func keyboardWillHide(_ note: Notification) {
        apply(overlap: 0, info: note.userInfo)
    }

    private func apply(overlap: CGFloat, info: [AnyHashable: Any]?) {
        guard let webview = webview, let superview = webview.superview else { return }
        let bounds = superview.bounds
        let availableHeight = max(0, bounds.height - overlap)

        pinScrollToZero = overlap > 0

        // Snap the WKWebView frame to the visible area *immediately* (not animated).
        // This makes `innerHeight` match the visible area before the focus reveal
        // fires, routing the reveal to the pinnable document scroll (see class doc).
        // The frame is NOT animated: WKWebView does not relayout `dvh` continuously
        // through a frame animation — the web side would just snap to the end frame.
        // The visible animation lives on the web instead (`--viewport-height` below).
        webview.frame = CGRect(
            x: bounds.minX, y: bounds.minY, width: bounds.width, height: availableHeight)

        if pinScrollToZero, webview.scrollView.contentOffset != .zero {
            webview.scrollView.setContentOffset(.zero, animated: false)
        }

        // Drive the shell height on the web side, transitioned over the keyboard's
        // real duration (appShell.css.ts reads `--kb-anim-dur`). The keyboard frame
        // and `--viewport-height` interpolate the same range over the same duration,
        // so the footer rides the keyboard top — content below it is hidden behind
        // the keyboard. `keyboardWillChangeFrame` posts just before the keyboard
        // animates, so the transition starts ~in step with it.
        let durationMs = Int(
            ((info?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25) * 1000)
        let script =
            overlap > 0
            ? "document.documentElement.style.setProperty('--kb-anim-dur','\(durationMs)ms');"
                + "document.documentElement.style.setProperty('--viewport-height','\(Int(availableHeight))px');"
                + "document.documentElement.style.setProperty('--keyboard-open','1');"
            : "document.documentElement.style.setProperty('--kb-anim-dur','\(durationMs)ms');"
                + "document.documentElement.style.removeProperty('--viewport-height');"
                + "document.documentElement.style.setProperty('--keyboard-open','0');"
        webview.evaluateJavaScript(script, completionHandler: nil)
    }
}

@_cdecl("init_plugin_frak_keyboard")
func initPlugin() -> Plugin {
    return FrakKeyboardPlugin()
}
